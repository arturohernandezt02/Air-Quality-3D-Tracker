import { lazy, Suspense, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  Layers3,
  MapPin,
  RefreshCw,
  Wind,
} from "lucide-react";
import { useAirQualityData } from "./hooks/useAirQualityData";
import {
  METRIC_OPTIONS,
  type AirQualityReading,
  type MetricKey,
} from "./types/air-quality";
import type { MapLayerMode } from "./components/AirQualityMap";
import "./App.css";

const AirQualityMap = lazy(() =>
  import("./components/AirQualityMap").then((module) => ({
    default: module.AirQualityMap,
  })),
);

const TIME_RANGES = [
  { hours: 6, label: "6 h" },
  { hours: 24, label: "24 h" },
  { hours: 48, label: "48 h" },
];

function getAverage(readings: AirQualityReading[], metric: MetricKey) {
  const values = readings
    .map((reading) => reading.metrics[metric])
    .filter((value): value is number => value !== null);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function getPeak(readings: AirQualityReading[], metric: MetricKey) {
  const values = readings
    .map((reading) => reading.metrics[metric])
    .filter((value): value is number => value !== null);

  return values.length === 0 ? null : Math.max(...values);
}

function formatValue(value: number | null, digits = 1) {
  return value === null ? "—" : value.toFixed(digits);
}

function App() {
  const [rangeHours, setRangeHours] = useState(24);
  const [metric, setMetric] = useState<MetricKey>("pm2_5");
  const [stationId, setStationId] = useState("all");
  const [layerMode, setLayerMode] = useState<MapLayerMode>("hexagon");
  const { stations, readings, isLoading, error, updatedAt, refresh } =
    useAirQualityData(rangeHours, stationId);

  const activeMetric =
    METRIC_OPTIONS.find((option) => option.key === metric) ?? METRIC_OPTIONS[0];
  const stationCount = useMemo(
    () => new Set(readings.map((reading) => reading.stationId)).size,
    [readings],
  );
  const average = useMemo(
    () => getAverage(readings, metric),
    [metric, readings],
  );
  const peak = useMemo(() => getPeak(readings, metric), [metric, readings]);
  const latestObservation = useMemo(() => {
    const latest = readings.reduce<string | null>(
      (current, reading) =>
        current === null || reading.observedAt > current
          ? reading.observedAt
          : current,
      null,
    );

    return latest === null ? null : new Date(latest);
  }, [readings]);
  const handleStationSelect = (nextStationId: string) => {
    setStationId(nextStationId);
  };

  return (
    <main className="min-h-screen bg-[#f7f8f6] text-slate-900">
      <header className="dashboard-header flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white px-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold tracking-tight text-white">
            AQ
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">
              Air Quality Tracker
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.17em] text-slate-400">
              Observatorio atmosférico global
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:flex ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : isLoading
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
            aria-live="polite"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                error
                  ? "bg-rose-500"
                  : isLoading
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
            />
            {isLoading
              ? "Conectando API"
              : error
                ? "API desconectada"
                : "API conectada"}
          </div>
          {updatedAt && (
            <span className="hidden text-xs text-slate-400 lg:inline">
              Actualizado {updatedAt.toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={isLoading}
            aria-label="Actualizar datos"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-wait disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={isLoading ? "animate-spin" : undefined}
            />
          </button>
        </div>
      </header>

      <div className="dashboard-layout">
        <aside className="control-panel flex flex-col gap-6 border-r border-slate-200/80 bg-white px-5 py-6 md:px-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-teal-700">
              <Activity size={14} />
              Monitor de calidad del aire
            </div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em] text-slate-900">
              Vista global
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Explora las concentraciones horarias por ubicación y contaminante.
            </p>
          </div>

          <section aria-labelledby="filters-heading">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Wind size={15} />
              </span>
              <h2
                id="filters-heading"
                className="text-sm font-semibold text-slate-800"
              >
                Filtros
              </h2>
            </div>

            <label
              htmlFor="metric-select"
              className="mb-2 block text-xs font-medium text-slate-500"
            >
              Contaminante
            </label>
            <select
              id="metric-select"
              value={metric}
              onChange={(event) => setMetric(event.target.value as MetricKey)}
              className="control-select mb-5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              {METRIC_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} · {option.description}
                </option>
              ))}
            </select>

            <label
              htmlFor="station-select"
              className="mb-2 block text-xs font-medium text-slate-500"
            >
              Ubicación
            </label>
            <select
              id="station-select"
              value={stationId}
              onChange={(event) => handleStationSelect(event.target.value)}
              className="control-select w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            >
              <option value="all">Todas las ubicaciones</option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}, {station.country}
                </option>
              ))}
            </select>
          </section>

          <section aria-labelledby="time-heading">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Clock3 size={15} />
              </span>
              <h2
                id="time-heading"
                className="text-sm font-semibold text-slate-800"
              >
                Ventana temporal
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {TIME_RANGES.map((timeRange) => (
                <button
                  type="button"
                  key={timeRange.hours}
                  aria-pressed={rangeHours === timeRange.hours}
                  onClick={() => setRangeHours(timeRange.hours)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                    rangeHours === timeRange.hours
                      ? "bg-white text-teal-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Últimas {timeRange.label}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="layers-heading">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Layers3 size={15} />
              </span>
              <h2
                id="layers-heading"
                className="text-sm font-semibold text-slate-800"
              >
                Visualización
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={layerMode === "hexagon"}
                onClick={() => setLayerMode("hexagon")}
                className={`layer-option rounded-xl border p-3 text-left transition ${
                  layerMode === "hexagon"
                    ? "border-teal-300 bg-teal-50/70 text-teal-900 ring-1 ring-teal-100"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <span className="mb-2 block text-lg leading-none">⬡</span>
                <span className="block text-xs font-semibold">Hexágonos 3D</span>
              </button>
              <button
                type="button"
                aria-pressed={layerMode === "heatmap"}
                onClick={() => setLayerMode("heatmap")}
                className={`layer-option rounded-xl border p-3 text-left transition ${
                  layerMode === "heatmap"
                    ? "border-teal-300 bg-teal-50/70 text-teal-900 ring-1 ring-teal-100"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <span className="mb-2 block text-lg leading-none">◉</span>
                <span className="block text-xs font-semibold">Mapa de calor</span>
              </button>
            </div>
          </section>

          <section
            aria-labelledby="summary-heading"
            className="rounded-2xl border border-slate-200 bg-[#fbfcfb] p-4"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2
                  id="summary-heading"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"
                >
                  Resumen del periodo
                </h2>
                <p className="mt-1 text-[11px] text-slate-400">
                  {activeMetric.label} · {activeMetric.unit}
                </p>
              </div>
              <span className="rounded-md bg-white px-2 py-1 text-[10px] font-medium text-slate-400 shadow-sm ring-1 ring-slate-200/70">
                {readings.length} lecturas
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ArrowUpRight size={13} className="text-teal-700" />
                  Promedio
                </div>
                <p className="text-xl font-semibold tracking-tight text-slate-900">
                  {formatValue(average)}
                  <span className="ml-1 text-[10px] font-medium text-slate-400">
                    µg/m³
                  </span>
                </p>
              </div>
              <div className="rounded-xl bg-white p-3 ring-1 ring-slate-100">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                  <ArrowDownRight size={13} className="text-amber-600" />
                  Máximo
                </div>
                <p className="text-xl font-semibold tracking-tight text-slate-900">
                  {formatValue(peak)}
                  <span className="ml-1 text-[10px] font-medium text-slate-400">
                    µg/m³
                  </span>
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <span className="text-slate-500">Ubicaciones con datos</span>
              <span className="font-semibold text-slate-800">
                {stationCount} / {stations.length}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Última observación</span>
              <span className="font-medium text-slate-700">
                {latestObservation
                  ? latestObservation.toLocaleString("es-MX", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "UTC",
                    }) + " UTC"
                  : "—"}
              </span>
            </div>
          </section>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 p-3.5"
            >
              <div className="flex gap-2.5">
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0 text-rose-600"
                />
                <div>
                  <p className="text-xs font-semibold text-rose-800">
                    No se pudieron cargar los datos
                  </p>
                  <p className="mt-1 text-xs leading-5 text-rose-700">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={refresh}
                    className="mt-2 text-xs font-semibold text-rose-800 underline underline-offset-2"
                  >
                    Reintentar conexión
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-auto flex items-start gap-2 border-t border-slate-100 pt-4 text-[11px] leading-5 text-slate-400">
            <MapPin size={14} className="mt-0.5 shrink-0" />
            <p>
              Estimaciones modeladas de Open-Meteo. Los hexágonos agregan
              lecturas en ubicaciones puntuales; no representan una medición
              continua entre estaciones.
            </p>
          </div>
        </aside>

        <section className="map-section relative min-h-[520px] flex-1">
          <Suspense
            fallback={
              <div className="map-loading-state" aria-label="Cargando mapa">
                <span className="map-loading-spinner" />
                <span>Cargando visualización WebGL…</span>
              </div>
            }
          >
            <AirQualityMap
              readings={readings}
              metric={metric}
              layerMode={layerMode}
              onStationSelect={handleStationSelect}
            />
          </Suspense>

          <div className="map-title-card absolute left-4 top-4 z-10 rounded-xl border border-white/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:left-6 md:top-6">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <MapPin size={15} />
              </span>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Distribución global
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {activeMetric.label} · {rangeHours} horas
                </p>
              </div>
            </div>
          </div>

          <div className="map-status-card absolute right-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-white/80 bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur md:right-6 md:top-6">
            <span
              className={`h-2 w-2 rounded-full ${
                isLoading
                  ? "animate-pulse bg-amber-400"
                  : error
                    ? "bg-rose-500"
                    : "bg-emerald-500"
              }`}
            />
            <span className="text-xs font-medium text-slate-600">
              {isLoading
                ? "Actualizando"
                : error
                  ? "Sin conexión"
                  : "Datos consultados"}
            </span>
          </div>

          <div className="map-legend absolute bottom-5 left-4 z-10 rounded-xl border border-white/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur md:bottom-7 md:left-6">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Concentración · {activeMetric.unit}
            </p>
            <div className="legend-gradient h-2 w-44 rounded-full" />
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
              <span>Menor</span>
              <span>Mayor</span>
            </div>
          </div>

          <div className="map-attribution absolute bottom-5 right-4 z-10 rounded-md bg-white/85 px-2 py-1 text-[10px] text-slate-500 backdrop-blur md:bottom-7 md:right-6">
            OpenStreetMap · OpenFreeMap
          </div>
        </section>
      </div>
    </main>
  );
}

export default App;
