import "dotenv/config";
import { createApp } from "./app.js";
import { loadIngestionConfig } from "./config/ingestion.js";
import { loadLocations } from "./config/locations.js";
import { checkDatabaseConnection, createDatabase } from "./db/database.js";
import { KyselyAirQualityRepository } from "./db/repository.js";
import {
  startIngestionScheduler,
  type IngestionScheduler,
} from "./services/ingestion-scheduler.js";

const database = createDatabase();
const locations = loadLocations();
const ingestionConfig = loadIngestionConfig();
const app = createApp(
  new KyselyAirQualityRepository(database),
  undefined,
  {
    checkReadiness: () => checkDatabaseConnection(database),
    staleAfterMinutes: ingestionConfig.staleAfterMinutes,
  },
);
app.log.info(
  { locations: locations.length },
  "Air-quality locations loaded.",
);
let scheduler: IngestionScheduler | undefined;
app.addHook("onClose", async () => {
  await scheduler?.stop();
  await database.destroy();
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT value: ${process.env.PORT}`);
}

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app.log.info({ signal }, "Shutting down server.");

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, "Failed to shut down cleanly.");
    process.exit(1);
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ port, host });
} catch (error) {
  await app.close();
  throw error;
}

scheduler = startIngestionScheduler({
  database,
  locations,
  config: ingestionConfig,
  logger: app.log,
});
