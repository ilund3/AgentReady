import { relations } from "drizzle-orm";
import { json, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import { organization } from "./account";
import { user } from "./user";

/**
 * One row per plugin zip registered for analytics.
 * Creator uploads zip → we assign trackingId and optionally rebundle zip with it.
 */
export const skillAnalyticsRegistrations = pgTable("skill_analytics_registrations", {
	id: text("id")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	trackingId: text("tracking_id")
		.notNull()
		.unique(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	organizationId: text("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	name: text("name").notNull(),
	pluginId: text("plugin_id"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

/**
 * Events sent by distributed plugins (POST /api/analytics/skill/:trackingId/events).
 */
export const skillAnalyticsEvents = pgTable("skill_analytics_events", {
	id: text("id")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	trackingId: text("tracking_id").notNull(),
	eventType: text("event_type").notNull(),
	payload: json("payload"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const skillAnalyticsRegistrationsRelations = relations(
	skillAnalyticsRegistrations,
	({ one }) => ({
		user: one(user, {
			fields: [skillAnalyticsRegistrations.userId],
			references: [user.id],
		}),
		organization: one(organization, {
			fields: [skillAnalyticsRegistrations.organizationId],
			references: [organization.id],
		}),
	}),
);
