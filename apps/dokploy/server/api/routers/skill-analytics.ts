import {
	parsePluginIdFromZip,
	rebundlePluginZipWithTracking,
} from "@dokploy/server";
import { db } from "@dokploy/server/db";
import {
	skillAnalyticsEvents,
	skillAnalyticsRegistrations,
} from "@dokploy/server/db/schema";
import { eq, sql } from "drizzle-orm";
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
