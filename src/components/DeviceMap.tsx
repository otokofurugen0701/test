"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";

type DeviceMapPoint = {
  id: string;
  name: string;
  deviceCode: string;
  siteName?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  status: "ok" | "full" | "low_battery" | "offline";
};

type DeviceMapProps = {
  devices: DeviceMapPoint[];
  onSelect?: (device: DeviceMapPoint) => void;
  onClear?: () => void;
  onMapClick?: (lng: number, lat: number) => void;
  selectedDevice?: { id: string; lat: number; lng: number } | null;
  onDragEnd?: (lng: number, lat: number) => void;
};

type DeviceGeoJson = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: {
      id: string;
      name: string;
      deviceCode: string;
      status: DeviceMapPoint["status"];
      siteName?: string;
      address?: string;
    };
    geometry: {
      type: "Point";
      coordinates: [number, number];
    };
  }>;
};

const DEFAULT_CENTER: [number, number] = [139.6917, 35.6895];

export function DeviceMap({
  devices,
  onSelect,
  onClear,
  onMapClick,
  selectedDevice,
  onDragEnd,
}: DeviceMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const devicesRef = useRef<DeviceMapPoint[]>(devices);
  const onSelectRef = useRef<DeviceMapProps["onSelect"]>(undefined);
  const onClearRef = useRef<DeviceMapProps["onClear"]>(undefined);
  const onMapClickRef = useRef<DeviceMapProps["onMapClick"]>(undefined);
  const onDragEndRef = useRef<DeviceMapProps["onDragEnd"]>(undefined);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onClearRef.current = onClear;
  }, [onClear]);

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    onDragEndRef.current = onDragEnd;
  }, [onDragEnd]);

  const geojson: DeviceGeoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: devices.map((device) => ({
        type: "Feature",
        properties: {
          id: device.id,
          name: device.name,
          deviceCode: device.deviceCode,
          status: device.status,
          siteName: device.siteName ?? "",
          address: device.address ?? "",
        },
        geometry: {
          type: "Point",
          coordinates: [device.lng, device.lat],
        },
      })),
    }),
    [devices]
  );

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: devices.length > 0 ? [devices[0].lng, devices[0].lat] : DEFAULT_CENTER,
      zoom: devices.length > 0 ? 11 : 9,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("devices", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "devices",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1f2937",
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 26],
          "circle-opacity": 0.85,
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "devices",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "devices",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "status"],
            "offline",
            "#94a3b8",
            "full",
            "#f87171",
            "low_battery",
            "#fbbf24",
            "#10b981",
          ],
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1.5,
        },
      });

      map.on("click", "clusters", (event) => {
        const features = map.queryRenderedFeatures(event.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource("devices") as mapboxgl.GeoJSONSource;
        if (!clusterId || !source) return;
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          const [lng, lat] = (features[0].geometry as { coordinates: [number, number] }).coordinates;
          map.easeTo({ center: [lng, lat], zoom });
        });
      });

      map.on("click", "unclustered-point", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        const props = feature.properties as {
          id: string;
          name: string;
          deviceCode: string;
          status: DeviceMapPoint["status"];
          siteName?: string;
          address?: string;
        };
        const selected =
          devicesRef.current.find((device) => device.id === props.id) ?? {
            id: props.id,
            name: props.name,
            deviceCode: props.deviceCode,
            siteName: props.siteName,
            address: props.address,
            lat: (feature.geometry as { coordinates: [number, number] }).coordinates[1],
            lng: (feature.geometry as { coordinates: [number, number] }).coordinates[0],
            status: props.status,
          };
        onSelectRef.current?.(selected);
        const [lng, lat] = (feature.geometry as { coordinates: [number, number] }).coordinates;
        new mapboxgl.Popup({ offset: 12 })
          .setLngLat([lng, lat])
          .setHTML(
            `<div style="font-size:12px;">
              <div style="font-weight:600;">${props.name}</div>
              <div style="color:#64748b;">${props.deviceCode}</div>
              <a href="/devices/${props.id}" style="color:#2563eb;">詳細を見る</a>
            </div>`
          )
          .addTo(map);
      });

      map.on("click", (event) => {
        const hits = map.queryRenderedFeatures(event.point, {
          layers: ["unclustered-point", "clusters"],
        });
        if (hits.length === 0) {
          onClearRef.current?.();
          onMapClickRef.current?.(event.lngLat.lng, event.lngLat.lat);
        }
      });

      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("mouseenter", "unclustered-point", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "unclustered-point", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, devices, geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("devices") as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }
  }, [geojson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!selectedDevice) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({ color: "#2563eb", draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const lngLat = markerRef.current?.getLngLat();
        if (!lngLat) return;
        onDragEndRef.current?.(lngLat.lng, lngLat.lat);
      });
    }

    markerRef.current.setLngLat([selectedDevice.lng, selectedDevice.lat]);
  }, [selectedDevice]);

  if (!token) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">
        NEXT_PUBLIC_MAPBOX_TOKEN が未設定のため、地図を表示できません。
      </div>
    );
  }

  return <div ref={containerRef} className="h-96 w-full rounded-lg border border-slate-200" />;
}
