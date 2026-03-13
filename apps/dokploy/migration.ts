import { dbUrl } from "@dokploy/server/db";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Cloud Postgres (e.g. Railway) requires SSL; longer timeout for private network
const sql = postgres(dbUrl, {
	max: 1,
	connect_timeout: 60,
	...(process.env.NODE_ENV === "production" && { ssl: true }),
});
const db = drizzle(sql);

try {
	await migrate(db, { migrationsFolder: "drizzle" });
	console.log("Migration complete");
} catch (error) {
	console.log("Migration failed", error);
	process.exit(1);
} finally {
	sql.end();
}
