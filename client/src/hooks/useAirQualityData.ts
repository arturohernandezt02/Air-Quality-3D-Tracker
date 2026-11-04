import { useCallback, useEffect, useState } from "react";
import { AQI_CATEGORY_KEYS } from "../lib/aqi";
import type {
  AirQualityAqi,
  AirQualityFreshness,
  AirQualityReading,
  AirQualityStation,
  AqiCategory,
  MetricKey,
} from "../types/air-quality";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "/api/v1"
).replace(/\/+$/, "");
const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const METRIC_KEYS = [
  "pm2_5",
  "pm10",
  "nitrogen_dioxide",
  "ozone",
] as const satisfies readonly MetricKey[];

interface AirQualityDataState {
  requestKey: string;
  stations: AirQualityStation[];
  readings: AirQualityReading[];
  freshness: AirQualityFreshness | null;
  error: string | null;
  updatedAt: Date | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStation(value: unknown): AirQualityStation {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.country !== "string" ||
    typeof value.latitude !== "number" ||
    typeof value.longitude !== "number" ||
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude)
  ) {
    throw new Error("La API devolvió una estación con formato inválido.");
  }

  return {
    id: value.id,
    name: value.name,
    country: value.country,
    latitude: value.latitude,
    longitude: value.longitude,
  };
}

function isMetricKey(value: unknown): value is MetricKey {
  return (
    typeof value === "string" &&
    (METRIC_KEYS as readonly string[]).includes(value)
  );
}

function isAqiCategory(value: unknown): value is AqiCategory {
  return (
    typeof value === "string" &&
    (AQI_CATEGORY_KEYS as string[]).includes(value)
  );
}

function parseNullableIndex(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("La API devolvió un índice AQI con formato inválido.");
  }

  return value;
}

function parseAqi(value: unknown): AirQualityAqi {
  if (!isRecord(value) || !isRecord(value.pollutants)) {
    throw new Error("La API devolvió un índice AQI con formato inválido.");
  }

  const pollutants: AirQualityAqi["pollutants"] = {
    pm2_5: null,
    pm10: null,
    nitrogen_dioxide: null,
    ozone: null,
  };
  for (const key of METRIC_KEYS) {
    pollutants[key] = parseNullableIndex(value.pollutants[key]);
  }

  const index = parseNullableIndex(value.value);
  let category: AqiCategory | null;
  if (value.category === null) {
    category = null;
  } else if (isAqiCategory(value.category)) {
    category = value.category;
  } else {
    throw new Error("La API devolvió una categoría AQI desconocida.");
  }

  let dominantPollutant: MetricKey | null;
  if (value.dominantPollutant === null) {
    dominantPollutant = null;
  } else if (isMetricKey(value.dominantPollutant)) {
    dominantPollutant = value.dominantPollutant;
  } else {
    throw new Error("La API devolvió un contaminante dominante inválido.");
  }

  if (
    (index === null) !== (category === null) ||
    (index === null) !== (dominantPollutant === null)
  ) {
    throw new Error("La API devolvió un índice AQI incoherente.");
  }

  return { value: index, category, dominantPollutant, pollutants };
}

function parseReading(value: unknown): AirQualityReading {
  if (
    !isRecord(value) ||
    !isRecord(value.metrics) ||
    typeof value.stationId !== "string" ||
    typeof value.name !== "string" ||
    typeof value.country !== "string" ||
    typeof value.latitude !== "number" ||
    typeof value.longitude !== "number" ||
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude) ||
    typeof value.observedAt !== "string" ||
    !Number.isFinite(Date.parse(value.observedAt))
  ) {
    throw new Error("La API devolvió una lectura con formato inválido.");
  }

  const metrics: AirQualityReading["metrics"] = {
    pm2_5: null,
    pm10: null,
    nitrogen_dioxide: null,
    ozone: null,
  };
  for (const key of METRIC_KEYS) {
    const metric = value.metrics[key];
    if (
      metric !== null &&
      (typeof metric !== "number" || !Number.isFinite(metric))
    ) {
      throw new Error("La API devolvió una concentración con formato inválido.");
    }
    metrics[key] = metric;
  }

  return {
    stationId: value.stationId,
    name: value.name,
    country: value.country,
    latitude: value.latitude,
    longitude: value.longitude,
    observedAt: value.observedAt,
    metrics,
    aqi: parseAqi(value.aqi),
  };
}

function parseDataArray<T>(
  payload: unknown,
  parseItem: (value: unknown) => T,
): T[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new Error("La API devolvió una respuesta con formato inválido.");
  }

  return payload.data.map(parseItem);
}

function parseNullableTimestamp(
  value: unknown,
  field: string,
): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(
      `La API devolvió el campo de frescura "${field}" con formato inválido.`,
    );
  }

  return value;
}

function parseFreshness(payload: unknown): AirQualityFreshness {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error("La API devolvió una respuesta de frescura inválida.");
  }

  const data = payload.data;
  const ageMinutes = data.ageMinutes;
  const staleAfterMinutes = data.staleAfterMinutes;
  const isStale = data.isStale;
  if (
    (ageMinutes !== null &&
      (typeof ageMinutes !== "number" ||
        !Number.isFinite(ageMinutes) ||
        ageMinutes < 0)) ||
    typeof staleAfterMinutes !== "number" ||
    !Number.isFinite(staleAfterMinutes) ||
    staleAfterMinutes < 1 ||
    typeof isStale !== "boolean"
  ) {
    throw new Error("La API devolvió una respuesta de frescura inválida.");
  }

  return {
    latestObservation: parseNullableTimestamp(
      data.latestObservation,
      "latestObservation",
    ),
    lastIngestedAt: parseNullableTimestamp(
      data.lastIngestedAt,
      "lastIngestedAt",
    ),
    lastAttemptAt: parseNullableTimestamp(data.lastAttemptAt, "lastAttemptAt"),
    ageMinutes,
    staleAfterMinutes,
    isStale,
  };
}

async function fetchApi(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal });
  const body = await response.text();
  let payload: unknown;

  try {
    payload = JSON.parse(body);
  } catch {
    if (response.ok) {
      throw new Error("La API devolvió una respuesta con formato inválido.");
    }

    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error !== null &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : response.status === 502
          ? "No se pudo conectar con Fastify. Comprueba que el servidor esté activo en http://localhost:3000."
          : `La API respondió con el estado ${response.status}.`;

    throw new Error(message);
  }

  return payload;
}

export function useAirQualityData(
  rangeHours: number,
  stationId: string,
) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requestKey = `${rangeHours}:${stationId}:${refreshVersion}`;
  const [state, setState] = useState<AirQualityDataState>({
    requestKey: "",
    stations: [],
    readings: [],
    freshness: null,
    error: null,
    updatedAt: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    const to = new Date();
    const from = new Date(to.getTime() - rangeHours * 60 * 60 * 1000);
    const query = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
    });

    if (stationId !== "all") {
      query.set("stationId", stationId);
    }

    void Promise.all([
      fetchApi(`${API_BASE_URL}/stations`, controller.signal),
      fetchApi(
        `${API_BASE_URL}/metrics?${query.toString()}`,
        controller.signal,
      ),
      fetchApi(`${API_BASE_URL}/freshness`, controller.signal),
    ])
      .then(([stationsResponse, metricsResponse, freshnessResponse]) => {
        setState({
          requestKey,
          stations: parseDataArray(stationsResponse, parseStation),
          readings: parseDataArray(metricsResponse, parseReading),
          freshness: parseFreshness(freshnessResponse),
          error: null,
          updatedAt: new Date(),
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState((previous) => ({
          ...previous,
          requestKey,
          error:
            error instanceof Error
              ? error.message
              : "No se pudieron cargar los datos de calidad del aire.",
        }));
      });

    return () => controller.abort();
  }, [rangeHours, requestKey, stationId, refreshVersion]);

  const refresh = useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRefreshVersion((version) => version + 1);
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const { requestKey: completedRequestKey, ...data } = state;
  return {
    ...data,
    isLoading: completedRequestKey !== requestKey,
    refresh,
  };
}
