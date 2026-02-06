"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SiteCardProps = {
  site: {
    id: string;
    name: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    notes: string | null;
    fullThresholdOverride: number | null;
    lowBatteryThresholdOverride: number | null;
    offlineMinutesOverride: number | null;
    devices: { id: string }[];
  };
  mapUrl?: string | null;
};

export function SiteCard({ site, mapUrl }: SiteCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(site.name);
  const [address, setAddress] = useState(site.address ?? "");
  const [lat, setLat] = useState(site.lat?.toString() ?? "");
  const [lng, setLng] = useState(site.lng?.toString() ?? "");
  const [notes, setNotes] = useState(site.notes ?? "");
  const [fullThresholdOverride, setFullThresholdOverride] = useState(
    site.fullThresholdOverride?.toString() ?? ""
  );
  const [lowBatteryThresholdOverride, setLowBatteryThresholdOverride] = useState(
    site.lowBatteryThresholdOverride?.toString() ?? ""
  );
  const [offlineMinutesOverride, setOfflineMinutesOverride] = useState(
    site.offlineMinutesOverride?.toString() ?? ""
  );

  const onSave = () => {
    startTransition(async () => {
      await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address: address || null,
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
          notes: notes || null,
          fullThresholdOverride: fullThresholdOverride ? Number(fullThresholdOverride) : null,
          lowBatteryThresholdOverride: lowBatteryThresholdOverride ? Number(lowBatteryThresholdOverride) : null,
          offlineMinutesOverride: offlineMinutesOverride ? Number(offlineMinutesOverride) : null,
        }),
      });
      setIsEditing(false);
      router.refresh();
    });
  };

  const onDelete = () => {
    if (!confirm("このサイトを削除しますか？紐づくデバイスは未設定になります。")) return;
    startTransition(async () => {
      await fetch(`/api/sites/${site.id}`, { method: "DELETE" });
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{site.name}</h3>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>デバイス {site.devices.length}</span>
          <button
            onClick={() => setIsEditing((prev) => !prev)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            {isEditing ? "閉じる" : "編集"}
          </button>
          <button
            onClick={onDelete}
            disabled={isPending}
            className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
          >
            削除
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600">{site.address ?? "住所未登録"}</p>
      <p className="mt-1 text-xs text-slate-500">{site.notes ?? "-"}</p>
      {mapUrl ? (
        <img src={mapUrl} alt={`${site.name} map`} className="mt-4 h-40 w-full rounded-md object-cover" />
      ) : (
        <div className="mt-4 rounded-md bg-slate-100 p-4 text-xs text-slate-500">
          MAPBOX_TOKEN と緯度/経度が設定されていません
        </div>
      )}

      {isEditing && (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="サイト名"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="住所"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={lat}
              onChange={(event) => setLat(event.target.value)}
              placeholder="緯度"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={lng}
              onChange={(event) => setLng(event.target.value)}
              placeholder="経度"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="メモ"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={fullThresholdOverride}
              onChange={(event) => setFullThresholdOverride(event.target.value)}
              placeholder="満杯しきい値(%)"
              type="number"
              min={0}
              max={100}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={lowBatteryThresholdOverride}
              onChange={(event) => setLowBatteryThresholdOverride(event.target.value)}
              placeholder="電池低下しきい値(%)"
              type="number"
              min={0}
              max={100}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={offlineMinutesOverride}
              onChange={(event) => setOfflineMinutesOverride(event.target.value)}
              placeholder="オフライン判定(分)"
              type="number"
              min={1}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={onSave}
              disabled={isPending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isPending ? "更新中..." : "更新"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
