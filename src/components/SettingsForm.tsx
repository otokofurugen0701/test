"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SettingsFormProps = {
  fullThreshold: number;
  lowBatteryThreshold: number;
  offlineMinutes: number;
  taskTemplatesText?: string;
  alertTemplatesText?: string;
};

const defaultTaskTemplates = [
  { id: "collect-today", label: "回収（当日）", type: "COLLECTION", dueOffsetDays: 0, notes: "当日回収" },
  { id: "collect-tomorrow", label: "回収（翌日）", type: "COLLECTION", dueOffsetDays: 1, notes: "翌日回収" },
  { id: "battery", label: "保守（バッテリー交換）", type: "MAINTENANCE", dueOffsetDays: 2, notes: "バッテリー交換" },
  { id: "cleaning", label: "保守（清掃）", type: "MAINTENANCE", dueOffsetDays: 3, notes: "清掃対応" },
];

const defaultAlertTemplates = [
  { id: "full", label: "満杯アラート", type: "FULL", severity: "HIGH", notes: "満杯対応" },
  { id: "battery", label: "電池低下アラート", type: "LOW_BATTERY", severity: "MEDIUM", notes: "バッテリー確認" },
  { id: "offline", label: "通信断アラート", type: "OFFLINE", severity: "HIGH", notes: "通信断調査" },
];

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const validateTaskTemplates = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      (item.type === "COLLECTION" || item.type === "MAINTENANCE") &&
      typeof item.dueOffsetDays === "number" &&
      typeof item.notes === "string"
  );

const validateAlertTemplates = (value: unknown) =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.label === "string" &&
      (item.type === "FULL" || item.type === "LOW_BATTERY" || item.type === "OFFLINE") &&
      (item.severity === "LOW" || item.severity === "MEDIUM" || item.severity === "HIGH") &&
      typeof item.notes === "string"
  );

export function SettingsForm({
  fullThreshold,
  lowBatteryThreshold,
  offlineMinutes,
  taskTemplatesText,
  alertTemplatesText,
}: SettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [full, setFull] = useState(fullThreshold.toString());
  const [low, setLow] = useState(lowBatteryThreshold.toString());
  const [offline, setOffline] = useState(offlineMinutes.toString());
  const [taskTemplates, setTaskTemplates] = useState(
    taskTemplatesText ?? formatJson(defaultTaskTemplates)
  );
  const [alertTemplates, setAlertTemplates] = useState(
    alertTemplatesText ?? formatJson(defaultAlertTemplates)
  );
  const [templateError, setTemplateError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTemplateError(null);

    let taskTemplatesJson: unknown = null;
    let alertTemplatesJson: unknown = null;
    if (taskTemplates.trim()) {
      try {
        taskTemplatesJson = JSON.parse(taskTemplates);
      } catch {
        setTemplateError("タスクテンプレートのJSONが不正です。");
        return;
      }
      if (!validateTaskTemplates(taskTemplatesJson)) {
        setTemplateError("タスクテンプレートの形式が不正です。");
        return;
      }
    }
    if (alertTemplates.trim()) {
      try {
        alertTemplatesJson = JSON.parse(alertTemplates);
      } catch {
        setTemplateError("アラートテンプレートのJSONが不正です。");
        return;
      }
      if (!validateAlertTemplates(alertTemplatesJson)) {
        setTemplateError("アラートテンプレートの形式が不正です。");
        return;
      }
    }

    startTransition(async () => {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullThreshold: Number(full),
          lowBatteryThreshold: Number(low),
          offlineMinutes: Number(offline),
          taskTemplatesJson,
          alertTemplatesJson,
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
      <div className="mt-6 space-y-3 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">テンプレート設定</h3>
        <p className="text-xs text-slate-500">
          JSONでテンプレートを編集できます。空欄の場合はデフォルトを使用します。
        </p>
        <label className="text-xs text-slate-600">
          タスクテンプレート
          <textarea
            value={taskTemplates}
            onChange={(event) => setTaskTemplates(event.target.value)}
            rows={6}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
          />
        </label>
        <label className="text-xs text-slate-600">
          アラートテンプレート
          <textarea
            value={alertTemplates}
            onChange={(event) => setAlertTemplates(event.target.value)}
            rows={6}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
          />
        </label>
        {templateError && <p className="text-xs text-rose-600">{templateError}</p>}
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
