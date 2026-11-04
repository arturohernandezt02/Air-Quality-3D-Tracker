import assert from "node:assert/strict";
import test from "node:test";
import { loadIngestionConfig } from "./ingestion.js";

test("ingestion config uses safe defaults", () => {
  assert.deepEqual(loadIngestionConfig({}), {
    intervalMinutes: 60,
    ingestOnStartup: true,
    staleAfterMinutes: 180,
  });
});

test("ingestion config derives the stale threshold from the interval", () => {
  assert.deepEqual(
    loadIngestionConfig({ INGEST_INTERVAL_MINUTES: "120" }),
    {
      intervalMinutes: 120,
      ingestOnStartup: true,
      staleAfterMinutes: 240,
    },
  );
});

test("ingestion config can disable periodic ingestion", () => {
  assert.deepEqual(
    loadIngestionConfig({
      INGEST_INTERVAL_MINUTES: "0",
      INGEST_ON_STARTUP: "false",
    }),
    {
      intervalMinutes: 0,
      ingestOnStartup: false,
      staleAfterMinutes: 180,
    },
  );
});

test("ingestion config rejects invalid values", () => {
  assert.throws(
    () => loadIngestionConfig({ INGEST_INTERVAL_MINUTES: "-1" }),
    /INGEST_INTERVAL_MINUTES/,
  );
  assert.throws(
    () => loadIngestionConfig({ INGEST_ON_STARTUP: "sometimes" }),
    /INGEST_ON_STARTUP/,
  );
});
