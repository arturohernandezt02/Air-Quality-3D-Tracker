import type {
  AirQualityReading,
  DisplayMetric,
  MetricKey,
} from "../types/air-quality";
import { METRIC_KEYS } from "../types/air-quality";

export function getReadingValue(
  reading: AirQualityReading,
  metric: DisplayMetric,
): number | null {
  return metric === "aqi" ? reading.aqi.value : reading.metrics[metric];
}

export function getAverageValue(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function getAverage(
  readings: AirQualityReading[],
  metric: DisplayMetric,
): number | null {
  return getAverageValue(
    readings
      .map((reading) => getReadingValue(reading, metric))
      .filter((value): value is number => value !== null),
  );
}

export function getPeak(
  readings: AirQualityReading[],
  metric: DisplayMetric,
): number | null {
  const values = readings
    .map((reading) => getReadingValue(reading, metric))
    .filter((value): value is number => value !== null);

  return values.length === 0 ? null : Math.max(...values);
}

export function getAverageSubIndex(
  readings: AirQualityReading[],
  metric: MetricKey,
): number | null {
  return getAverageValue(
    readings
      .map((reading) => reading.aqi.pollutants[metric])
      .filter((value): value is number => value !== null),
  );
}

export function getPollutantBreakdown(
  readings: AirQualityReading[],
): { metric: MetricKey; value: number | null }[] {
  return METRIC_KEYS.map((metric) => ({
    metric,
    value: getAverageSubIndex(readings, metric),
  }));
}

export function getDominantPollutant(
  readings: AirQualityReading[],
): MetricKey | null {
  let best: { metric: MetricKey; value: number } | null = null;

  for (const entry of getPollutantBreakdown(readings)) {
    if (entry.value === null) {
      continue;
    }

    if (best === null || entry.value > best.value) {
      best = { metric: entry.metric, value: entry.value };
    }
  }

  return best?.metric ?? null;
}

export function formatNumber(value: number | null, digits = 1): string {
  return value === null ? "—" : value.toFixed(digits);
}
