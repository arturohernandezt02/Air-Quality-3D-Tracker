# Air Quality Tracker server

The server ingests hourly air-quality data from the Open-Meteo Air Quality API into TimescaleDB. The initial locations are Mexico City, Madrid, and Buenos Aires; set `AIR_QUALITY_LOCATIONS` in `.env` to replace them with a non-empty JSON array of locations.

Open-Meteo supplies model-based estimates and forecasts, not direct readings from local monitoring stations. Each ingestion requests the previous and next day of hourly PM2.5, PM10, nitrogen dioxide (NO2), and ozone (O3) data in UTC. Re-running ingestion upserts by station and timestamp, so duplicate runs do not create duplicate readings.

## Run locally

1. From the project root, copy the example environment and start TimescaleDB. Its PostgreSQL values are shared by Compose and the server.

   ```sh
   cp server/.env.example server/.env
   docker compose --env-file server/.env up -d timescaledb
   ```

2. In `server/`, install dependencies, apply the schema, and run ingestion:

   ```sh
   npm install
   npm run db:migrate
   npm run ingest
   ```

3. Run `npm run ingest` again whenever you want to refresh the data. Scheduling recurring ingestion is not part of this milestone.

Set `DATABASE_URL` only when connecting to a non-default host or using a URL different from the `POSTGRES_*` settings.

`stations` stores each configured location. `air_quality_readings` is a TimescaleDB hypertable partitioned by `observed_at`, with a unique station/timestamp key and nullable pollutant values for missing API data.

The API source and supported variables are documented at [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api).
