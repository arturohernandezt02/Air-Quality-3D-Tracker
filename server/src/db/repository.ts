import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { AirQualityDatabase } from "./types.js";

export interface StationRecord {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export interface MetricsQuery {
  from: Date;
  to: Date;
  stationId?: string;
}

export interface MetricRecord extends StationRecord {
  observedAt: Date;
  pm2_5: number | null;
  pm10: number | null;
  nitrogen_dioxide: number | null;
  ozone: number | null;
}

export interface FreshnessRecord {
  latestObservation: Date | null;
  lastIngestedAt: Date | null;
  lastAttemptAt: Date | null;
}

export interface AirQualityRepository {
  listStations(): Promise<StationRecord[]>;
  listMetrics(query: MetricsQuery): Promise<MetricRecord[]>;
  getFreshness(): Promise<FreshnessRecord>;
}

export class KyselyAirQualityRepository implements AirQualityRepository {
  constructor(private readonly database: Kysely<AirQualityDatabase>) {}

  async listStations(): Promise<StationRecord[]> {
    return this.database
      .selectFrom("stations")
      .select(["id", "name", "country", "latitude", "longitude"])
      .orderBy("name", "asc")
      .execute();
  }

  async listMetrics(query: MetricsQuery): Promise<MetricRecord[]> {
    let metricsQuery = this.database
      .selectFrom("air_quality_readings as reading")
      .innerJoin("stations as station", "station.id", "reading.station_id")
      .select([
        "station.id as id",
        "station.name as name",
        "station.country as country",
        "station.latitude as latitude",
        "station.longitude as longitude",
        "reading.observed_at as observedAt",
        "reading.pm2_5 as pm2_5",
        "reading.pm10 as pm10",
        "reading.nitrogen_dioxide as nitrogen_dioxide",
        "reading.ozone as ozone",
      ])
      .where("reading.observed_at", ">=", query.from)
      .where("reading.observed_at", "<", query.to);

    if (query.stationId !== undefined) {
      metricsQuery = metricsQuery.where("station.id", "=", query.stationId);
    }

    return metricsQuery
      .orderBy("reading.observed_at", "asc")
      .orderBy("station.id", "asc")
      .execute();
  }

  async getFreshness(): Promise<FreshnessRecord> {
    const readings = await sql<{
      latestObservation: Date | null;
      lastIngestedAt: Date | null;
    }>`
      SELECT
        MAX(observed_at) AS "latestObservation",
        MAX(ingested_at) AS "lastIngestedAt"
      FROM air_quality_readings
    `.execute(this.database);
    const status = await this.database
      .selectFrom("ingestion_status")
      .select(["last_attempt_at", "last_success_at"])
      .where("id", "=", 1)
      .executeTakeFirst();
    const readingTotals = readings.rows[0];

    return {
      latestObservation: readingTotals?.latestObservation ?? null,
      lastIngestedAt:
        status?.last_success_at ?? readingTotals?.lastIngestedAt ?? null,
      lastAttemptAt: status?.last_attempt_at ?? null,
    };
  }
}
