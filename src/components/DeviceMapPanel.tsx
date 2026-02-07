"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  siteLat?: number | null;
  siteLng?: number | null;
  siteNotes?: string | null;
  siteFullThresholdOverride?: number | null;
  siteLowBatteryThresholdOverride?: number | null;
  siteOfflineMinutesOverride?: number | null;
  lat: number;
  lng: number;
  status: "ok" | "full" | "low_battery" | "offline";
  deviceStatus: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  siteId?: string | null;
  responsibleUserId?: string | null;
  notes?: string | null;
  alerts?: Array<{ id: string; type: string; severity: string; status: string }>;
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
  const [isSavingSite, startSavingSite] = useTransition();
  const [isCreatingAlert, startCreatingAlert] = useTransition();
  const [isResolvingAlert, startResolvingAlert] = useTransition();
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);
  const [isResolvingWithTask, startResolvingWithTask] = useTransition();
  const [resolvingWithTaskId, setResolvingWithTaskId] = useState<string | null>(null);
  const [isAutoSavingSite, startAutoSavingSite] = useTransition();
  const [isCreatingDevice, startCreatingDevice] = useTransition();
  const [createNewSiteOnDrag, setCreateNewSiteOnDrag] = useState(false);
  const [autoCreateTask, setAutoCreateTask] = useState(false);
  const lastAutoCreatedId = useRef<string | null>(null);

  const selected = useMemo(
    () => devices.find((device) => device.id === selectedId) ?? null,
    [devices, selectedId]
  );

  const [deviceStatus, setDeviceStatus] = useState<DeviceMapPoint["deviceStatus"]>("ACTIVE");
  const [siteId, setSiteId] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [notes, setNotes] = useState("");

  const [siteName, setSiteName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteLat, setSiteLat] = useState("");
  const [siteLng, setSiteLng] = useState("");
  const [siteNotes, setSiteNotes] = useState("");
  const [siteFullThresholdOverride, setSiteFullThresholdOverride] = useState("");
  const [siteLowBatteryThresholdOverride, setSiteLowBatteryThresholdOverride] = useState("");
  const [siteOfflineMinutesOverride, setSiteOfflineMinutesOverride] = useState("");

  const [taskType, setTaskType] = useState("COLLECTION");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  const [taskNotes, setTaskNotes] = useState("");

  const [alertType, setAlertType] = useState("FULL");
  const [alertSeverity, setAlertSeverity] = useState("MEDIUM");
  const [alertDetails, setAlertDetails] = useState("");

  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");
  const [newSiteLat, setNewSiteLat] = useState("");
  const [newSiteLng, setNewSiteLng] = useState("");
  const [newSiteNotes, setNewSiteNotes] = useState("");
  const [newSiteFullThresholdOverride, setNewSiteFullThresholdOverride] = useState("");
  const [newSiteLowBatteryThresholdOverride, setNewSiteLowBatteryThresholdOverride] = useState("");
  const [newSiteOfflineMinutesOverride, setNewSiteOfflineMinutesOverride] = useState("");
  const [mapClickLat, setMapClickLat] = useState("");
  const [mapClickLng, setMapClickLng] = useState("");

  const [newDeviceCode, setNewDeviceCode] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceStatus, setNewDeviceStatus] = useState("ACTIVE");
  const [newDeviceSiteId, setNewDeviceSiteId] = useState("");
  const [newDeviceAssigneeId, setNewDeviceAssigneeId] = useState("");
  const [newDeviceNotes, setNewDeviceNotes] = useState("");

  useEffect(() => {
    if (!selected) return;
    setDeviceStatus(selected.deviceStatus);
    setSiteId(selected.siteId ?? "");
    setResponsibleUserId(selected.responsibleUserId ?? "");
    setNotes(selected.notes ?? "");
    setTaskType(selected.status === "full" ? "COLLECTION" : "MAINTENANCE");
    setTaskAssigneeId(selected.responsibleUserId ?? "");
    if (selected.status === "full") {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setTaskDueAt(tomorrow.toISOString().slice(0, 10));
    } else {
      setTaskDueAt("");
    }
    setTaskNotes(selected.status === "full" ? "満杯回収（地図から作成）" : "地図から作成");
    setSiteName(selected.siteName ?? "");
    setSiteAddress(selected.address ?? "");
    setSiteLat(selected.siteLat?.toString() ?? "");
    setSiteLng(selected.siteLng?.toString() ?? "");
    setSiteNotes(selected.siteNotes ?? "");
    setSiteFullThresholdOverride(selected.siteFullThresholdOverride?.toString() ?? "");
    setSiteLowBatteryThresholdOverride(selected.siteLowBatteryThresholdOverride?.toString() ?? "");
    setSiteOfflineMinutesOverride(selected.siteOfflineMinutesOverride?.toString() ?? "");
    setAlertType(
      selected.status === "full"
        ? "FULL"
        : selected.status === "low_battery"
          ? "LOW_BATTERY"
          : selected.status === "offline"
            ? "OFFLINE"
            : "FULL"
    );
    setAlertSeverity("MEDIUM");
    setAlertDetails("");
    setNewDeviceSiteId(selected.siteId ?? "");
    setNewDeviceAssigneeId(selected.responsibleUserId ?? "");
  }, [selected]);

  useEffect(() => {
    if (selectedId && !selected) {
      setSelectedId(null);
    }
  }, [selectedId, selected]);

  const toNullableNumber = (value: string) => (value === "" ? null : Number(value));

  const createTask = async (options?: {
    assigneeUserId?: string | null;
    type?: "COLLECTION" | "MAINTENANCE";
    notes?: string | null;
  }) => {
    if (!selected) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: selected.id,
        type:
          options?.type ??
          (selected.status === "full" ? "COLLECTION" : (taskType as "COLLECTION" | "MAINTENANCE")),
        assigneeUserId: options?.assigneeUserId ?? (taskAssigneeId || null),
        dueAt: taskDueAt || null,
        notes: options?.notes ?? (taskNotes || "地図から作成"),
      }),
    });
  };

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
      await createTask();
      setTaskNotes("");
      router.refresh();
    });
  };

  useEffect(() => {
    if (!autoCreateTask || !selected) return;
    if (selected.status !== "full") return;
    if (lastAutoCreatedId.current === selected.id) return;
    lastAutoCreatedId.current = selected.id;
    startCreatingTask(async () => {
      await createTask({ assigneeUserId: selected.responsibleUserId ?? taskAssigneeId || null });
      router.refresh();
    });
  }, [autoCreateTask, selected, taskAssigneeId, taskType, taskDueAt, taskNotes]);

  const onCreateAlert = () => {
    if (!selected) return;
    startCreatingAlert(async () => {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: selected.id,
          type: alertType,
          severity: alertSeverity,
          details: alertDetails ? { note: alertDetails } : null,
        }),
      });
      setAlertDetails("");
      router.refresh();
    });
  };

  const onResolveAlert = (alertId: string) => {
    setResolvingAlertId(alertId);
    startResolvingAlert(async () => {
      await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      setResolvingAlertId(null);
      router.refresh();
    });
  };

  const onResolveAlertWithTask = (alertId: string) => {
    setResolvingWithTaskId(alertId);
    startResolvingWithTask(async () => {
      await fetch(`/api/alerts/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "RESOLVED" }),
      });
      await createTask({
        notes: taskNotes || "アラート解決後の対応",
      });
      setResolvingWithTaskId(null);
      router.refresh();
    });
  };

  const onSaveSite = () => {
    if (!selected?.siteId) return;
    startSavingSite(async () => {
      await fetch(`/api/sites/${selected.siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: siteName,
          address: siteAddress || null,
          lat: toNullableNumber(siteLat),
          lng: toNullableNumber(siteLng),
          notes: siteNotes || null,
          fullThresholdOverride: toNullableNumber(siteFullThresholdOverride),
          lowBatteryThresholdOverride: toNullableNumber(siteLowBatteryThresholdOverride),
          offlineMinutesOverride: toNullableNumber(siteOfflineMinutesOverride),
        }),
      });
      router.refresh();
    });
  };

  const autoSaveSiteLocation = (lat: string, lng: string) => {
    if (!selected?.siteId) return;
    startAutoSavingSite(async () => {
      await fetch(`/api/sites/${selected.siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: toNullableNumber(lat),
          lng: toNullableNumber(lng),
        }),
      });
      router.refresh();
    });
  };

  const createSiteFromDrag = async (lat: string, lng: string) => {
    if (!selected) return;
    const name = selected.siteName
      ? `${selected.siteName}（移設）`
      : `${selected.name} サイト`;
    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        address: selected.address ?? null,
        lat: toNullableNumber(lat),
        lng: toNullableNumber(lng),
        notes: selected.siteNotes ?? null,
      }),
    });
    const payload = await response.json();
    const newSiteId = payload?.data?.id;
    if (!newSiteId) return;
    await fetch(`/api/devices/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId: newSiteId }),
    });
  };

  const onCreateSite = () => {
    if (!newSiteName || !newSiteLat || !newSiteLng) return;
    startSavingSite(async () => {
      await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSiteName,
          address: newSiteAddress || null,
          lat: toNullableNumber(newSiteLat),
          lng: toNullableNumber(newSiteLng),
          notes: newSiteNotes || null,
          fullThresholdOverride: toNullableNumber(newSiteFullThresholdOverride),
          lowBatteryThresholdOverride: toNullableNumber(newSiteLowBatteryThresholdOverride),
          offlineMinutesOverride: toNullableNumber(newSiteOfflineMinutesOverride),
        }),
      });
      setNewSiteName("");
      setNewSiteAddress("");
      setNewSiteLat("");
      setNewSiteLng("");
      setNewSiteNotes("");
      setNewSiteFullThresholdOverride("");
      setNewSiteLowBatteryThresholdOverride("");
      setNewSiteOfflineMinutesOverride("");
      setMapClickLat("");
      setMapClickLng("");
      router.refresh();
    });
  };

  const onCreateDevice = () => {
    if (!newDeviceCode || !newDeviceName) return;
    startCreatingDevice(async () => {
      await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceCode: newDeviceCode,
          name: newDeviceName,
          status: newDeviceStatus,
          siteId: newDeviceSiteId || null,
          responsibleUserId: newDeviceAssigneeId || null,
          notes: newDeviceNotes || null,
        }),
      });
      setNewDeviceCode("");
      setNewDeviceName("");
      setNewDeviceStatus("ACTIVE");
      setNewDeviceSiteId("");
      setNewDeviceAssigneeId("");
      setNewDeviceNotes("");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
      <DeviceMap
        devices={devices}
        onSelect={(device) => setSelectedId(device.id)}
        onClear={() => setSelectedId(null)}
        onMapClick={(lng, lat) => {
          const latValue = lat.toFixed(6);
          const lngValue = lng.toFixed(6);
          setMapClickLat(latValue);
          setMapClickLng(lngValue);
          setNewSiteLat(latValue);
          setNewSiteLng(lngValue);
        }}
        selectedDevice={
          selected ? { id: selected.id, lat: selected.lat, lng: selected.lng } : null
        }
        onDragEnd={(lng, lat) => {
          const latValue = lat.toFixed(6);
          const lngValue = lng.toFixed(6);
          const message = createNewSiteOnDrag
            ? "このデバイス用に新しいサイトを作成しますか？"
            : "このサイトの座標を更新しますか？同じサイトの全デバイスに影響します。";
          if (!window.confirm(message)) {
            return false;
          }
          setMapClickLat(latValue);
          setMapClickLng(lngValue);
          setSiteLat(latValue);
          setSiteLng(lngValue);
          if (createNewSiteOnDrag) {
            startAutoSavingSite(async () => {
              await createSiteFromDrag(latValue, lngValue);
              router.refresh();
            });
          } else {
            autoSaveSiteLocation(latValue, lngValue);
          }
          return true;
        }}
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

            <div className="space-y-3 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500">アラート</p>
              {selected.alerts && selected.alerts.length > 0 ? (
                <div className="space-y-2">
                  {selected.alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-1 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-700">{alert.type}</p>
                        <p className="text-[11px] text-slate-500">
                          {alert.severity} / {alert.status}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onResolveAlert(alert.id)}
                          disabled={isResolvingAlert && resolvingAlertId === alert.id}
                          className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {isResolvingAlert && resolvingAlertId === alert.id ? "解決中..." : "解決"}
                        </button>
                        <button
                          onClick={() => onResolveAlertWithTask(alert.id)}
                          disabled={isResolvingWithTask && resolvingWithTaskId === alert.id}
                          className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                        >
                          {isResolvingWithTask && resolvingWithTaskId === alert.id
                            ? "作成中..."
                            : "解決+タスク"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">未対応アラートはありません。</p>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-400">手動アラート作成</p>
                <select
                  value={alertType}
                  onChange={(event) => setAlertType(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="FULL">満杯</option>
                  <option value="LOW_BATTERY">電池低下</option>
                  <option value="OFFLINE">通信断</option>
                </select>
                <select
                  value={alertSeverity}
                  onChange={(event) => setAlertSeverity(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value="LOW">低</option>
                  <option value="MEDIUM">中</option>
                  <option value="HIGH">高</option>
                </select>
                <input
                  value={alertDetails}
                  onChange={(event) => setAlertDetails(event.target.value)}
                  placeholder="詳細メモ（任意）"
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                />
                <button
                  onClick={onCreateAlert}
                  disabled={isCreatingAlert}
                  className="w-full rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {isCreatingAlert ? "作成中..." : "アラート作成"}
                </button>
              </div>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-3">
              <p className="text-xs font-semibold text-slate-500">サイト編集</p>
              {selected.siteId ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400">
                    マーカーをドラッグすると座標が更新されます。
                  </p>
                  <input
                    value={siteName}
                    onChange={(event) => setSiteName(event.target.value)}
                    placeholder="サイト名"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    value={siteAddress}
                    onChange={(event) => setSiteAddress(event.target.value)}
                    placeholder="住所"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={siteLat}
                      onChange={(event) => setSiteLat(event.target.value)}
                      placeholder="緯度"
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      value={siteLng}
                      onChange={(event) => setSiteLng(event.target.value)}
                      placeholder="経度"
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </div>
                  {mapClickLat && mapClickLng && (
                    <div className="space-y-1">
                      <button
                        onClick={() => {
                          setSiteLat(mapClickLat);
                          setSiteLng(mapClickLng);
                        }}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        地図クリック座標を反映
                      </button>
                      {isAutoSavingSite && (
                        <p className="text-[11px] text-slate-400">座標を保存しています...</p>
                      )}
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-xs text-slate-500">
                    <input
                      type="checkbox"
                      checked={createNewSiteOnDrag}
                      onChange={(event) => setCreateNewSiteOnDrag(event.target.checked)}
                    />
                    ドラッグ時に新サイトを自動生成
                  </label>
                  <input
                    value={siteNotes}
                    onChange={(event) => setSiteNotes(event.target.value)}
                    placeholder="メモ"
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={siteFullThresholdOverride}
                      onChange={(event) => setSiteFullThresholdOverride(event.target.value)}
                      placeholder="満杯(%)"
                      type="number"
                      min={0}
                      max={100}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      value={siteLowBatteryThresholdOverride}
                      onChange={(event) => setSiteLowBatteryThresholdOverride(event.target.value)}
                      placeholder="電池(%)"
                      type="number"
                      min={0}
                      max={100}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      value={siteOfflineMinutesOverride}
                      onChange={(event) => setSiteOfflineMinutesOverride(event.target.value)}
                      placeholder="オフライン(分)"
                      type="number"
                      min={1}
                      className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </div>
                  <button
                    onClick={onSaveSite}
                    disabled={isSavingSite}
                    className="w-full rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {isSavingSite ? "更新中..." : "サイト更新"}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-500">サイト未設定のため編集できません。</p>
              )}
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
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={autoCreateTask}
                  onChange={(event) => setAutoCreateTask(event.target.checked)}
                />
                満杯時のみ自動回収タスク作成
              </label>
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
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold text-slate-500">地図からサイト新規作成</p>
          <p className="text-[11px] text-slate-400">
            地図の空白をクリックすると緯度・経度が反映されます。
          </p>
          <input
            value={newSiteName}
            onChange={(event) => setNewSiteName(event.target.value)}
            placeholder="サイト名"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
          <input
            value={newSiteAddress}
            onChange={(event) => setNewSiteAddress(event.target.value)}
            placeholder="住所"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={newSiteLat}
              onChange={(event) => setNewSiteLat(event.target.value)}
              placeholder="緯度（地図クリック）"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            <input
              value={newSiteLng}
              onChange={(event) => setNewSiteLng(event.target.value)}
              placeholder="経度（地図クリック）"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
          </div>
          <input
            value={newSiteNotes}
            onChange={(event) => setNewSiteNotes(event.target.value)}
            placeholder="メモ"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={newSiteFullThresholdOverride}
              onChange={(event) => setNewSiteFullThresholdOverride(event.target.value)}
              placeholder="満杯(%)"
              type="number"
              min={0}
              max={100}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            <input
              value={newSiteLowBatteryThresholdOverride}
              onChange={(event) => setNewSiteLowBatteryThresholdOverride(event.target.value)}
              placeholder="電池(%)"
              type="number"
              min={0}
              max={100}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
            <input
              value={newSiteOfflineMinutesOverride}
              onChange={(event) => setNewSiteOfflineMinutesOverride(event.target.value)}
              placeholder="オフライン(分)"
              type="number"
              min={1}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
          </div>
          <button
            onClick={onCreateSite}
            disabled={isSavingSite}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {isSavingSite ? "作成中..." : "サイト作成"}
          </button>
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-3">
          <p className="text-xs font-semibold text-slate-500">地図からデバイス新規作成</p>
          <input
            value={newDeviceCode}
            onChange={(event) => setNewDeviceCode(event.target.value)}
            placeholder="デバイスID"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
          <input
            value={newDeviceName}
            onChange={(event) => setNewDeviceName(event.target.value)}
            placeholder="名称"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
          <select
            value={newDeviceStatus}
            onChange={(event) => setNewDeviceStatus(event.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="ACTIVE">稼働中</option>
            <option value="INACTIVE">停止</option>
            <option value="MAINTENANCE">保守中</option>
          </select>
          <select
            value={newDeviceSiteId}
            onChange={(event) => setNewDeviceSiteId(event.target.value)}
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
            value={newDeviceAssigneeId}
            onChange={(event) => setNewDeviceAssigneeId(event.target.value)}
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
            value={newDeviceNotes}
            onChange={(event) => setNewDeviceNotes(event.target.value)}
            placeholder="メモ"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
          />
          <button
            onClick={onCreateDevice}
            disabled={isCreatingDevice}
            className="w-full rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
          >
            {isCreatingDevice ? "作成中..." : "デバイス作成"}
          </button>
        </div>
      </div>
    </div>
  );
}
