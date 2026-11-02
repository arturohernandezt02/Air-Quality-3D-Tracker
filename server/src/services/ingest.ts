import "dotenv/config";
import { loadLocations } from "../config/locations.js";
import { createDatabase } from "../db/database.js";
import { fetchHourlyObservations } from "./open-meteo.js";

const locations = loadLocations();
const database = createDatabase();
let totalReadings = 0;

try {
  for (const location of locations) {
    const observations = await fetchHourlyObservations(location);
    const ingestedAt = new Date();

    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto("stations")
        .values(location)
        .onConflict((conflict) =>
          conflict.column("id").doUpdateSet({
            name: location.name,
            country: location.country,
            latitude: location.latitude,
            longitude: location.longitude,
            updated_at: ingestedAt,
          }),
        )
        .execute();

      await transaction
        .insertInto("air_quality_readings")
        .values(
          observations.map((observation) => ({
            station_id: location.id,
            observed_at: observation.observedAt,
            pm2_5: observation.pm2_5,
            pm10: observation.pm10,
            nitrogen_dioxide: observation.nitrogen_dioxide,
            ozone: observation.ozone,
          })),
        )
        .onConflict((conflict) =>
          conflict
            .columns(["station_id", "observed_at"])
            .doUpdateSet({
              pm2_5: (expression) => expression.ref("excluded.pm2_5"),
              pm10: (expression) => expression.ref("excluded.pm10"),
              nitrogen_dioxide: (expression) =>
                expression.ref("excluded.nitrogen_dioxide"),
              ozone: (expression) => expression.ref("excluded.ozone"),
              ingested_at: ingestedAt,
            }),
        )
        .execute();
    });

    totalReadings += observations.length;
    console.info(
      `Ingested ${observations.length} hourly readings for ${location.name} (${location.id}).`,
    );
  }

  console.info(
    `Ingestion completed for ${locations.length} locations; ${totalReadings} hourly readings saved.`,
  );
} finally {
  await database.destroy();
}
