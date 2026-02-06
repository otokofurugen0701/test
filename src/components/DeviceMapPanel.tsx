"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeviceMap } from "@/components/DeviceMap";

type Option = { id: string; name: string };

type DeviceMapPoint = {
  id: string;
  name: string;
  deviceCode: string;
  siteName?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  status: "ok" | "full" | "low_battery" | "offline";
  deviceStatus: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  siteId?: string | null;
  responsibleUserId?: string | null;
  notes?: string | null;
};

type DeviceMapPanelProps = {
  devices: DeviceMapPoint[];
  sites: Option[];
  users: Option[];
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

export function DeviceMapPanel({ devices, sites, users }: DeviceMapPanelProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  const [isCreatingTask, startCreatingTask] = useTransition();

  const selected = useMemo(
    () => devices.find((device) => device.id === selectedId) ?? null,
    [devices, selectedId]
  );

  const [deviceStatus, setDeviceStatus] = useState<DeviceMapPoint["deviceStatus"]>("ACTIVE");
  const [siteId, setSiteId] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [notes, setNotes] = useState("");

  const [taskType, setTaskType] = useState("COLLECTION");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskNotes, setTaskNotes] = useState("");

  useEffect(() => {
    if (!selected) return;
    setDeviceStatus(selected.deviceStatus);
    setSiteId(selected.siteId ?? "");
    setResponsibleUserId(selected.responsibleUserId ?? "");
    setNotes(selected.notes ?? "");
    setTaskType(selected.status === "full" ? "COLLECTION" : "MAINTENANCE");
    setTaskAssigneeId("");
    setTaskDueAt("");
    setTaskNotes("");
  }, [selected]);

  const onSaveDevice = () => {
    if (!selected) return;
    startSaving(async () => {
      await fetch(`/api/devices/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: deviceStatus,
          siteId: siteId || null,
          responsibleUserId: responsibleUserId || null,
          notes: notes || null,
        }),
      });
      router.refresh();
    });
  };

  const onCreateTask = () => {
    if (!selected) return;
    startCreatingTask(async () => {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selected.id,
          type: taskType,
          assigneeUserId: taskAssigneeId || null,
          dueAt: taskDueAt || null,
          notes: taskNotes || "地図から作成",
        }),
      });
      setTaskNotes("");
      router.refresh();
    });
  };

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
          <div className="mt-3 space-y-4 text-sm text-slate-600">
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

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500">サイドパネル編集</p>
              <select
                value={deviceStatus}
                onChange={(event) => setDeviceStatus(event.target.value as DeviceMapPoint["deviceStatus"])}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="ACTIVE">稼働中</option>
                <option value="INACTIVE">停止</option>
                <option value="MAINTENANCE">保守中</option>
              </select>
              <select
                value={siteId}
                onChange={(event) => setSiteId(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="">サイト未設定</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
              <select
                value={responsibleUserId}
                onChange={(event) => setResponsibleUserId(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
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
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <button
                onClick={onSaveDevice}
                disabled={isSaving}
                className="w-full rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {isSaving ? "更新中..." : "更新"}
              </button>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500">タスク作成</p>
              <select
                value={taskType}
                onChange={(event) => setTaskType(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="COLLECTION">回収</option>
                <option value="MAINTENANCE">保守</option>
              </select>
              <select
                value={taskAssigneeId}
                onChange={(event) => setTaskAssigneeId(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                <option value="">担当者未設定</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={taskDueAt}
                onChange={(event) => setTaskDueAt(event.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <input
                value={taskNotes}
                onChange={(event) => setTaskNotes(event.target.value)}
                placeholder="作業メモ"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
              <button
                onClick={onCreateTask}
                disabled={isCreatingTask}
                className="w-full rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {isCreatingTask ? "作成中..." : "タスク作成"}
              </button>
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
