import { useEffect, useId, useMemo, useRef } from "react";
import {
  ListFilter,
  Minus,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  AQI_CATEGORY_LABELS,
  AQI_CATEGORY_STYLES,
  getAqiCategory,
} from "../lib/aqi";
import {
  formatNumber,
  getAverage,
  getDominantPollutant,
  getPeak,
  getReadingValue,
} from "../lib/readings";
import { buildSparkline } from "../lib/sparkline";
import { formatObservationTime } from "../lib/timeline";
import {
  DISPLAY_METRIC_OPTIONS,
  METRIC_OPTIONS,
  type AirQualityReading,
  type AirQualityStation,
  type DisplayMetric,
} from "../types/air-quality";

interface StationDetailProps {
  station: AirQualityStation;
  readings: AirQualityReading[];
  metric: DisplayMetric;
  isAqi: boolean;
  isFiltered: boolean;
  onClose: () => void;
  onFilter: () => void;
}

function averageOf(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;
}

export function StationDetail({
  station,
  readings,
  metric,
  isAqi,
  isFiltered,
  onClose,
  onFilter,
}: StationDetailProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const gradientId = useId().replace(/:/g, "");

  const sortedReadings = useMemo(
    () =>
      [...readings].sort(
        (left, right) =>
          Date.parse(left.observedAt) - Date.parse(right.observedAt),
      ),
    [readings],
  );
  const values = useMemo(
    () => sortedReadings.map((reading) => getReadingValue(reading, metric)),
    [metric, sortedReadings],
  );
  const geometry = useMemo(() => buildSparkline(values), [values]);
  const latest = sortedReadings[sortedReadings.length - 1];
  const latestValue = latest === undefined
    ? null
    : getReadingValue(latest, metric);
  const average = getAverage(sortedReadings, metric);
  const peak = getPeak(sortedReadings, metric);
  const category =
    isAqi && latestValue !== null ? getAqiCategory(latestValue) : null;
  const dominantKey = getDominantPollutant(sortedReadings);
  const dominant = METRIC_OPTIONS.find((option) => option.key === dominantKey);
  const metricOption =
    DISPLAY_METRIC_OPTIONS.find((option) => option.key === metric) ??
    DISPLAY_METRIC_OPTIONS[0];

  const trend = useMemo(() => {
    const numeric = values.filter((value): value is number => value !== null);
    if (numeric.length < 4) {
      return null;
    }

    const middle = Math.floor(numeric.length / 2);
    const first = averageOf(numeric.slice(0, middle));
    const second = averageOf(numeric.slice(middle));
    if (first === null || second === null || first === 0) {
      return null;
    }

    return ((second - first) / first) * 100;
  }, [values]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  const lineColor =
    category === null
      ? "text-teal-600"
      : AQI_CATEGORY_STYLES[category].text;

  return (
    <aside
      className="station-drawer absolute right-3 top-16 z-30 flex w-[336px] flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white/97 p-4 shadow-xl backdrop-blur md:right-6 md:top-24"
      role="dialog"
      aria-modal="false"
      aria-labelledby="station-detail-title"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
            Estación seleccionada
          </p>
          <h2
            id="station-detail-title"
            className="mt-0.5 truncate text-lg font-semibold tracking-tight text-slate-900"
          >
            {station.name}
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            {station.country} · {station.latitude.toFixed(2)},{" "}
            {station.longitude.toFixed(2)}
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle de la estación"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-4xl font-semibold leading-none tracking-tight text-slate-900">
          {formatNumber(latestValue, isAqi ? 0 : 1)}
        </span>
        <span className="pb-0.5 text-xs font-medium text-slate-400">
          {metricOption.unit}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px]">
        <span className="font-medium text-slate-500">{metricOption.label}</span>
        {category !== null && (
          <span
            className={`rounded-full bg-slate-50 px-2 py-0.5 font-semibold ${AQI_CATEGORY_STYLES[category].text}`}
          >
            {AQI_CATEGORY_LABELS[category]}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Media
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            {formatNumber(average, isAqi ? 0 : 1)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Máximo
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            {formatNumber(peak, isAqi ? 0 : 1)}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
            Mínimo
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-800">
            {formatNumber(geometry.min, isAqi ? 0 : 1)}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>Serie de la ventana</span>
          <span className="font-medium text-slate-500">
            {formatNumber(geometry.min, isAqi ? 0 : 1)} –{" "}
            {formatNumber(geometry.max, isAqi ? 0 : 1)} {metricOption.unit}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          className={`h-16 w-full ${lineColor}`}
          role="img"
          aria-label={`Serie temporal de ${metricOption.label} en ${station.name}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {geometry.segments.map((segment, index) => (
            <g key={index}>
              {segment.area !== "" && (
                <path d={segment.area} fill={`url(#${gradientId})`} />
              )}
              <path
                d={segment.line}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}
          {geometry.pointCount === 1 && geometry.points[0] !== undefined && (
            <circle
              cx={geometry.points[0].x}
              cy={geometry.points[0].y}
              r="2.5"
              fill="currentColor"
            />
          )}
          {geometry.pointCount === 0 && (
            <text
              x={geometry.width / 2}
              y={geometry.height / 2}
              textAnchor="middle"
              className="fill-slate-300 text-[10px]"
            >
              Sin lecturas
            </text>
          )}
        </svg>
        <div className="flex items-center justify-between text-[9px] text-slate-400">
          <span>
            {sortedReadings[0] === undefined
              ? "—"
              : formatObservationTime(sortedReadings[0].observedAt)}
          </span>
          <span>
            {latest === undefined
              ? "—"
              : formatObservationTime(latest.observedAt)}
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Contaminante dominante</span>
          <span className="font-medium text-slate-700">
            {dominant?.label ?? "—"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Tendencia en la ventana</span>
          <span
            className={`flex items-center gap-1 font-medium ${
              trend === null
                ? "text-slate-400"
                : trend > 1
                  ? "text-rose-600"
                  : trend < -1
                    ? "text-emerald-600"
                    : "text-slate-500"
            }`}
          >
            {trend === null ? (
              <Minus size={12} />
            ) : trend > 0 ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {trend === null
              ? "—"
              : `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%`}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onFilter}
        className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
      >
        <ListFilter size={13} />
        {isFiltered ? "Ver todas las ubicaciones" : "Filtrar esta ubicación"}
      </button>
    </aside>
  );
}
