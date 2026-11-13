import { describe, expect, it } from "vitest";
import { filterStations, normalizeSearch } from "./filter-stations";
import type { AirQualityStation } from "../types/air-quality";

const stations: AirQualityStation[] = [
  {
    id: "bogota",
    name: "Bogotá",
    country: "Colombia",
    latitude: 4.711,
    longitude: -74.0721,
  },
  {
    id: "sao-paulo",
    name: "São Paulo",
    country: "Brazil",
    latitude: -23.5505,
    longitude: -46.6333,
  },
  {
    id: "madrid",
    name: "Madrid",
    country: "Spain",
    latitude: 40.4168,
    longitude: -3.7038,
  },
];

describe("filterStations", () => {
  it("matches names without accents", () => {
    expect(filterStations(stations, "bogota").map((station) => station.id)).toEqual([
      "bogota",
    ]);
  });

  it("matches countries and is case-insensitive", () => {
    expect(filterStations(stations, "BRAZIL").map((station) => station.id)).toEqual([
      "sao-paulo",
    ]);
  });

  it("returns every station for an empty query", () => {
    expect(filterStations(stations, "  ")).toHaveLength(stations.length);
  });

  it("returns no stations when nothing matches", () => {
    expect(filterStations(stations, "reykjavik")).toEqual([]);
  });
});

describe("normalizeSearch", () => {
  it("removes diacritics and trims", () => {
    expect(normalizeSearch("  São Paulo ")).toBe("sao paulo");
  });
});
