import type { ColumnType, Generated } from "kysely";

export interface StationsTable {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface AirQualityReadingsTable {
  station_id: string;
  observed_at: ColumnType<Date, Date | string, Date | string>;
  pm2_5: number | null;
  pm10: number | null;
  nitrogen_dioxide: number | null;
  ozone: number | null;
  ingested_at: Generated<Date>;
}

export interface AirQualityDatabase {
  stations: StationsTable;
  air_quality_readings: AirQualityReadingsTable;
}
