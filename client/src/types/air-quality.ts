export interface AirQualityStation {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export type MetricKey = "pm2_5" | "pm10" | "nitrogen_dioxide" | "ozone";

export const METRIC_KEYS = [
  "pm2_5",
  "pm10",
  "nitrogen_dioxide",
  "ozone",
] as const satisfies readonly MetricKey[];

export type AqiCategory =
  | "good"
  | "fair"
  | "moderate"
  | "poor"
  | "very_poor"
  | "extremely_poor";

export interface AirQualityAqi {
  value: number | null;
  category: AqiCategory | null;
  dominantPollutant: MetricKey | null;
  pollutants: Record<MetricKey, number | null>;
}

export interface AirQualityReading {
  stationId: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  metrics: Record<MetricKey, number | null>;
  aqi: AirQualityAqi;
}

export interface AirQualityFreshness {
  latestObservation: string | null;
  lastIngestedAt: string | null;
  lastAttemptAt: string | null;
  ageMinutes: number | null;
  staleAfterMinutes: number;
  isStale: boolean;
}

export interface ApiData<T> {
  data: T;
}

export interface MetricApiResponse {
  data: AirQualityReading[];
  meta: {
    from: string;
    to: string;
    interval: string;
    count: number;
  };
}

export interface MetricOption {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: string;
  description: string;
}

export const METRIC_OPTIONS: MetricOption[] = [
  {
    key: "pm2_5",
    label: "PM2.5",
    shortLabel: "PM2.5",
    unit: "µg/m³",
    description: "Partículas finas",
  },
  {
    key: "pm10",
    label: "PM10",
    shortLabel: "PM10",
    unit: "µg/m³",
    description: "Partículas inhalables",
  },
  {
    key: "nitrogen_dioxide",
    label: "Dióxido de nitrógeno",
    shortLabel: "NO₂",
    unit: "µg/m³",
    description: "Tráfico y combustión",
  },
  {
    key: "ozone",
    label: "Ozono",
    shortLabel: "O₃",
    unit: "µg/m³",
    description: "Ozono troposférico",
  },
];

export type DisplayMetric = MetricKey | "aqi";

export interface DisplayMetricOption {
  key: DisplayMetric;
  label: string;
  shortLabel: string;
  unit: string;
  description: string;
}

export const DISPLAY_METRIC_OPTIONS: DisplayMetricOption[] = [
  ...METRIC_OPTIONS,
  {
    key: "aqi",
    label: "Índice AQI",
    shortLabel: "AQI",
    unit: "EAQI",
    description: "Calidad del aire (EEA)",
  },
];

