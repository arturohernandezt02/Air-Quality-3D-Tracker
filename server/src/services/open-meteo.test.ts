import assert from "node:assert/strict";
import test from "node:test";
import { parseHourlyObservations } from "./open-meteo.js";

test("parses hourly pollutant values and Unix timestamps", () => {
  const observations = parseHourlyObservations({
    hourly: {
      time: [1_767_225_600, 1_767_229_200],
      pm2_5: [12.4, null],
      pm10: [21.1, 18.2],
      nitrogen_dioxide: [4.5, 4.1],
      ozone: [32.7, 33.2],
    },
  });

  assert.equal(observations.length, 2);
  assert.equal(observations[0].observedAt.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(observations[0].pm2_5, 12.4);
  assert.equal(observations[1].pm2_5, null);
  assert.equal(observations[1].ozone, 33.2);
});

test("rejects hourly arrays with mismatched lengths", () => {
  assert.throws(
    () =>
      parseHourlyObservations({
        hourly: {
          time: [1_767_360_000],
          pm2_5: [],
          pm10: [1],
          nitrogen_dioxide: [1],
          ozone: [1],
        },
      }),
    /invalid hourly values|mismatched lengths/,
  );
});
