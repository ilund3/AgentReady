CREATE TABLE "skill_analytics_events" (
	"id" text PRIMARY KEY NOT NULL,
	"tracking_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_analytics_registrations" (
	"id" text PRIMARY KEY NOT NULL,
	"tracking_id" text NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"plugin_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skill_analytics_registrations_tracking_id_unique" UNIQUE("tracking_id")
);
--> statement-breakpoint
ALTER TABLE "skill_analytics_registrations" ADD CONSTRAINT "skill_analytics_registrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_analytics_registrations" ADD CONSTRAINT "skill_analytics_registrations_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;