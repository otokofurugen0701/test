"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatJson, isAlertTemplates, isTaskTemplates } from "@/lib/templates";

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
    taskTemplatesJson: unknown | null;
    alertTemplatesJson: unknown | null;
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
  const [taskTemplatesText, setTaskTemplatesText] = useState(
    site.taskTemplatesJson ? formatJson(site.taskTemplatesJson) : ""
  );
  const [alertTemplatesText, setAlertTemplatesText] = useState(
    site.alertTemplatesJson ? formatJson(site.alertTemplatesJson) : ""
  );
  const [templateError, setTemplateError] = useState<string | null>(null);

  const onSave = () => {
    const parseTemplates = (value: string, validator: (parsed: unknown) => boolean) => {
      if (!value.trim()) return null;
      try {
        const parsed = JSON.parse(value);
        if (!validator(parsed)) return { error: true };
        return parsed;
      } catch {
        return { error: true };
      }
    };
    const taskTemplatesJson = parseTemplates(taskTemplatesText, isTaskTemplates);
    if (taskTemplatesJson && (taskTemplatesJson as { error?: boolean }).error) {
      setTemplateError("タスクテンプレートのJSONが不正です。");
      return;
    }
    const alertTemplatesJson = parseTemplates(alertTemplatesText, isAlertTemplates);
    if (alertTemplatesJson && (alertTemplatesJson as { error?: boolean }).error) {
      setTemplateError("アラートテンプレートのJSONが不正です。");
      return;
    }
    setTemplateError(null);
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
          taskTemplatesJson: taskTemplatesJson === null ? null : taskTemplatesJson,
          alertTemplatesJson: alertTemplatesJson === null ? null : alertTemplatesJson,
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
          <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <summary className="cursor-pointer text-xs font-semibold text-slate-500">
              テンプレート上書き（JSON）
            </summary>
            <p className="mt-1 text-[11px] text-slate-400">
              空欄の場合は全体設定のテンプレートを使用します。
            </p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <label className="text-xs text-slate-600">
                タスクテンプレート
                <textarea
                  value={taskTemplatesText}
                  onChange={(event) => setTaskTemplatesText(event.target.value)}
                  placeholder="[]"
                  rows={5}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </label>
              <label className="text-xs text-slate-600">
                アラートテンプレート
                <textarea
                  value={alertTemplatesText}
                  onChange={(event) => setAlertTemplatesText(event.target.value)}
                  placeholder="[]"
                  rows={5}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </label>
            </div>
            {templateError && <p className="mt-2 text-[11px] text-rose-600">{templateError}</p>}
          </details>
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
