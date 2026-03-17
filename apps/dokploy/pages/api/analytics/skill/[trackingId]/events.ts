import { db } from "@dokploy/server/db";
import {
	skillAnalyticsEvents,
	skillAnalyticsRegistrations,
} from "@dokploy/server/db/schema";
import { eq } from "drizzle-orm";
import type { NextApiRequest, NextApiResponse } from "next";

const MAX_EVENTS = 100;

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const trackingId = req.query.trackingId as string;
	if (!trackingId || typeof trackingId !== "string") {
		return res.status(400).json({ error: "Missing trackingId" });
	}

	const [reg] = await db
		.select({ id: skillAnalyticsRegistrations.id })
		.from(skillAnalyticsRegistrations)
		.where(eq(skillAnalyticsRegistrations.trackingId, trackingId));

	if (!reg) {
		return res.status(404).json({ error: "Unknown tracking ID" });
	}

	let body: { events?: Array<{ eventType: string; payload?: unknown }> };
	try {
		body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
	} catch {
		return res.status(400).json({ error: "Invalid JSON body" });
	}

	const raw = Array.isArray(body.events) ? body.events : [];
	const events = raw
		.slice(0, MAX_EVENTS)
		.filter(
			(e): e is { eventType: string; payload?: unknown } =>
				typeof e === "object" && e !== null && typeof (e as { eventType?: string }).eventType === "string",
		);

	if (events.length === 0) {
		return res.status(200).json({ accepted: 0 });
	}

	if (process.env.AGENTREADY_SKILL_ANALYTICS_LOG === "1") {
		// eslint-disable-next-line no-console
		console.log(
			"[skill-analytics] ingest",
			trackingId,
			events.length,
			events.map((e) => e.eventType).join(","),
		);
	}

	await db.insert(skillAnalyticsEvents).values(
		events.map((e) => ({
			trackingId,
			eventType: e.eventType,
			payload: e.payload ?? null,
		})),
	);

	return res.status(200).json({ accepted: events.length });
}
