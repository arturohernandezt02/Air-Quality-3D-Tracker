import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { AirQualityLocation } from "../config/locations.js";
import type { AirQualityDatabase } from "../db/types.js";
import { fetchHourlyObservations } from "./open-meteo.js";

export interface LocationIngestionResult {
  locationId: string;
  locationName: string;
  readingCount: number;
}

export interface IngestionResult {
  startedAt: Date;
  completedAt: Date;
  locations: LocationIngestionResult[];
  readingCount: number;
}

async function recordSuccess(
  database: Kysely<AirQualityDatabase>,
  result: IngestionResult,
): Promise<void> {
  await sql`
    INSERT INTO ingestion_status (
      id,
      last_attempt_at,
      last_success_at,
      last_error,
      locations_count,
      readings_count
    )
    VALUES (
      1,
      ${result.startedAt},
      ${result.completedAt},
      NULL,
      ${result.locations.length},
      ${result.readingCount}
    )
    ON CONFLICT (id) DO UPDATE SET
      last_attempt_at = EXCLUDED.last_attempt_at,
      last_success_at = EXCLUDED.last_success_at,
      last_error = NULL,
      locations_count = EXCLUDED.locations_count,
      readings_count = EXCLUDED.readings_count
  `.execute(database);
}

async function recordFailure(
  database: Kysely<AirQualityDatabase>,
  startedAt: Date,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);

  await sql`
    INSERT INTO ingestion_status (id, last_attempt_at, last_error)
    VALUES (1, ${startedAt}, ${message})
    ON CONFLICT (id) DO UPDATE SET
      last_attempt_at = EXCLUDED.last_attempt_at,
      last_error = EXCLUDED.last_error
  `.execute(database);
}

export async function ingestAirQualityData(
  database: Kysely<AirQualityDatabase>,
  locations: AirQualityLocation[],
  now: () => Date = () => new Date(),
): Promise<IngestionResult> {
  const startedAt = now();
  const locationResults: LocationIngestionResult[] = [];
  let readingCount = 0;

  try {
    for (const location of locations) {
      const observations = await fetchHourlyObservations(location);
      const ingestedAt = now();

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

      readingCount += observations.length;
      locationResults.push({
        locationId: location.id,
        locationName: location.name,
        readingCount: observations.length,
      });
    }
  } catch (error) {
    await recordFailure(database, startedAt, error).catch(() => {
      // Preserve the original ingestion error if status recording also fails.
    });
    throw error;
  }

  const result: IngestionResult = {
    startedAt,
    completedAt: now(),
    locations: locationResults,
    readingCount,
  };

  await recordSuccess(database, result);
  return result;
}
