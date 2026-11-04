import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool } from "pg";
import type { AirQualityDatabase } from "./types.js";

export function createDatabase(): Kysely<AirQualityDatabase> {
  const username = process.env.POSTGRES_USER ?? "air_quality";
  const password = process.env.POSTGRES_PASSWORD ?? "air_quality_dev";
  const databaseName = process.env.POSTGRES_DB ?? "air_quality";
  const port = Number(process.env.POSTGRES_PORT ?? 5432);

  if (
    username.length === 0 ||
    password.length === 0 ||
    databaseName.length === 0 ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      "POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, and POSTGRES_PORT must define valid local database settings.",
    );
  }

  const defaultDatabaseUrl = `postgres://${encodeURIComponent(username)}:${encodeURIComponent(password)}@localhost:${port}/${encodeURIComponent(databaseName)}`;
  const connectionString = process.env.DATABASE_URL ?? defaultDatabaseUrl;

  let connectionUrl: URL;
  try {
    connectionUrl = new URL(connectionString);
  } catch (error) {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.", {
      cause: error,
    });
  }

  if (!["postgres:", "postgresql:"].includes(connectionUrl.protocol)) {
    throw new Error("DATABASE_URL must use the postgres:// or postgresql:// scheme.");
  }

  return new Kysely<AirQualityDatabase>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString,
        connectionTimeoutMillis: 5_000,
      }),
    }),
  });
}

export async function checkDatabaseConnection(
  database: Kysely<AirQualityDatabase>,
): Promise<void> {
  await sql`SELECT 1`.execute(database);
}
