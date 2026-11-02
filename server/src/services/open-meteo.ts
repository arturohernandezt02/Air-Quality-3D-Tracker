import type { AirQualityLocation } from "../config/locations.js";

const AIR_QUALITY_API_URL =
  "https://air-quality-api.open-meteo.com/v1/air-quality";

export interface HourlyObservation {
  observedAt: Date;
  pm2_5: number | null;
  pm10: number | null;
  nitrogen_dioxide: number | null;
  ozone: number | null;
}

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

export async function fetchHourlyObservations(
  location: AirQualityLocation,
): Promise<HourlyObservation[]> {
  const url = new URL(AIR_QUALITY_API_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("hourly", "pm2_5,pm10,nitrogen_dioxide,ozone");
  url.searchParams.set("past_days", "1");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("timeformat", "unixtime");

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(
      `Open-Meteo request for ${location.id} failed with HTTP ${response.status}: ${responseBody.slice(0, 300)}`,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseBody);
  } catch (error) {
    throw new Error(`Open-Meteo returned invalid JSON for ${location.id}.`, {
      cause: error,
    });
  }

  return parseHourlyObservations(payload);
}
