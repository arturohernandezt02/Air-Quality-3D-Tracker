import "dotenv/config";
import { loadLocations } from "../config/locations.js";
import { createDatabase } from "../db/database.js";
import { ingestAirQualityData } from "./ingestion.js";

const locations = loadLocations();
const database = createDatabase();

try {
  const result = await ingestAirQualityData(database, locations);

  for (const location of result.locations) {
    console.info(
      `Ingested ${location.readingCount} hourly readings for ${location.locationName} (${location.locationId}).`,
    );
  }

  console.info(
    `Ingestion completed for ${result.locations.length} locations; ${result.readingCount} hourly readings saved.`,
  );
} finally {
  await database.destroy();
}
