import { describe, expect, it } from "vitest";
import {
  getAverage,
  getDominantPollutant,
  getPeak,
  getReadingValue,
} from "./readings";
import type { AirQualityReading } from "../types/air-quality";

function createReading(
  pm2_5: number | null,
  ozone: number | null,
): AirQualityReading {
  return {
    stationId: "madrid",
    name: "Madrid",
    country: "Spain",
    latitude: 40.4168,
    longitude: -3.7038,
    observedAt: "2026-11-02T10:00:00.000Z",
    metrics: {
      pm2_5,
      pm10: null,
      nitrogen_dioxide: null,
      ozone,
    },
    aqi: {
      value: pm2_5,
      category: "good",
      dominantPollutant: pm2_5 === null ? null : "pm2_5",
      pollutants: {
        pm2_5,
        pm10: null,
        nitrogen_dioxide: null,
        ozone,
      },
    },
  };
}

describe("reading helpers", () => {
  it("reads AQI or pollutant values", () => {
    const reading = createReading(12, 40);

    expect(getReadingValue(reading, "pm2_5")).toBe(12);
    expect(getReadingValue(reading, "aqi")).toBe(12);
  });

  it("ignores missing values when averaging and peaking", () => {
    const readings = [createReading(10, 40), createReading(null, 60)];

    expect(getAverage(readings, "pm2_5")).toBe(10);
    expect(getAverage(readings, "ozone")).toBe(50);
    expect(getPeak(readings, "pm2_5")).toBe(10);
    expect(getPeak(readings, "ozone")).toBe(60);
  });

  it("uses the highest sub-index as the dominant pollutant", () => {
    expect(getDominantPollutant([createReading(10, 80)])).toBe("ozone");
    expect(getDominantPollutant([createReading(null, null)])).toBeNull();
  });
});
