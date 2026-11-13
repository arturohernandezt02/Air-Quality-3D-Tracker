import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOCATIONS } from "./locations-data.js";
import { loadLocations } from "./locations.js";

test("the default catalogue covers at least 60 cities", () => {
  assert.ok(
    DEFAULT_LOCATIONS.length >= 60,
    `Expected at least 60 default locations, received ${DEFAULT_LOCATIONS.length}.`,
  );
});

test("the default catalogue has unique ids and valid coordinates", () => {
  const ids = new Set(DEFAULT_LOCATIONS.map((location) => location.id));
  assert.equal(ids.size, DEFAULT_LOCATIONS.length);

  for (const location of DEFAULT_LOCATIONS) {
    assert.match(location.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(location.latitude >= -90 && location.latitude <= 90);
    assert.ok(location.longitude >= -180 && location.longitude <= 180);
  }

  const loaded = loadLocations(JSON.stringify(DEFAULT_LOCATIONS));
  assert.equal(loaded.length, DEFAULT_LOCATIONS.length);
});

test("the environment variable replaces the default catalogue", () => {
  const loaded = loadLocations(
    JSON.stringify([
      {
        id: "reykjavik",
        name: "Reykjavik",
        country: "Iceland",
        latitude: 64.1466,
        longitude: -21.9426,
      },
    ]),
  );

  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, "reykjavik");
});

test("duplicate ids are rejected", () => {
  assert.throws(
    () =>
      loadLocations(
        JSON.stringify([
          {
            id: "madrid",
            name: "Madrid",
            country: "Spain",
            latitude: 40.4168,
            longitude: -3.7038,
          },
          {
            id: "madrid",
            name: "Madrid duplicate",
            country: "Spain",
            latitude: 40.4168,
            longitude: -3.7038,
          },
        ]),
      ),
    /Duplicate location id/,
  );
});
