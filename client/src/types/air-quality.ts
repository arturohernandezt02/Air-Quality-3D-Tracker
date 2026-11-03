export interface AirQualityStation {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
}

export type MetricKey = "pm2_5" | "pm10" | "nitrogen_dioxide" | "ozone";

export interface AirQualityReading {
  stationId: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  metrics: Record<MetricKey, number | null>;
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
