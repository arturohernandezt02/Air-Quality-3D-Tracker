import type { AqiCategory } from "../types/air-quality";

export const AQI_CATEGORY_LABELS: Record<AqiCategory, string> = {
  good: "Buena",
  fair: "Aceptable",
  moderate: "Moderada",
  poor: "Mala",
  very_poor: "Muy mala",
  extremely_poor: "Extremadamente mala",
};

export const AQI_CATEGORY_KEYS = Object.keys(
  AQI_CATEGORY_LABELS,
) as AqiCategory[];

export const AQI_CATEGORY_STYLES: Record<
  AqiCategory,
  { text: string; dot: string }
> = {
  good: { text: "text-emerald-600", dot: "bg-emerald-500" },
  fair: { text: "text-lime-600", dot: "bg-lime-500" },
  moderate: { text: "text-amber-600", dot: "bg-amber-500" },
  poor: { text: "text-orange-600", dot: "bg-orange-500" },
  very_poor: { text: "text-rose-600", dot: "bg-rose-500" },
  extremely_poor: { text: "text-purple-700", dot: "bg-purple-500" },
};

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

/** Official European AQI band colours, from good to extremely poor. */
export const AQI_BAND_COLORS = [
  "#50f0e6",
  "#50ccaa",
  "#f0e641",
  "#ff5050",
  "#960032",
  "#7d2181",
] as const;

export const AQI_COLOR_RANGE: [number, number, number, number][] = [
  [80, 240, 230, 150],
  [80, 204, 170, 180],
  [240, 230, 65, 200],
  [255, 80, 80, 225],
  [150, 0, 50, 235],
  [125, 33, 129, 245],
];

export const AQI_LEGEND_GRADIENT = `linear-gradient(90deg, ${AQI_BAND_COLORS.map(
  (color, index) =>
    `${color} ${(index / AQI_BAND_COLORS.length) * 100}% ${
      ((index + 1) / AQI_BAND_COLORS.length) * 100
    }%`,
).join(", ")})`;

export const AQI_SCALE_STOPS = ["0", "20", "40", "60", "80", "100+"];
