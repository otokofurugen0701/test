"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DeviceMap } from "@/components/DeviceMap";

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

type DeviceMapPanelProps = {
  devices: DeviceMapPoint[];
};

const statusLabel: Record<DeviceMapPoint["status"], string> = {
  ok: "正常",
  full: "満杯",
  low_battery: "電池低下",
  offline: "オフライン",
};

const statusColor: Record<DeviceMapPoint["status"], string> = {
  ok: "text-emerald-600",
  full: "text-rose-600",
  low_battery: "text-amber-600",
  offline: "text-slate-500",
};

export function DeviceMapPanel({ devices }: DeviceMapPanelProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => devices.find((device) => device.id === selectedId) ?? null,
    [devices, selectedId]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
      <DeviceMap
        devices={devices}
        onSelect={(device) => setSelectedId(device.id)}
        onClear={() => setSelectedId(null)}
      />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900">選択中のデバイス</h4>
        {selected ? (
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <div>
              <p className="font-semibold text-slate-900">{selected.name}</p>
              <p className="text-xs text-slate-500">{selected.deviceCode}</p>
            </div>
            <p className={`${statusColor[selected.status]} text-xs font-semibold`}>
              {statusLabel[selected.status]}
            </p>
            <div className="text-xs text-slate-500">
              <p>{selected.siteName ?? "サイト未設定"}</p>
              <p>{selected.address ?? "-"}</p>
            </div>
            <Link
              href={`/devices/${selected.id}`}
              className="inline-flex items-center text-xs font-semibold text-blue-600 hover:underline"
            >
              デバイス詳細へ
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">地図上のポイントを選択してください。</p>
        )}
      </div>
    </div>
  );
}
