import "dotenv/config";
import { readFile } from "node:fs/promises";
import { sql } from "kysely";
import { createDatabase } from "./database.js";

const migrationUrl = new URL(
  "./migrations/001_create_air_quality_schema.sql",
  import.meta.url,
);
const migration = await readFile(migrationUrl, "utf8");
const database = createDatabase();

try {
  await sql.raw(migration).execute(database);
  console.info("TimescaleDB schema migration completed.");
} finally {
  await database.destroy();
}
