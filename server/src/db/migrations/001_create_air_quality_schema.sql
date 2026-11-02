CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS air_quality_readings (
  station_id TEXT NOT NULL REFERENCES stations(id),
  observed_at TIMESTAMPTZ NOT NULL,
  pm2_5 DOUBLE PRECISION CHECK (pm2_5 IS NULL OR pm2_5 >= 0),
  pm10 DOUBLE PRECISION CHECK (pm10 IS NULL OR pm10 >= 0),
  nitrogen_dioxide DOUBLE PRECISION CHECK (nitrogen_dioxide IS NULL OR nitrogen_dioxide >= 0),
  ozone DOUBLE PRECISION CHECK (ozone IS NULL OR ozone >= 0),
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (station_id, observed_at)
);

SELECT create_hypertable(
  'air_quality_readings',
  'observed_at',
  if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS air_quality_readings_station_time_idx
  ON air_quality_readings (station_id, observed_at DESC);
