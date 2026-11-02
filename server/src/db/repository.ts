import type { Kysely } from "kysely";
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

export interface AirQualityRepository {
  listStations(): Promise<StationRecord[]>;
  listMetrics(query: MetricsQuery): Promise<MetricRecord[]>;
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
}
