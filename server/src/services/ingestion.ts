import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { AirQualityLocation } from "../config/locations.js";
import type { AirQualityDatabase } from "../db/types.js";
import {
  fetchHourlyObservationsBatch,
  LOCATION_BATCH_SIZE,
  type LocationObservations,
} from "./open-meteo.js";

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

export type BatchFetcher = (
  locations: AirQualityLocation[],
) => Promise<LocationObservations[]>;

export function chunkLocations(
  locations: AirQualityLocation[],
  batchSize = LOCATION_BATCH_SIZE,
): AirQualityLocation[][] {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("Batch size must be a positive integer.");
  }

  const batches: AirQualityLocation[][] = [];
  for (let index = 0; index < locations.length; index += batchSize) {
    batches.push(locations.slice(index, index + batchSize));
  }

  return batches;
}

export async function fetchObservationsForLocations(
  locations: AirQualityLocation[],
  fetchBatch: BatchFetcher = (batch) => fetchHourlyObservationsBatch(batch),
): Promise<LocationObservations[]> {
  const results: LocationObservations[] = [];

  for (const batch of chunkLocations(locations)) {
    results.push(...await fetchBatch(batch));
  }

  return results;
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
  fetchBatch?: BatchFetcher,
): Promise<IngestionResult> {
  if (locations.length === 0) {
    throw new Error("At least one location is required for ingestion.");
  }

  const startedAt = now();
  let fetched: LocationObservations[];

  try {
    fetched = await fetchObservationsForLocations(locations, fetchBatch);
    const ingestedAt = now();

    await database.transaction().execute(async (transaction) => {
      for (const { location, observations } of fetched) {
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

        if (observations.length === 0) {
          continue;
        }

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
      }
    });
  } catch (error) {
    await recordFailure(database, startedAt, error).catch(() => {
      // Preserve the original ingestion error if status recording also fails.
    });
    throw error;
  }

  const result: IngestionResult = {
    startedAt,
    completedAt: now(),
    locations: fetched.map(({ location, observations }) => ({
      locationId: location.id,
      locationName: location.name,
      readingCount: observations.length,
    })),
    readingCount: fetched.reduce(
      (total, { observations }) => total + observations.length,
      0,
    ),
  };

  await recordSuccess(database, result);
  return result;
}
