import {
	parsePluginIdFromZip,
	rebundlePluginZipWithTracking,
} from "@dokploy/server";
import { db } from "@dokploy/server/db";
import {
	skillAnalyticsEvents,
	skillAnalyticsRegistrations,
} from "@dokploy/server/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

function getEndpointBaseUrl(req: { headers?: { origin?: string; host?: string } }): string {
	const origin = req?.headers?.origin;
	const host = req?.headers?.host;
	if (origin) return origin;
	if (host) return `https://${host}`;
	return process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

/** tracking_id is nanoid — only safe chars; still escape for sql.raw. */
function trackingIdSqlLiteral(tid: string): string {
	if (!/^[a-zA-Z0-9_-]{1,80}$/.test(tid)) {
		throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid tracking id" });
	}
	return tid.replace(/'/g, "''");
}

export const skillAnalyticsRouter = createTRPCRouter({
	register: protectedProcedure
		.input(
			z.object({
				zipBase64: z.string().min(1),
				name: z.string().min(1),
				baseUrl: z.string().url().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			let zipBuffer: Buffer;
			try {
				zipBuffer = Buffer.from(input.zipBase64, "base64");
			} catch {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Invalid base64 zip data",
				});
			}
			const pluginId = parsePluginIdFromZip(zipBuffer);
			const trackingId = nanoid(16);
			const baseUrl = input.baseUrl ?? getEndpointBaseUrl(ctx.req);

			await db.insert(skillAnalyticsRegistrations).values({
				trackingId,
				userId: ctx.user.id,
				organizationId: ctx.session.activeOrganizationId,
				name: input.name,
				pluginId: pluginId ?? null,
			});

			const rebundled = rebundlePluginZipWithTracking(
				zipBuffer,
				trackingId,
				`${baseUrl}/api/analytics/skill`,
			);

			return {
				trackingId,
				name: input.name,
				pluginId: pluginId ?? undefined,
				trackableZipBase64: rebundled.toString("base64"),
			};
		}),

	list: protectedProcedure.query(async ({ ctx }) => {
		return db
			.select()
			.from(skillAnalyticsRegistrations)
			.where(
				eq(skillAnalyticsRegistrations.organizationId, ctx.session.activeOrganizationId),
			)
			.orderBy(sql`${skillAnalyticsRegistrations.createdAt} desc`);
	}),

	getSummary: protectedProcedure
		.input(z.object({ trackingId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const [reg] = await db
				.select()
				.from(skillAnalyticsRegistrations)
				.where(eq(skillAnalyticsRegistrations.trackingId, input.trackingId));

			if (!reg || reg.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found" });
			}

			const events = await db
				.select({
					eventType: skillAnalyticsEvents.eventType,
					count: sql<number>`count(*)::int`,
				})
				.from(skillAnalyticsEvents)
				.where(eq(skillAnalyticsEvents.trackingId, input.trackingId))
				.groupBy(skillAnalyticsEvents.eventType);

			const total = events.reduce((sum, r) => sum + r.count, 0);
			const byType = Object.fromEntries(events.map((e) => [e.eventType, e.count]));

			return {
				trackingId: input.trackingId,
				name: reg.name,
				pluginId: reg.pluginId,
				createdAt: reg.createdAt,
				totalEvents: total,
				byEventType: byType,
			};
		}),

	/** Paginated-ish recent raw events for drill-down in Skill Inspector. */
	recentEvents: protectedProcedure
		.input(
			z.object({
				trackingId: z.string().min(1),
				limit: z.number().min(1).max(100).default(50),
			}),
		)
		.query(async ({ ctx, input }) => {
			const [reg] = await db
				.select()
				.from(skillAnalyticsRegistrations)
				.where(eq(skillAnalyticsRegistrations.trackingId, input.trackingId));

			if (!reg || reg.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found" });
			}

			const rows = await db
				.select({
					id: skillAnalyticsEvents.id,
					eventType: skillAnalyticsEvents.eventType,
					payload: skillAnalyticsEvents.payload,
					createdAt: skillAnalyticsEvents.createdAt,
				})
				.from(skillAnalyticsEvents)
				.where(eq(skillAnalyticsEvents.trackingId, input.trackingId))
				.orderBy(desc(skillAnalyticsEvents.createdAt))
				.limit(input.limit);

			return { events: rows };
		}),

	/** Insert a synthetic event to verify DB + UI (does not prove OpenClaw can reach ingest). */
	sendTestEvent: protectedProcedure
		.input(z.object({ trackingId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const [reg] = await db
				.select()
				.from(skillAnalyticsRegistrations)
				.where(eq(skillAnalyticsRegistrations.trackingId, input.trackingId));

			if (!reg || reg.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found" });
			}

			await db.insert(skillAnalyticsEvents).values({
				id: nanoid(),
				trackingId: input.trackingId,
				eventType: "agentready_test_ping",
				payload: {
					source: "dashboard",
					at: new Date().toISOString(),
				},
			});
			return { ok: true as const };
		}),

	dashboard: protectedProcedure
		.input(z.object({ trackingId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const tid = input.trackingId;
			const [reg] = await db
				.select()
				.from(skillAnalyticsRegistrations)
				.where(eq(skillAnalyticsRegistrations.trackingId, tid));

			if (!reg || reg.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found" });
			}

			// Never bind JS Date in SQL — drivers may stringify as invalid timestamps for Postgres.
			const todayUtc = sql`((${skillAnalyticsEvents.createdAt} AT TIME ZONE 'UTC')::date = (NOW() AT TIME ZONE 'UTC')::date)`;
			const last7d = sql`${skillAnalyticsEvents.createdAt} >= NOW() - INTERVAL '7 days'`;
			const last24h = sql`${skillAnalyticsEvents.createdAt} >= NOW() - INTERVAL '24 hours'`;

			const [[totalAll], [todayRow], [last7Row], [last24Row]] = await Promise.all([
				db
					.select({ c: sql<number>`count(*)::int` })
					.from(skillAnalyticsEvents)
					.where(eq(skillAnalyticsEvents.trackingId, tid)),
				db
					.select({ c: sql<number>`count(*)::int` })
					.from(skillAnalyticsEvents)
					.where(and(eq(skillAnalyticsEvents.trackingId, tid), todayUtc)),
				db
					.select({ c: sql<number>`count(*)::int` })
					.from(skillAnalyticsEvents)
					.where(and(eq(skillAnalyticsEvents.trackingId, tid), last7d)),
				db
					.select({ c: sql<number>`count(*)::int` })
					.from(skillAnalyticsEvents)
					.where(and(eq(skillAnalyticsEvents.trackingId, tid), last24h)),
			]);

			const byEventTypeRows = await db
				.select({
					eventType: skillAnalyticsEvents.eventType,
					count: sql<number>`count(*)::int`,
				})
				.from(skillAnalyticsEvents)
				.where(and(eq(skillAnalyticsEvents.trackingId, tid), last7d))
				.groupBy(skillAnalyticsEvents.eventType);

			// sql.raw: no bound params — avoids $2 JS-Date bugs and stale bundles that still used gte(date).
			const tsql = trackingIdSqlLiteral(tid);
			const hourlyRaw = await db.execute(sql.raw(`
				SELECT EXTRACT(HOUR FROM created_at)::int AS hour,
				       COUNT(*)::int AS cnt
				FROM skill_analytics_events
				WHERE tracking_id = '${tsql}'
				  AND created_at >= NOW() - INTERVAL '7 days'
				GROUP BY EXTRACT(HOUR FROM created_at)
				ORDER BY hour
			`));

			const dailyRaw = await db.execute(sql.raw(`
				SELECT created_at::date AS day,
				       COUNT(*)::int AS cnt
				FROM skill_analytics_events
				WHERE tracking_id = '${tsql}'
				  AND created_at >= NOW() - INTERVAL '14 days'
				GROUP BY created_at::date
				ORDER BY day ASC
			`));

			const channelRaw = await db.execute(sql.raw(`
				SELECT payload->>'channel' AS channel,
				       COUNT(*)::int AS cnt
				FROM skill_analytics_events
				WHERE tracking_id = '${tsql}'
				  AND created_at >= NOW() - INTERVAL '7 days'
				  AND payload->>'channel' IS NOT NULL
				  AND payload->>'channel' != ''
				GROUP BY payload->>'channel'
				ORDER BY cnt DESC
				LIMIT 12
			`));

			const toolRaw = await db.execute(sql.raw(`
				SELECT payload->>'toolName' AS tool_name,
				       COUNT(*)::int AS cnt
				FROM skill_analytics_events
				WHERE tracking_id = '${tsql}'
				  AND created_at >= NOW() - INTERVAL '7 days'
				  AND payload->>'toolName' IS NOT NULL
				GROUP BY payload->>'toolName'
				ORDER BY cnt DESC
				LIMIT 15
			`));

			const toRows = (r: unknown): Record<string, unknown>[] => {
				if (Array.isArray(r)) return r as Record<string, unknown>[];
				if (r && typeof r === "object" && "rows" in r && Array.isArray((r as { rows: unknown }).rows)) {
					return (r as { rows: Record<string, unknown>[] }).rows;
				}
				return [];
			};

			const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
			for (const row of toRows(hourlyRaw)) {
				const h = Number(row.hour);
				const cnt = Number(row.cnt);
				if (h >= 0 && h <= 23 && hourBuckets[h]) hourBuckets[h].count = cnt;
			}

			const baseUrl = getEndpointBaseUrl(ctx.req ?? {});
			const ingestUrl = `${baseUrl.replace(/\/$/, "")}/api/analytics/skill/${encodeURIComponent(tid)}/events`;

			return {
				registration: {
					name: reg.name,
					pluginId: reg.pluginId,
					trackingId: tid,
					createdAt: reg.createdAt,
				},
				counts: {
					allTime: totalAll?.c ?? 0,
					todayUtc: todayRow?.c ?? 0,
					last7Days: last7Row?.c ?? 0,
					last24Hours: last24Row?.c ?? 0,
				},
				byEventType7d: Object.fromEntries(
					byEventTypeRows.map((r) => [r.eventType, r.count]),
				),
				activityByHourUtc7d: hourBuckets,
				activityByDayUtc14d: toRows(dailyRaw).map((row) => ({
					day: String(row.day),
					count: Number(row.cnt),
				})),
				byChannel7d: toRows(channelRaw).map((row) => ({
					channel: String(row.channel),
					count: Number(row.cnt),
				})),
				topTools7d: toRows(toolRaw).map((row) => ({
					tool: String(row.tool_name || ""),
					count: Number(row.cnt),
				})),
				ingestUrl,
				debug: {
					serverIngestLog: "Set AGENTREADY_SKILL_ANALYTICS_LOG=1 on the server to log each POST.",
					openclawDebug: "Set AGENTREADY_ANALYTICS_DEBUG=1 when starting OpenClaw to log every telemetry POST.",
				},
			};
		}),

	remove: protectedProcedure
		.input(z.object({ trackingId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const [reg] = await db
				.select()
				.from(skillAnalyticsRegistrations)
				.where(eq(skillAnalyticsRegistrations.trackingId, input.trackingId));

			if (!reg || reg.organizationId !== ctx.session.activeOrganizationId) {
				throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found" });
			}

			await db
				.delete(skillAnalyticsEvents)
				.where(eq(skillAnalyticsEvents.trackingId, input.trackingId));
			await db
				.delete(skillAnalyticsRegistrations)
				.where(eq(skillAnalyticsRegistrations.trackingId, input.trackingId));

			return { ok: true };
		}),
});
