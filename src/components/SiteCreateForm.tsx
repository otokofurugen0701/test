"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SiteCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [notes, setNotes] = useState("");
  const [fullThresholdOverride, setFullThresholdOverride] = useState("");
  const [lowBatteryThresholdOverride, setLowBatteryThresholdOverride] = useState("");
  const [offlineMinutesOverride, setOfflineMinutesOverride] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name) return;
    startTransition(async () => {
      await fetch("/api/sites", {
        method: "POST",
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
      setName("");
      setAddress("");
      setLat("");
      setLng("");
      setNotes("");
      setFullThresholdOverride("");
      setLowBatteryThresholdOverride("");
      setOfflineMinutesOverride("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">新規サイト登録</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-5">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="サイト名"
          required
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
