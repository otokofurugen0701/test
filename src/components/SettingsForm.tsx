"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SettingsFormProps = {
  fullThreshold: number;
  lowBatteryThreshold: number;
  offlineMinutes: number;
};

export function SettingsForm({ fullThreshold, lowBatteryThreshold, offlineMinutes }: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [full, setFull] = useState(fullThreshold.toString());
  const [low, setLow] = useState(lowBatteryThreshold.toString());
  const [offline, setOffline] = useState(offlineMinutes.toString());

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    startTransition(async () => {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullThreshold: Number(full),
          lowBatteryThreshold: Number(low),
          offlineMinutes: Number(offline),
        }),
      });
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">閾値設定</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="text-sm text-slate-600">
          満杯判定 (%)
          <input
            value={full}
            onChange={(event) => setFull(event.target.value)}
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-slate-600">
          電池低下判定 (%)
          <input
            value={low}
            onChange={(event) => setLow(event.target.value)}
            type="number"
            min={0}
            max={100}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-slate-600">
          オフライン判定 (分)
          <input
            value={offline}
            onChange={(event) => setOffline(event.target.value)}
            type="number"
            min={1}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "更新中..." : "更新"}
        </button>
      </div>
    </form>
  );
}
