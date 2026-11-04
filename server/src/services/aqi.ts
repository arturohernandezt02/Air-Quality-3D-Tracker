export const AQI_POLLUTANTS = [
  "pm2_5",
  "pm10",
  "nitrogen_dioxide",
  "ozone",
] as const;

export type AqiPollutant = (typeof AQI_POLLUTANTS)[number];

export type AqiCategory =
  | "good"
  | "fair"
  | "moderate"
  | "poor"
  | "very_poor"
  | "extremely_poor";

export interface PollutantConcentrations {
  pm2_5: number | null;
  pm10: number | null;
  nitrogen_dioxide: number | null;
  ozone: number | null;
}

export interface AqiResult {
  value: number | null;
  category: AqiCategory | null;
  dominantPollutant: AqiPollutant | null;
  pollutants: Record<AqiPollutant, number | null>;
}

/**
 * Hourly concentration thresholds for the European Air Quality Index (EAQI),
 * revised by the EEA in 2024 (ETC HE Report 2024/17). Each threshold starts a
 * new band of 20 index points: 0-20 good, 20-40 fair, 40-60 moderate,
 * 60-80 poor, 80-100 very poor and above 100 extremely poor.
 */
const HOURLY_THRESHOLDS: Record<AqiPollutant, readonly number[]> = {
  pm2_5: [0, 5, 15, 50, 90, 140],
  pm10: [0, 15, 45, 120, 195, 270],
  nitrogen_dioxide: [0, 10, 25, 60, 100, 150],
  ozone: [0, 60, 100, 120, 160, 180],
};

function interpolatePosition(
  thresholds: readonly number[],
  concentration: number,
): number {
  let previous = thresholds[0];

  for (let index = 1; index < thresholds.length; index += 1) {
    const threshold = thresholds[index];
    if (concentration < threshold) {
      return index - 1 + (concentration - previous) / (threshold - previous);
    }

    previous = threshold;
  }

  const lastIndex = thresholds.length - 1;
  const slope = thresholds[lastIndex] - thresholds[lastIndex - 1];
  return lastIndex + (concentration - previous) / slope;
}

export function computePollutantAqi(
  pollutant: AqiPollutant,
  concentration: number | null,
): number | null {
  if (
    concentration === null ||
    !Number.isFinite(concentration) ||
    concentration < 0
  ) {
    return null;
  }

  return interpolatePosition(HOURLY_THRESHOLDS[pollutant], concentration) * 20;
}

export function getAqiCategory(value: number): AqiCategory {
  if (value <= 20) {
    return "good";
  }

  if (value <= 40) {
    return "fair";
  }

  if (value <= 60) {
    return "moderate";
  }

  if (value <= 80) {
    return "poor";
  }

  if (value <= 100) {
    return "very_poor";
  }

  return "extremely_poor";
}

export function computeAqi(concentrations: PollutantConcentrations): AqiResult {
  const pollutants = {} as Record<AqiPollutant, number | null>;
  let maxIndex: number | null = null;
  let dominantPollutant: AqiPollutant | null = null;

  for (const pollutant of AQI_POLLUTANTS) {
    const index = computePollutantAqi(
      pollutant,
      concentrations[pollutant],
    );
    pollutants[pollutant] = index === null ? null : Math.round(index);

    if (index !== null && (maxIndex === null || index > maxIndex)) {
      maxIndex = index;
      dominantPollutant = pollutant;
    }
  }

  const value = maxIndex === null ? null : Math.round(maxIndex);

  return {
    value,
    category: value === null ? null : getAqiCategory(value),
    dominantPollutant,
    pollutants,
  };
}
