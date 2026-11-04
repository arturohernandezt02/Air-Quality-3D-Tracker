import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { sql } from "kysely";
import { createDatabase } from "./database.js";

const migrationsUrl = new URL("./migrations/", import.meta.url);
const migrationFiles = (await readdir(migrationsUrl))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const database = createDatabase();

try {
  for (const file of migrationFiles) {
    const migration = await readFile(new URL(file, migrationsUrl), "utf8");
    await sql.raw(migration).execute(database);
    console.info(`Applied migration ${file}.`);
  }

  console.info("TimescaleDB schema migration completed.");
} finally {
  await database.destroy();
}
