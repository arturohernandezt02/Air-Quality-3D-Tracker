import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAirQualityUrl,
  buildAirQualityUrlBatch,
  fetchHourlyObservationsBatch,
  parseBatchObservations,
  parseHourlyObservations,
} from "./open-meteo.js";

function hourlyPayload(pm2_5: (number | null)[]) {
  return {
    hourly: {
      time: pm2_5.map((_, index) => 1_767_225_600 + index * 3_600),
      pm2_5,
      pm10: pm2_5,
      nitrogen_dioxide: pm2_5,
      ozone: pm2_5,
    },
  };
}

test("requests 72 hours so the 48-hour dashboard window is fully covered", () => {
  const url = buildAirQualityUrl({
    id: "madrid",
    name: "Madrid",
    country: "Spain",
    latitude: 40.4168,
    longitude: -3.7038,
  });

  assert.equal(
    url.origin + url.pathname,
    "https://air-quality-api.open-meteo.com/v1/air-quality",
  );
  assert.equal(url.searchParams.get("latitude"), "40.4168");
  assert.equal(url.searchParams.get("longitude"), "-3.7038");
  assert.equal(
    url.searchParams.get("hourly"),
    "pm2_5,pm10,nitrogen_dioxide,ozone",
  );
  assert.equal(url.searchParams.get("past_days"), "2");
  assert.equal(url.searchParams.get("forecast_days"), "1");
  assert.equal(url.searchParams.get("timezone"), "UTC");
  assert.equal(url.searchParams.get("timeformat"), "unixtime");
});

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

test("builds a single request for a batch of coordinates", () => {
  const url = buildAirQualityUrlBatch([
    {
      id: "madrid",
      name: "Madrid",
      country: "Spain",
      latitude: 40.4168,
      longitude: -3.7038,
    },
    {
      id: "mexico-city",
      name: "Mexico City",
      country: "Mexico",
      latitude: 19.4326,
      longitude: -99.1332,
    },
  ]);

  assert.equal(url.searchParams.get("latitude"), "40.4168,19.4326");
  assert.equal(url.searchParams.get("longitude"), "-3.7038,-99.1332");
  assert.equal(url.searchParams.get("past_days"), "2");
  assert.equal(url.searchParams.get("forecast_days"), "1");
});

test("maps batched payloads by request order", () => {
  const observations = parseBatchObservations(
    [hourlyPayload([1, 2]), hourlyPayload([3, null])],
    2,
  );

  assert.equal(observations.length, 2);
  assert.equal(observations[0][0].pm2_5, 1);
  assert.equal(observations[1][0].pm2_5, 3);
  assert.equal(observations[1][1].pm2_5, null);
});

test("accepts a single object for a one-location batch", () => {
  const observations = parseBatchObservations(hourlyPayload([7]), 1);

  assert.equal(observations.length, 1);
  assert.equal(observations[0][0].pm2_5, 7);
});

test("rejects a payload whose location count does not match the request", () => {
  assert.throws(
    () => parseBatchObservations(hourlyPayload([1]), 2),
    /returned 1 location payloads for 2 requested locations/,
  );
});

test("fetches batches and associates observations with each location", async () => {
  const locations = [
    {
      id: "madrid",
      name: "Madrid",
      country: "Spain",
      latitude: 40.4168,
      longitude: -3.7038,
    },
    {
      id: "mexico-city",
      name: "Mexico City",
      country: "Mexico",
      latitude: 19.4326,
      longitude: -99.1332,
    },
  ];
  let requestedUrl = "";

  const result = await fetchHourlyObservationsBatch(
    locations,
    async (input) => {
      requestedUrl = input.toString();
      return new Response(
        JSON.stringify([hourlyPayload([4, 5]), hourlyPayload([6, 7])]),
        { status: 200 },
      );
    },
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].location.id, "madrid");
  assert.equal(result[0].observations[0].pm2_5, 4);
  assert.equal(result[1].location.id, "mexico-city");
  assert.equal(result[1].observations[1].pm2_5, 7);
  assert.match(requestedUrl, /latitude=40\.4168%2C19\.4326/);
});

test("surfaces batch HTTP failures with the status code", async () => {
  await assert.rejects(
    fetchHourlyObservationsBatch(
      [
        {
          id: "madrid",
          name: "Madrid",
          country: "Spain",
          latitude: 40.4168,
          longitude: -3.7038,
        },
      ],
      async () => new Response("rate limited", { status: 429 }),
    ),
    /HTTP 429/,
  );
});
