import { describe, expect, it } from "vitest";
import { buildTimeline } from "./timeline";
import type { AirQualityReading } from "../types/air-quality";

function createReading(
  stationId: string,
  observedAt: string,
  value: number,
): AirQualityReading {
  return {
    stationId,
    name: stationId,
    country: "Testland",
    latitude: 0,
    longitude: 0,
    observedAt,
    metrics: {
      pm2_5: value,
      pm10: value,
      nitrogen_dioxide: value,
      ozone: value,
    },
    aqi: {
      value,
      category: "good",
      dominantPollutant: "pm2_5",
      pollutants: {
        pm2_5: value,
        pm10: value,
        nitrogen_dioxide: value,
        ozone: value,
      },
    },
  };
}

describe("buildTimeline", () => {
  it("groups readings by hour and orders frames oldest first", () => {
    const frames = buildTimeline([
      createReading("madrid", "2026-11-02T12:00:00.000Z", 3),
      createReading("madrid", "2026-11-02T10:00:00.000Z", 1),
      createReading("paris", "2026-11-02T10:00:00.000Z", 2),
    ]);

    expect(frames).toHaveLength(2);
    expect(frames[0].timestamp).toBe("2026-11-02T10:00:00.000Z");
    expect(frames[0].readings).toHaveLength(2);
    expect(frames[1].timestamp).toBe("2026-11-02T12:00:00.000Z");
    expect(frames[1].readings[0].stationId).toBe("madrid");
  });

  it("returns no frames when there are no readings", () => {
    expect(buildTimeline([])).toEqual([]);
  });
});
