"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

type DeviceCreateFormProps = {
  sites: Option[];
  users: Option[];
};

export function DeviceCreateForm({ sites, users }: DeviceCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deviceCode, setDeviceCode] = useState("");
  const [name, setName] = useState("");
  const [siteId, setSiteId] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [installedAt, setInstalledAt] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [notes, setNotes] = useState("");
  const [fullThresholdOverride, setFullThresholdOverride] = useState("");
  const [lowBatteryThresholdOverride, setLowBatteryThresholdOverride] = useState("");
  const [offlineMinutesOverride, setOfflineMinutesOverride] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deviceCode || !name) return;

    startTransition(async () => {
      await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceCode,
          name,
          siteId: siteId || null,
          status,
          installedAt: installedAt || null,
          responsibleUserId: responsibleUserId || null,
          notes: notes || null,
          fullThresholdOverride: fullThresholdOverride || null,
          lowBatteryThresholdOverride: lowBatteryThresholdOverride || null,
          offlineMinutesOverride: offlineMinutesOverride || null,
        }),
      });
      setDeviceCode("");
      setName("");
      setSiteId("");
      setStatus("ACTIVE");
      setInstalledAt("");
      setResponsibleUserId("");
      setNotes("");
      setFullThresholdOverride("");
      setLowBatteryThresholdOverride("");
      setOfflineMinutesOverride("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">新規デバイス登録</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <input
          value={deviceCode}
          onChange={(event) => setDeviceCode(event.target.value)}
          placeholder="デバイスID"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="名称"
          required
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
      <div className="mt-4 grid gap-4 md:grid-cols-3">
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
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "登録中..." : "登録"}
        </button>
      </div>
    </form>
  );
}
