# Air Quality Tracker server

The server ingests hourly air-quality data from the Open-Meteo Air Quality API into TimescaleDB. The initial locations are Mexico City, Madrid, and Buenos Aires; set `AIR_QUALITY_LOCATIONS` in `.env` to replace them with a non-empty JSON array of locations.

Open-Meteo supplies model-based estimates and forecasts, not direct readings from local monitoring stations. Each ingestion requests 72 hours (the two previous days plus the current day) of hourly PM2.5, PM10, nitrogen dioxide (NO2), and ozone (O3) data in UTC, so the dashboard's 48-hour window is covered from the first run. Re-running ingestion upserts by station and timestamp, so duplicate runs do not create duplicate readings.

## Run locally

1. From the project root, copy the example environment and start TimescaleDB. Its PostgreSQL values are shared by Compose and the server.

   ```sh
   cp server/.env.example server/.env
   docker compose --env-file server/.env up -d timescaledb
   ```

2. In `server/`, install dependencies and apply the schema:

   ```sh
   npm install
   npm run db:migrate
   ```

3. Start the API. It runs an initial ingestion on startup and then repeats it every 60 minutes by default:

   ```sh
   npm run dev
   ```

`npm run ingest` remains available for a one-off manual ingestion. TimescaleDB must be running and the migration must have been applied first.

Set `DATABASE_URL` only when connecting to a non-default host or using a URL different from the `POSTGRES_*` settings.

`stations` stores each configured location. `air_quality_readings` is a TimescaleDB hypertable partitioned by `observed_at`, with a unique station/timestamp key and nullable pollutant values for missing API data. `ingestion_status` stores the last attempt, last successful run, counts, and the most recent error.

## Automatic ingestion

The API process owns a small scheduler, so it only runs while the server is running. A run is skipped if the previous one is still active, and graceful shutdown waits for an in-progress run before closing the database pool.

| Variable | Meaning |
| --- | --- |
| `INGEST_INTERVAL_MINUTES` | Minutes between runs. Defaults to `60`; use `0` to disable periodic runs. |
| `INGEST_ON_STARTUP` | Run once when the server starts. Defaults to `true`; accepts `true`/`false`, `1`/`0`, or `yes`/`no`. |
| `INGEST_STALE_AFTER_MINUTES` | Age after which `/api/v1/freshness` reports stale data. Defaults to `max(180, 2 × interval)`. |

Only one server instance should run ingestion against a database. Multiple API instances would each start their own scheduler, and the ingestion does not coordinate with a database lock. Set `INGEST_INTERVAL_MINUTES=0` and `INGEST_ON_STARTUP=false` on instances that should only serve reads.

The API source and supported variables are documented at [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api).

## REST API

Start the server from `server/` with `npm run dev`. The default base URL is `http://localhost:3000`.

- `GET /health` is a liveness check: it only confirms that the HTTP server is running.
- `GET /ready` is a readiness check: it runs `SELECT 1` against the database. It returns `{ "status": "ready" }` on success and HTTP 503 with a `NOT_READY` error when the database is unreachable.
- `GET /api/v1/stations` returns configured stations with their coordinates.
- `GET /api/v1/metrics` returns one record per station and hourly timestamp, including coordinates and PM2.5, PM10, NO2, and O3 values. The default time range is the previous 24 hours.
- `GET /api/v1/freshness` returns the latest observation timestamp, the last successful ingestion, the last attempt, the age in minutes, the configured stale threshold, and `isStale`. Missing ingestion history is treated as stale.

The metrics endpoint accepts these optional query parameters:

| Parameter | Meaning |
| --- | --- |
| `from` | Inclusive start time as an RFC 3339 timestamp with timezone. Must be provided together with `to`. |
| `to` | Exclusive end time as an RFC 3339 timestamp with timezone. Must be provided together with `from`. |
| `stationId` | Restrict results to a station ID, such as `madrid`. |

For example:

```text
GET /api/v1/metrics?from=2026-11-01T00:00:00Z&to=2026-11-02T00:00:00Z&stationId=madrid
```

Successful responses have a `data` array and `meta` with the effective time interval and record count. Invalid query parameters return HTTP 400; unexpected server or database errors return HTTP 500.

Freshness responses use the same success envelope:

```json
{
  "data": {
    "latestObservation": "2026-11-03T23:00:00.000Z",
    "lastIngestedAt": "2026-11-03T18:05:00.000Z",
    "lastAttemptAt": "2026-11-03T18:05:00.000Z",
    "ageMinutes": 12,
    "staleAfterMinutes": 180,
    "isStale": false
  }
}
```

The server waits up to 5 seconds to acquire a database connection and closes the pool gracefully on `SIGINT`/`SIGTERM`. Shutdown also waits for any in-progress ingestion run.
