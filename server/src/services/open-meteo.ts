import type { AirQualityLocation } from "../config/locations.js";

const AIR_QUALITY_API_URL =
  "https://air-quality-api.open-meteo.com/v1/air-quality";
const HOURLY_VARIABLES = "pm2_5,pm10,nitrogen_dioxide,ozone";
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Number of coordinates sent in a single Open-Meteo request. Keeping batches
 * small keeps the response payload predictable and avoids oversized URLs.
 */
export const LOCATION_BATCH_SIZE = 25;

export interface HourlyObservation {
  observedAt: Date;
  pm2_5: number | null;
  pm10: number | null;
  nitrogen_dioxide: number | null;
  ozone: number | null;
}

export interface LocationObservations {
  location: AirQualityLocation;
  observations: HourlyObservation[];
}

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

interface HourlyResponse {
  time: number[];
  pm2_5: (number | null)[];
  pm10: (number | null)[];
  nitrogen_dioxide: (number | null)[];
  ozone: (number | null)[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(
    (item) => typeof item === "number" && Number.isFinite(item),
  );
}

function isNullableNumberArray(value: unknown): value is (number | null)[] {
  return Array.isArray(value) && value.every(
    (item) => item === null || (typeof item === "number" && Number.isFinite(item)),
  );
}

function parseHourlyResponse(payload: unknown): HourlyResponse {
  if (!isRecord(payload) || !isRecord(payload.hourly)) {
    throw new Error("Open-Meteo response is missing the hourly data object.");
  }

  const hourly = payload.hourly;
  const time = hourly.time;
  const pm2_5 = hourly.pm2_5;
  const pm10 = hourly.pm10;
  const nitrogenDioxide = hourly.nitrogen_dioxide;
  const ozone = hourly.ozone;

  if (
    !isNumberArray(time) ||
    !isNullableNumberArray(pm2_5) ||
    !isNullableNumberArray(pm10) ||
    !isNullableNumberArray(nitrogenDioxide) ||
    !isNullableNumberArray(ozone)
  ) {
    throw new Error("Open-Meteo response contains invalid hourly values.");
  }

  if (
    time.length === 0 ||
    pm2_5.length !== time.length ||
    pm10.length !== time.length ||
    nitrogenDioxide.length !== time.length ||
    ozone.length !== time.length
  ) {
    throw new Error("Open-Meteo response hourly arrays are empty or have mismatched lengths.");
  }

  return {
    time,
    pm2_5,
    pm10,
    nitrogen_dioxide: nitrogenDioxide,
    ozone,
  };
}

export function parseHourlyObservations(payload: unknown): HourlyObservation[] {
  const hourly = parseHourlyResponse(payload);

  return hourly.time.map((timestamp, index) => {
    const observedAt = new Date(timestamp * 1000);
    if (!Number.isFinite(observedAt.getTime())) {
      throw new Error(`Open-Meteo returned an invalid timestamp at index ${index}.`);
    }

    return {
      observedAt,
      pm2_5: hourly.pm2_5[index],
      pm10: hourly.pm10[index],
      nitrogen_dioxide: hourly.nitrogen_dioxide[index],
      ozone: hourly.ozone[index],
    };
  });
}

/**
 * Open-Meteo returns a single object for one coordinate and an array of
 * objects (in request order) for multiple coordinates.
 */
export function parseBatchObservations(
  payload: unknown,
  locationCount: number,
): HourlyObservation[][] {
  if (!Number.isInteger(locationCount) || locationCount < 1) {
    throw new Error("At least one location is required to parse a batch response.");
  }

  const entries = Array.isArray(payload) ? payload : [payload];
  if (entries.length !== locationCount) {
    throw new Error(
      `Open-Meteo returned ${entries.length} location payloads for ${locationCount} requested locations.`,
    );
  }

  return entries.map(parseHourlyObservations);
}

function buildAirQualityUrlFor(locations: AirQualityLocation[]): URL {
  if (locations.length === 0) {
    throw new Error("At least one location is required to build a request.");
  }

  const url = new URL(AIR_QUALITY_API_URL);
  url.searchParams.set(
    "latitude",
    locations.map((location) => String(location.latitude)).join(","),
  );
  url.searchParams.set(
    "longitude",
    locations.map((location) => String(location.longitude)).join(","),
  );
  url.searchParams.set("hourly", HOURLY_VARIABLES);
  // Request 72 hours (the two previous days plus the current day) so the
  // client's 48-hour window is fully covered even on the first ingestion.
  url.searchParams.set("past_days", "2");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("timeformat", "unixtime");

  return url;
}

export function buildAirQualityUrl(location: AirQualityLocation): URL {
  return buildAirQualityUrlFor([location]);
}

export function buildAirQualityUrlBatch(
  locations: AirQualityLocation[],
): URL {
  return buildAirQualityUrlFor(locations);
}

export async function fetchHourlyObservationsBatch(
  locations: AirQualityLocation[],
  fetcher: FetchLike = fetch,
): Promise<LocationObservations[]> {
  if (locations.length === 0) {
    return [];
  }

  const url = buildAirQualityUrlBatch(locations);
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `Open-Meteo batch request for ${locations.length} location(s) failed with HTTP ${response.status}: ${responseBody.slice(0, 300)}`,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseBody);
  } catch (error) {
    throw new Error("Open-Meteo returned invalid JSON for a location batch.", {
      cause: error,
    });
  }

  const observationsByLocation = parseBatchObservations(
    payload,
    locations.length,
  );

  return locations.map((location, index) => ({
    location,
    observations: observationsByLocation[index],
  }));
}

export async function fetchHourlyObservations(
  location: AirQualityLocation,
  fetcher: FetchLike = fetch,
): Promise<HourlyObservation[]> {
  const [result] = await fetchHourlyObservationsBatch([location], fetcher);
  return result.observations;
}
