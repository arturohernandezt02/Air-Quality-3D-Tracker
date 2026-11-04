import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../app.js";
import type {
  AirQualityRepository,
  FreshnessRecord,
  MetricRecord,
  MetricsQuery,
  StationRecord,
} from "../db/repository.js";

const now = new Date("2026-11-02T18:00:00.000Z");
const station: StationRecord = {
  id: "madrid",
  name: "Madrid",
  country: "Spain",
  latitude: 40.4168,
  longitude: -3.7038,
};
const reading: MetricRecord = {
  ...station,
  observedAt: new Date("2026-11-02T17:00:00.000Z"),
  pm2_5: 12.4,
  pm10: 21.1,
  nitrogen_dioxide: 4.5,
  ozone: 32.7,
};
const freshness: FreshnessRecord = {
  latestObservation: new Date("2026-11-02T17:00:00.000Z"),
  lastIngestedAt: new Date("2026-11-02T17:30:00.000Z"),
  lastAttemptAt: new Date("2026-11-02T17:30:00.000Z"),
};

function createRepository(
  metrics: MetricRecord[] = [reading],
  freshnessRecord: FreshnessRecord = freshness,
): AirQualityRepository & { lastQuery?: MetricsQuery } {
  const repository: AirQualityRepository & { lastQuery?: MetricsQuery } = {
    async listStations() {
      return [station];
    },
    async listMetrics(query) {
      repository.lastQuery = query;
      return metrics;
    },
    async getFreshness() {
      return freshnessRecord;
    },
  };
  return repository;
}

function createTestApp(
  repository: AirQualityRepository,
  options: {
    checkReadiness?: () => Promise<void>;
    staleAfterMinutes?: number;
  } = {},
) {
  const app = createApp(repository, () => now, options);
  app.log.level = "silent";
  return app;
}

test("GET /api/v1/stations returns known locations", async () => {
  const app = createTestApp(createRepository());
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/stations",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { data: [station] });
  } finally {
    await app.close();
  }
});

test("GET /health continues to report server status", async () => {
  const app = createTestApp(createRepository());
  try {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  } finally {
    await app.close();
  }
});

test("GET /ready reports readiness when the database responds", async () => {
  const app = createTestApp(createRepository(), {
    checkReadiness: async () => {},
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ready" });
  } finally {
    await app.close();
  }
});

test("GET /ready returns 503 when the database is unavailable", async () => {
  const app = createTestApp(createRepository(), {
    checkReadiness: async () => {
      throw new Error("database unavailable");
    },
  });
  try {
    const response = await app.inject({
      method: "GET",
      url: "/ready",
    });

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), {
      error: {
        code: "NOT_READY",
        message: "Database is not available.",
      },
    });
  } finally {
    await app.close();
  }
});

test("GET /api/v1/freshness reports the latest ingestion and observation", async () => {
  const app = createTestApp(createRepository());
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/freshness",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      data: {
        latestObservation: "2026-11-02T17:00:00.000Z",
        lastIngestedAt: "2026-11-02T17:30:00.000Z",
        lastAttemptAt: "2026-11-02T17:30:00.000Z",
        ageMinutes: 30,
        staleAfterMinutes: 180,
        isStale: false,
      },
    });
  } finally {
    await app.close();
  }
});

test("GET /api/v1/freshness marks old or missing ingestions as stale", async () => {
  const oldRepository = createRepository([reading], {
    latestObservation: new Date("2026-11-02T13:00:00.000Z"),
    lastIngestedAt: new Date("2026-11-02T13:00:00.000Z"),
    lastAttemptAt: new Date("2026-11-02T13:00:00.000Z"),
  });
  const emptyRepository = createRepository([], {
    latestObservation: null,
    lastIngestedAt: null,
    lastAttemptAt: null,
  });
  const oldApp = createTestApp(oldRepository, { staleAfterMinutes: 120 });
  const emptyApp = createTestApp(emptyRepository);
  try {
    const oldResponse = await oldApp.inject({
      method: "GET",
      url: "/api/v1/freshness",
    });
    const emptyResponse = await emptyApp.inject({
      method: "GET",
      url: "/api/v1/freshness",
    });

    assert.deepEqual(oldResponse.json(), {
      data: {
        latestObservation: "2026-11-02T13:00:00.000Z",
        lastIngestedAt: "2026-11-02T13:00:00.000Z",
        lastAttemptAt: "2026-11-02T13:00:00.000Z",
        ageMinutes: 300,
        staleAfterMinutes: 120,
        isStale: true,
      },
    });
    assert.deepEqual(emptyResponse.json(), {
      data: {
        latestObservation: null,
        lastIngestedAt: null,
        lastAttemptAt: null,
        ageMinutes: null,
        staleAfterMinutes: 180,
        isStale: true,
      },
    });
  } finally {
    await oldApp.close();
    await emptyApp.close();
  }
});

test("API allows the configured frontend origin", async () => {
  const app = createTestApp(createRepository());
  try {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/stations",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "GET",
      },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(
      response.headers["access-control-allow-origin"],
      "http://localhost:5173",
    );
  } finally {
    await app.close();
  }
});

test("GET /api/v1/metrics returns map coordinates and hourly pollutant values", async () => {
  const repository = createRepository();
  const app = createTestApp(repository);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/metrics",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      data: [
        {
          stationId: "madrid",
          name: "Madrid",
          country: "Spain",
          latitude: 40.4168,
          longitude: -3.7038,
          observedAt: "2026-11-02T17:00:00.000Z",
          metrics: {
            pm2_5: 12.4,
            pm10: 21.1,
            nitrogen_dioxide: 4.5,
            ozone: 32.7,
          },
        },
      ],
      meta: {
        from: "2026-11-01T18:00:00.000Z",
        to: "2026-11-02T18:00:00.000Z",
        interval: "[from, to)",
        count: 1,
      },
    });
    assert.deepEqual(repository.lastQuery, {
      from: new Date("2026-11-01T18:00:00.000Z"),
      to: now,
    });
  } finally {
    await app.close();
  }
});

test("GET /api/v1/metrics applies an explicit time range and station filter", async () => {
  const repository = createRepository([]);
  const app = createTestApp(repository);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/metrics?from=2026-11-01T00%3A00%3A00Z&to=2026-11-02T00%3A00%3A00Z&stationId=madrid",
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(repository.lastQuery, {
      from: new Date("2026-11-01T00:00:00.000Z"),
      to: new Date("2026-11-02T00:00:00.000Z"),
      stationId: "madrid",
    });
    assert.equal(response.json().meta.count, 0);
  } finally {
    await app.close();
  }
});

test("GET /api/v1/metrics rejects incomplete, invalid, and reversed time ranges", async () => {
  const repository = createRepository();
  const app = createTestApp(repository);
  try {
    const cases = [
      "/api/v1/metrics?from=2026-11-01T00%3A00%3A00Z",
      "/api/v1/metrics?from=not-a-date&to=2026-11-02T00%3A00%3A00Z",
      "/api/v1/metrics?from=2026-02-30T00%3A00%3A00Z&to=2026-03-02T00%3A00%3A00Z",
      "/api/v1/metrics?from=2026-11-02T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z",
      "/api/v1/metrics?unexpected=value",
    ];

    for (const url of cases) {
      const response = await app.inject({ method: "GET", url });
      assert.equal(response.statusCode, 400, url);
      assert.equal(response.json().error.code, "INVALID_QUERY", url);
    }

    assert.equal(repository.lastQuery, undefined);
  } finally {
    await app.close();
  }
});

test("GET /api/v1/metrics returns a generic server error when the repository fails", async () => {
  const repository = createRepository();
  repository.listMetrics = async () => {
    throw new Error("database credentials must not be exposed");
  };
  const app = createTestApp(repository);
  try {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/metrics",
    });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.json(), {
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  } finally {
    await app.close();
  }
});
