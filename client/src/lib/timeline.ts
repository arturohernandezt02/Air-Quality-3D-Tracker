import type { AirQualityReading } from "../types/air-quality";

export interface TimelineFrame {
  timestamp: string;
  readings: AirQualityReading[];
}

/**
 * Groups the readings into hourly frames ordered from oldest to newest so the
 * map can play the window back like a small time machine.
 */
export function buildTimeline(
  readings: AirQualityReading[],
): TimelineFrame[] {
  const byTimestamp = new Map<string, AirQualityReading[]>();

  for (const reading of readings) {
    const existing = byTimestamp.get(reading.observedAt);
    if (existing === undefined) {
      byTimestamp.set(reading.observedAt, [reading]);
    } else {
      existing.push(reading);
    }
  }

  return Array.from(byTimestamp.entries())
    .sort(
      ([leftTimestamp], [rightTimestamp]) =>
        Date.parse(leftTimestamp) - Date.parse(rightTimestamp),
    )
    .map(([timestamp, frameReadings]) => ({
      timestamp,
      readings: frameReadings,
    }));
}

export function formatObservationTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) {
    return "—";
  }

  return `${date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}
