import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HexagonLayer, HeatmapLayer } from "@deck.gl/aggregation-layers";
import type { MapViewState } from "@deck.gl/core";
import { ScatterplotLayer } from "@deck.gl/layers";
import { DeckGL } from "@deck.gl/react";
import { setWorkerUrl } from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Map as MapGL, type MapRef } from "react-map-gl/maplibre";
import type { AirQualityReading, MetricKey } from "../types/air-quality";

setWorkerUrl(mapLibreWorkerUrl);

export type MapLayerMode = "hexagon" | "heatmap";

interface AirQualityMapProps {
  readings: AirQualityReading[];
  metric: MetricKey;
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
const COLOR_RANGE: [number, number, number, number][] = [
  [24, 126, 127, 150],
  [91, 178, 156, 185],
  [190, 202, 132, 205],
  [246, 184, 101, 220],
  [231, 112, 82, 235],
  [158, 53, 66, 245],
];

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: -20,
  latitude: 22,
  zoom: 1.35,
  pitch: 24,
  bearing: 0,
};

export function AirQualityMap({
  readings,
  metric,
  layerMode,
  onStationSelect,
}: AirQualityMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  const points = useMemo(
    () =>
      readings.flatMap((reading): MetricPoint[] => {
        const value = reading.metrics[metric];
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
            radius: 220_000,
            elevationScale: 100,
            elevationRange: [0, 1_000],
            extruded: true,
            coverage: 0.88,
            material: {
              ambient: 0.35,
              diffuse: 0.6,
              shininess: 28,
              specularColor: [60, 60, 60],
            },
            colorRange: COLOR_RANGE,
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
            colorRange: COLOR_RANGE,
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
  }, [layerMode, onStationSelect, points, stationSummaries]);

  const locationKey = stationSummaries
    .map((station) => `${station.stationId}:${station.latitude}:${station.longitude}`)
    .join("|");

  useEffect(() => {
    if (!mapLoaded || stationSummaries.length === 0 || !mapRef.current) {
      return;
    }

    const longitudes = stationSummaries.map((station) => station.longitude);
    const latitudes = stationSummaries.map((station) => station.latitude);
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

    if (
      camera?.center !== undefined &&
      camera.zoom !== undefined
    ) {
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
    }
  }, [locationKey, mapLoaded, stationSummaries]);

  const handleMapLoad = useCallback(() => setMapLoaded(true), []);

  const getTooltip = useCallback(
    ({ object }: { object?: StationSummary }) => {
      if (object === undefined) {
        return null;
      }

      return `${object.name}, ${object.country} · media ${object.average.toFixed(1)} µg/m³`;
    },
    [],
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
          attributionControl={{ compact: true }}
          reuseMaps
        />
      </DeckGL>
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
