import { and, eq } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { dbUrl } from "./constants";
import * as schema from "./schema";

export { and, eq };
export * from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

/**
 * Evita problemas de redeclaración global en monorepos.
 * No usamos `declare global`.
 */
const globalForDb = globalThis as unknown as {
	db?: Database;
};

let dbConnection: Database;

const postgresOptions = {
	connect_timeout: 60,
	...(process.env.NODE_ENV === "production" && { ssl: true }),
};
if (process.env.NODE_ENV === "production") {
	// En producción no usamos global cache
	dbConnection = drizzle(postgres(dbUrl, postgresOptions), {
		schema,
	});
} else {
	// En desarrollo reutilizamos conexión para evitar múltiples conexiones
	if (!globalForDb.db) {
		globalForDb.db = drizzle(postgres(dbUrl, postgresOptions), {
			schema,
		});
	}

	dbConnection = globalForDb.db;
}

export const db: Database = dbConnection;

export { dbUrl };
