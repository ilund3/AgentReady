import { dbUrl } from "@dokploy/server/db";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Longer connect timeout for cloud Postgres (e.g. Railway private network)
const sql = postgres(dbUrl, { max: 1, connect_timeout: 60 });
const db = drizzle(sql);

await migrate(db, { migrationsFolder: "drizzle" })
	.then(() => {
		console.log("Migration complete");
		sql.end();
	})
	.catch((error) => {
		console.log("Migration failed", error);
	})
	.finally(() => {
		sql.end();
	});
