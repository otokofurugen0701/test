"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

type DeviceEditFormProps = {
  device: {
    id: string;
    deviceCode: string;
    name: string;
    siteId: string | null;
    installedAt: Date | string | null;
    status: string;
    notes: string | null;
    responsibleUserId: string | null;
    fullThresholdOverride: number | null;
    lowBatteryThresholdOverride: number | null;
    offlineMinutesOverride: number | null;
  };
  sites: Option[];
  users: Option[];
};

const toDateInput = (value: Date | string | null) => {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
};

export function DeviceEditForm({ device, sites, users }: DeviceEditFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deviceCode, setDeviceCode] = useState(device.deviceCode);
  const [name, setName] = useState(device.name);
  const [siteId, setSiteId] = useState(device.siteId ?? "");
  const [status, setStatus] = useState(device.status);
  const [installedAt, setInstalledAt] = useState(toDateInput(device.installedAt));
  const [responsibleUserId, setResponsibleUserId] = useState(device.responsibleUserId ?? "");
  const [notes, setNotes] = useState(device.notes ?? "");
  const [fullThresholdOverride, setFullThresholdOverride] = useState(
    device.fullThresholdOverride?.toString() ?? ""
  );
  const [lowBatteryThresholdOverride, setLowBatteryThresholdOverride] = useState(
    device.lowBatteryThresholdOverride?.toString() ?? ""
  );
  const [offlineMinutesOverride, setOfflineMinutesOverride] = useState(
    device.offlineMinutesOverride?.toString() ?? ""
  );

  const onSave = () => {
    startTransition(async () => {
      await fetch(`/api/devices/${device.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceCode,
          name,
          siteId: siteId || null,
          installedAt: installedAt || null,
          status,
          responsibleUserId: responsibleUserId || null,
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
    if (!confirm("このデバイスを削除しますか？関連データも削除されます。")) return;
    startTransition(async () => {
      await fetch(`/api/devices/${device.id}`, { method: "DELETE" });
      router.push("/devices");
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">デバイス編集</h3>
        <div className="flex items-center gap-2">
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

      {isEditing && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={deviceCode}
              onChange={(event) => setDeviceCode(event.target.value)}
              placeholder="デバイスID"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="名称"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">サイト未設定</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="ACTIVE">稼働中</option>
              <option value="INACTIVE">停止</option>
              <option value="MAINTENANCE">保守中</option>
            </select>
            <input
              type="date"
              value={installedAt}
              onChange={(event) => setInstalledAt(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={responsibleUserId}
              onChange={(event) => setResponsibleUserId(event.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">担当者未設定</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
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
