import assert from "node:assert/strict";
import test from "node:test";
import type { Kysely } from "kysely";
import type { AirQualityLocation } from "../config/locations.js";
import type { AirQualityDatabase } from "../db/types.js";
import type { IngestionResult } from "./ingestion.js";
import {
  startIngestionScheduler,
  type IngestionLogger,
} from "./ingestion-scheduler.js";

const database = {} as Kysely<AirQualityDatabase>;
const locations: AirQualityLocation[] = [
  {
    id: "madrid",
    name: "Madrid",
    country: "Spain",
    latitude: 40.4168,
    longitude: -3.7038,
  },
];
const result: IngestionResult = {
  startedAt: new Date("2026-11-02T18:00:00.000Z"),
  completedAt: new Date("2026-11-02T18:00:05.000Z"),
  locations: [
    {
      locationId: "madrid",
      locationName: "Madrid",
      readingCount: 72,
    },
  ],
  readingCount: 72,
};

function createLogger() {
  const records: string[] = [];
  const logger: IngestionLogger = {
    info(_details, message) {
      records.push(`info:${message}`);
    },
    warn(_details, message) {
      records.push(`warn:${message}`);
    },
    error(_details, message) {
      records.push(`error:${message}`);
    },
  };
  return { logger, records };
}

test("ingestion scheduler runs on demand and logs the result", async () => {
  const { logger, records } = createLogger();
  let calls = 0;
  const scheduler = startIngestionScheduler({
    database,
    locations,
    config: {
      intervalMinutes: 0,
      ingestOnStartup: false,
      staleAfterMinutes: 180,
    },
    logger,
    ingest: async () => {
      calls += 1;
      return result;
    },
  });

  await scheduler.runNow();
  await scheduler.stop();

  assert.equal(calls, 1);
  assert.deepEqual(records, [
    "info:Air-quality ingestion scheduler started.",
    "info:Air-quality ingestion completed.",
  ]);
});

test("ingestion scheduler skips overlapping runs", async () => {
  const { logger, records } = createLogger();
  let resolveIngestion: ((value: IngestionResult) => void) | undefined;
  const pendingIngestion = new Promise<IngestionResult>((resolve) => {
    resolveIngestion = resolve;
  });
  const scheduler = startIngestionScheduler({
    database,
    locations,
    config: {
      intervalMinutes: 0,
      ingestOnStartup: false,
      staleAfterMinutes: 180,
    },
    logger,
    ingest: () => pendingIngestion,
  });

  const firstRun = scheduler.runNow();
  const secondRun = scheduler.runNow();
  resolveIngestion?.(result);
  await Promise.all([firstRun, secondRun]);
  await scheduler.stop();

  assert.equal(
    records.filter((record) =>
      record.includes("previous run is still active"),
    ).length,
    1,
  );
});
