import assert from "node:assert/strict";
import test from "node:test";
import type { AirQualityLocation } from "../config/locations.js";
import type { HourlyObservation } from "./open-meteo.js";
import {
  chunkLocations,
  fetchObservationsForLocations,
} from "./ingestion.js";

function createLocation(index: number): AirQualityLocation {
  return {
    id: `city-${index}`,
    name: `City ${index}`,
    country: "Testland",
    latitude: index,
    longitude: -index,
  };
}

function createObservations(instant: Date): HourlyObservation[] {
  return [
    {
      observedAt: instant,
      pm2_5: 10,
      pm10: 20,
      nitrogen_dioxide: 5,
      ozone: 30,
    },
  ];
}

test("chunks locations into bounded batches", () => {
  const locations = Array.from({ length: 5 }, (_, index) =>
    createLocation(index),
  );

  const batches = chunkLocations(locations, 2);

  assert.deepEqual(
    batches.map((batch) => batch.map((location) => location.id)),
    [
      ["city-0", "city-1"],
      ["city-2", "city-3"],
      ["city-4"],
    ],
  );
});

test("rejects non-positive batch sizes", () => {
  const locations = [createLocation(0)];

  assert.throws(() => chunkLocations(locations, 0), /positive integer/);
  assert.throws(() => chunkLocations(locations, 1.5), /positive integer/);
});

test("fetches every location exactly once across batches", async () => {
  const locations = Array.from({ length: 30 }, (_, index) =>
    createLocation(index),
  );
  const batches: string[][] = [];
  const instant = new Date("2026-11-02T12:00:00.000Z");

  const result = await fetchObservationsForLocations(
    locations,
    async (batch) => {
      batches.push(batch.map((location) => location.id));
      return batch.map((location) => ({
        location,
        observations: createObservations(instant),
      }));
    },
  );

  assert.deepEqual(
    batches.map((batch) => batch.length),
    [25, 5],
  );
  assert.equal(result.length, locations.length);
  assert.deepEqual(
    result.map((entry) => entry.location.id),
    locations.map((location) => location.id),
  );
});

test("returns no results and makes no requests for an empty location list", async () => {
  let calls = 0;

  const result = await fetchObservationsForLocations([], async () => {
    calls += 1;
    return [];
  });

  assert.deepEqual(result, []);
  assert.equal(calls, 0);
});
