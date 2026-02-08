"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { isAlertTemplates, isTaskTemplates } from "@/lib/templates";

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
  const [taskTemplatesText, setTaskTemplatesText] = useState("");
  const [alertTemplatesText, setAlertTemplatesText] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name) return;
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
          taskTemplatesJson: taskTemplatesJson === null ? null : taskTemplatesJson,
          alertTemplatesJson: alertTemplatesJson === null ? null : alertTemplatesJson,
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
      setTaskTemplatesText("");
      setAlertTemplatesText("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">新規サイト登録</h3>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">基本情報</p>
          <div className="mt-2 grid gap-4 md:grid-cols-5">
            <label className="text-xs text-slate-600">
              サイト名
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="サイト名"
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              住所
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="住所"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              緯度
              <input
                value={lat}
                onChange={(event) => setLat(event.target.value)}
                placeholder="緯度"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              経度
              <input
                value={lng}
                onChange={(event) => setLng(event.target.value)}
                placeholder="経度"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              メモ
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="メモ"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">閾値上書き（任意）</p>
          <p className="mt-1 text-xs text-slate-400">空欄の場合は全体設定を使用します。</p>
          <div className="mt-2 grid gap-4 md:grid-cols-3">
            <label className="text-xs text-slate-600">
              満杯しきい値(%)
              <input
                value={fullThresholdOverride}
                onChange={(event) => setFullThresholdOverride(event.target.value)}
                placeholder="満杯しきい値(%)"
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              電池低下しきい値(%)
              <input
                value={lowBatteryThresholdOverride}
                onChange={(event) => setLowBatteryThresholdOverride(event.target.value)}
                placeholder="電池低下しきい値(%)"
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-slate-600">
              オフライン判定(分)
              <input
                value={offlineMinutesOverride}
                onChange={(event) => setOfflineMinutesOverride(event.target.value)}
                placeholder="オフライン判定(分)"
                type="number"
                min={1}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
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
