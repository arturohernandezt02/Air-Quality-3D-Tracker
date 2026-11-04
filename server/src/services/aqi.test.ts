import assert from "node:assert/strict";
import test from "node:test";
import {
  computeAqi,
  computePollutantAqi,
  getAqiCategory,
  type PollutantConcentrations,
} from "./aqi.js";

const emptyConcentrations: PollutantConcentrations = {
  pm2_5: null,
  pm10: null,
  nitrogen_dioxide: null,
  ozone: null,
};

test("EAQI interpolates each pollutant between its hourly thresholds", () => {
  assert.equal(computePollutantAqi("pm2_5", 0), 0);
  assert.equal(computePollutantAqi("pm2_5", 2.5), 10);
  assert.equal(computePollutantAqi("pm2_5", 5), 20);
  assert.equal(computePollutantAqi("pm2_5", 10), 30);
  assert.equal(computePollutantAqi("pm2_5", 15), 40);
  assert.equal(computePollutantAqi("pm2_5", 32.5), 50);
  assert.equal(computePollutantAqi("pm2_5", 50), 60);
  assert.equal(computePollutantAqi("pm2_5", 140), 100);
  assert.equal(computePollutantAqi("pm10", 30), 30);
  assert.equal(computePollutantAqi("nitrogen_dioxide", 10), 20);
  assert.equal(computePollutantAqi("ozone", 60), 20);
});

test("EAQI extrapolates above the very poor band", () => {
  assert.equal(computePollutantAqi("pm2_5", 190), 120);
  assert.equal(computePollutantAqi("pm10", 345), 120);
  assert.equal(computePollutantAqi("nitrogen_dioxide", 200), 120);
  assert.equal(computePollutantAqi("ozone", 200), 120);
});

test("EAQI ignores missing and invalid concentrations", () => {
  assert.equal(computePollutantAqi("pm2_5", null), null);
  assert.equal(computePollutantAqi("pm2_5", -1), null);
  assert.equal(computePollutantAqi("pm2_5", Number.NaN), null);
  assert.equal(computePollutantAqi("pm2_5", Number.POSITIVE_INFINITY), null);
});

test("EAQI categories follow the 20-point bands", () => {
  assert.equal(getAqiCategory(0), "good");
  assert.equal(getAqiCategory(20), "good");
  assert.equal(getAqiCategory(20.1), "fair");
  assert.equal(getAqiCategory(40), "fair");
  assert.equal(getAqiCategory(40.1), "moderate");
  assert.equal(getAqiCategory(60), "moderate");
  assert.equal(getAqiCategory(60.1), "poor");
  assert.equal(getAqiCategory(80), "poor");
  assert.equal(getAqiCategory(80.1), "very_poor");
  assert.equal(getAqiCategory(100), "very_poor");
  assert.equal(getAqiCategory(100.1), "extremely_poor");
});

test("consolidated EAQI uses the highest pollutant sub-index", () => {
  const result = computeAqi({
    pm2_5: 10,
    pm10: 15,
    nitrogen_dioxide: 10,
    ozone: 60,
  });

  assert.deepEqual(result, {
    value: 30,
    category: "fair",
    dominantPollutant: "pm2_5",
    pollutants: {
      pm2_5: 30,
      pm10: 20,
      nitrogen_dioxide: 20,
      ozone: 20,
    },
  });
});

test("consolidated EAQI breaks ties by pollutant order", () => {
  const result = computeAqi({
    ...emptyConcentrations,
    pm10: 15,
    nitrogen_dioxide: 10,
  });

  assert.equal(result.value, 20);
  assert.equal(result.category, "good");
  assert.equal(result.dominantPollutant, "pm10");
});

test("consolidated EAQI reports extremely poor conditions", () => {
  const result = computeAqi({ ...emptyConcentrations, pm2_5: 500 });

  assert.equal(result.value, 244);
  assert.equal(result.category, "extremely_poor");
  assert.equal(result.dominantPollutant, "pm2_5");
  assert.deepEqual(result.pollutants, {
    pm2_5: 244,
    pm10: null,
    nitrogen_dioxide: null,
    ozone: null,
  });
});

test("consolidated EAQI is empty when no pollutant has a value", () => {
  assert.deepEqual(computeAqi(emptyConcentrations), {
    value: null,
    category: null,
    dominantPollutant: null,
    pollutants: {
      pm2_5: null,
      pm10: null,
      nitrogen_dioxide: null,
      ozone: null,
    },
  });
});
