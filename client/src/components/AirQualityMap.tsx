import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HexagonLayer, HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { MapViewState } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import { DeckGL } from "@deck.gl/react";
import { CircleAlert, LocateFixed } from "lucide-react";
import { setWorkerUrl } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Map as MapGL, type MapRef } from "react-map-gl/maplibre";
import {
  AQI_CATEGORY_LABELS,
  AQI_COLOR_RANGE,
  getAqiCategory,
} from "../lib/aqi";
import type {
  AirQualityReading,
  AirQualityStation,
  DisplayMetric,
} from "../types/air-quality";

setWorkerUrl(mapLibreWorkerUrl);

export type MapLayerMode = "hexagon" | "heatmap";

interface AirQualityMapProps {
  readings: AirQualityReading[];
  stations: AirQualityStation[];
  metric: DisplayMetric;
  layerMode: MapLayerMode;
  onStationSelect: (stationId: string) => void;
}

interface MetricPoint extends AirQualityReading {
  value: number;
}

interface StationSummary {
  stationId: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  average: number;
  count: number;
}

const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const MAP_LOAD_TIMEOUT_MS = 8_000;
const COLOR_RANGE: [number, number, number, number][] = [
  [24, 126, 127, 150],
  [91, 178, 156, 185],
  [190, 202, 132, 205],
  [246, 184, 101, 220],
  [231, 112, 82, 235],
  [158, 53, 66, 245],
];
const AQI_COLOR_DOMAIN: [number, number] = [0, 100];

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -20,
  latitude: 22,
  zoom: 1.35,
  pitch: 24,
  bearing: 0,
};

export function AirQualityMap({
  readings,
  stations,
  metric,
  layerMode,
  onStationSelect,
}: AirQualityMapProps) {
  const mapRef = useRef<MapRef>(null);
  const fittedLocationKeyRef = useRef<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const points = useMemo(
    () =>
      readings.flatMap((reading): MetricPoint[] => {
        const value =
          metric === "aqi" ? reading.aqi.value : reading.metrics[metric];
        return value === null
          ? []
          : [{ ...reading, value }];
      }),
    [metric, readings],
  );

  const stationSummaries = useMemo(() => {
    const summaries = new globalThis.Map<string, StationSummary>();

    for (const point of points) {
      const current = summaries.get(point.stationId);
      if (current === undefined) {
        summaries.set(point.stationId, {
          stationId: point.stationId,
          name: point.name,
          country: point.country,
          latitude: point.latitude,
          longitude: point.longitude,
          average: point.value,
          count: 1,
        });
        continue;
      }

      current.average += point.value;
      current.count += 1;
    }

    return Array.from(summaries.values(), (summary) => ({
      ...summary,
      average: summary.average / summary.count,
    }));
  }, [points]);

  const layers = useMemo(() => {
    const isAqi = metric === "aqi";
    const colorRange = isAqi ? AQI_COLOR_RANGE : COLOR_RANGE;
    const colorDomain = isAqi ? AQI_COLOR_DOMAIN : undefined;
    const dataLayer =
      layerMode === "hexagon"
        ? new HexagonLayer<MetricPoint>({
            id: "air-quality-hexagons",
            data: points,
            getPosition: (point) => [point.longitude, point.latitude],
            getColorWeight: (point) => point.value,
            getElevationWeight: (point) => point.value,
            colorAggregation: "MEAN",
            elevationAggregation: "MEAN",
            radius: 140_000,
            elevationScale: 100,
            elevationRange: [0, 1_000],
            extruded: true,
            coverage: 0.88,
            transitions: {
              getColorWeight: 300,
              getElevationWeight: 300,
            },
            material: {
              ambient: 0.35,
              diffuse: 0.6,
              shininess: 28,
              specularColor: [60, 60, 60],
            },
            colorRange,
            colorDomain,
            pickable: false,
          })
        : new HeatmapLayer<MetricPoint>({
            id: "air-quality-heatmap",
            data: points,
            getPosition: (point) => [point.longitude, point.latitude],
            getWeight: (point) => point.value,
            aggregation: "MEAN",
            radiusPixels: 48,
            intensity: 1.15,
            threshold: 0.04,
            transitions: { getWeight: 300 },
            colorRange,
            colorDomain,
            pickable: false,
          });

    const markers = new ScatterplotLayer<StationSummary>({
      id: "station-markers",
      data: stationSummaries,
      getPosition: (station) => [station.longitude, station.latitude],
      getRadius: 8,
      radiusUnits: "pixels",
      radiusMinPixels: 5,
      radiusMaxPixels: 12,
      getFillColor: [255, 255, 255, 245],
      getLineColor: [27, 119, 122, 255],
      lineWidthMinPixels: 2,
      stroked: true,
      filled: true,
      pickable: true,
      autoHighlight: true,
      onClick: (info) => {
        if (info.object !== undefined) {
          onStationSelect(info.object.stationId);
        }
      },
    });

    return [dataLayer, markers];
  }, [layerMode, metric, onStationSelect, points, stationSummaries]);

  const locationKey = useMemo(
    () =>
      stations
        .map(
          (station) =>
            `${station.id}:${station.latitude}:${station.longitude}`,
        )
        .sort()
        .join("|"),
    [stations],
  );

  const fitToStations = useCallback(() => {
    if (stations.length === 0 || !mapRef.current) {
      return false;
    }

    const longitudes = stations.map((station) => station.longitude);
    const latitudes = stations.map((station) => station.latitude);
    const west = Math.min(...longitudes);
    const east = Math.max(...longitudes);
    const south = Math.min(...latitudes);
    const north = Math.max(...latitudes);
    const longitudePadding = Math.max((east - west) * 0.05, 0.15);
    const latitudePadding = Math.max((north - south) * 0.05, 0.15);

    const map = mapRef.current.getMap();
    const { clientWidth, clientHeight } = map.getCanvas();
    const camera = map.cameraForBounds(
      [
        [west - longitudePadding, south - latitudePadding],
        [east + longitudePadding, north + latitudePadding],
      ],
      {
        padding: {
          top: Math.min(100, clientHeight * 0.2),
          bottom: Math.min(116, clientHeight * 0.22),
          left: Math.min(80, clientWidth * 0.1),
          right: Math.min(80, clientWidth * 0.1),
        },
        maxZoom: 6.5,
      },
    );

    if (camera?.center === undefined || camera.zoom === undefined) {
      return false;
    }

    const [longitude, latitude] = Array.isArray(camera.center)
      ? camera.center
      : "lng" in camera.center
        ? [camera.center.lng, camera.center.lat]
        : [camera.center.lon, camera.center.lat];
    const { zoom, bearing, pitch } = camera;

    setViewState((previous) => ({
      ...previous,
      longitude,
      latitude,
      zoom,
      bearing: bearing ?? previous.bearing,
      pitch: pitch ?? previous.pitch,
    }));

    return true;
  }, [stations]);

  useEffect(() => {
    if (!mapLoaded || locationKey === "") {
      return;
    }

    if (fittedLocationKeyRef.current === locationKey) {
      return;
    }

    if (fitToStations()) {
      fittedLocationKeyRef.current = locationKey;
    }
  }, [fitToStations, locationKey, mapLoaded]);

  useEffect(() => {
    if (mapLoaded || mapError) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setMapError(true),
      MAP_LOAD_TIMEOUT_MS,
    );

    return () => window.clearTimeout(timeoutId);
  }, [mapError, mapLoaded]);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    setMapError(false);
  }, []);

  const handleMapError = useCallback(() => {
    if (!mapLoaded) {
      setMapError(true);
    }
  }, [mapLoaded]);

  const handleFitStations = useCallback(() => {
    if (fitToStations()) {
      fittedLocationKeyRef.current = locationKey;
    }
  }, [fitToStations, locationKey]);

  const handleRetryMap = useCallback(() => {
    setMapError(false);
    setMapLoaded(false);
    fittedLocationKeyRef.current = null;
    const map = mapRef.current?.getMap();

    if (map === undefined) {
      return;
    }

    map.setStyle(MAP_STYLE);
  }, []);

  const getTooltip = useCallback(
    ({ object }: { object?: StationSummary }) => {
      if (object === undefined) {
        return null;
      }

      if (metric === "aqi") {
        const value = Math.round(object.average);
        return `${object.name}, ${object.country} · AQI ${value} (${
          AQI_CATEGORY_LABELS[getAqiCategory(value)]
        })`;
      }

      return `${object.name}, ${object.country} · ${object.average.toFixed(1)} µg/m³`;
    },
    [metric],
  );

  return (
    <div className="map-canvas" aria-label="Mapa de calidad del aire">
      <DeckGL
        controller
        viewState={viewState}
        onViewStateChange={({ viewState: nextViewState }) => {
          if ("longitude" in nextViewState) {
            setViewState((previous) => ({ ...previous, ...nextViewState }));
          }
        }}
        layers={layers}
        getTooltip={getTooltip}
      >
        <MapGL
          ref={mapRef}
          mapStyle={MAP_STYLE}
          onLoad={handleMapLoad}
          onStyleData={handleMapLoad}
          onError={handleMapError}
          attributionControl={{ compact: true }}
          reuseMaps
        />
      </DeckGL>
      <button
        type="button"
        onClick={handleFitStations}
        disabled={stations.length === 0}
        aria-label="Centrar el mapa en las estaciones"
        className="absolute bottom-36 right-4 z-10 flex items-center gap-1.5 rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:border-teal-300 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50 md:bottom-40 md:right-6"
      >
        <LocateFixed size={14} />
        Centrar
      </button>
      {mapError && (
        <div
          role="alert"
          className="absolute left-1/2 top-20 z-20 flex w-[calc(100%_-_2rem)] max-w-[440px] -translate-x-1/2 items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/95 px-3.5 py-3 shadow-sm backdrop-blur md:top-24"
        >
          <CircleAlert
            size={16}
            className="mt-0.5 shrink-0 text-amber-600"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-900">
              Mapa base no disponible
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-amber-800">
              La capa de datos sigue visible. Revisa tu conexión e inténtalo de
              nuevo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRetryMap}
            className="shrink-0 text-[11px] font-semibold text-amber-900 underline underline-offset-2"
          >
            Reintentar
          </button>
        </div>
      )}
      {readings.length === 0 && (
        <div className="map-empty-state">
          <div className="empty-state-icon">AQ</div>
          <strong>Esperando observaciones</strong>
          <span>
            Cuando la API reciba datos, aparecerán aquí las estaciones y su
            actividad horaria.
          </span>
        </div>
      )}
    </div>
  );
}
