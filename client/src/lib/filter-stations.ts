import type { AirQualityStation } from "../types/air-quality";

export function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filterStations(
  stations: AirQualityStation[],
  query: string,
): AirQualityStation[] {
  const term = normalizeSearch(query);
  if (term === "") {
    return stations;
  }

  return stations.filter((station) =>
    normalizeSearch(`${station.name} ${station.country}`).includes(term),
  );
}
