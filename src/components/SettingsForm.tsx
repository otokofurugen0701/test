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

type TaskTemplate = {
  id: string;
  label: string;
  type: "COLLECTION" | "MAINTENANCE";
  dueOffsetDays: number;
  notes: string;
};

type AlertTemplate = {
  id: string;
  label: string;
  type: "FULL" | "LOW_BATTERY" | "OFFLINE";
  severity: "LOW" | "MEDIUM" | "HIGH";
  notes: string;
};

const defaultTaskTemplates: TaskTemplate[] = [
  { id: "collect-today", label: "回収（当日）", type: "COLLECTION", dueOffsetDays: 0, notes: "当日回収" },
  { id: "collect-tomorrow", label: "回収（翌日）", type: "COLLECTION", dueOffsetDays: 1, notes: "翌日回収" },
  { id: "battery", label: "保守（バッテリー交換）", type: "MAINTENANCE", dueOffsetDays: 2, notes: "バッテリー交換" },
  { id: "cleaning", label: "保守（清掃）", type: "MAINTENANCE", dueOffsetDays: 3, notes: "清掃対応" },
];

const defaultAlertTemplates: AlertTemplate[] = [
  { id: "full", label: "満杯アラート", type: "FULL", severity: "HIGH", notes: "満杯対応" },
  { id: "battery", label: "電池低下アラート", type: "LOW_BATTERY", severity: "MEDIUM", notes: "バッテリー確認" },
  { id: "offline", label: "通信断アラート", type: "OFFLINE", severity: "HIGH", notes: "通信断調査" },
];

const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const validateTaskTemplates = (value: unknown): value is TaskTemplate[] =>
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

const validateAlertTemplates = (value: unknown): value is AlertTemplate[] =>
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

const parseTemplateText = <T,>(text: string, fallback: T[], validator: (value: unknown) => value is T[]) => {
  try {
    const parsed = JSON.parse(text);
    if (validator(parsed)) return parsed;
  } catch {
    return fallback;
  }
  return fallback;
};

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
  const initialTaskJson = taskTemplatesText ?? formatJson(defaultTaskTemplates);
  const initialAlertJson = alertTemplatesText ?? formatJson(defaultAlertTemplates);
  const isValidJson = (text: string, validator: (value: unknown) => boolean) => {
    try {
      return validator(JSON.parse(text));
    } catch {
      return false;
    }
  };
  const initialTaskValid = isValidJson(initialTaskJson, validateTaskTemplates);
  const initialAlertValid = isValidJson(initialAlertJson, validateAlertTemplates);
  const [editorMode, setEditorMode] = useState<"GUI" | "JSON">(
    initialTaskValid && initialAlertValid ? "GUI" : "JSON"
  );
  const [taskTemplates, setTaskTemplates] = useState(initialTaskJson);
  const [alertTemplates, setAlertTemplates] = useState(initialAlertJson);
  const [taskItems, setTaskItems] = useState<TaskTemplate[]>(
    parseTemplateText(initialTaskJson, defaultTaskTemplates, validateTaskTemplates)
  );
  const [alertItems, setAlertItems] = useState<AlertTemplate[]>(
    parseTemplateText(initialAlertJson, defaultAlertTemplates, validateAlertTemplates)
  );
  const [templateError, setTemplateError] = useState<string | null>(
    initialTaskValid && initialAlertValid ? null : "テンプレートJSONが不正です。JSON編集で修正してください。"
  );

  const switchToGui = () => {
    setTemplateError(null);
    let parsedTasks: TaskTemplate[] | null = null;
    let parsedAlerts: AlertTemplate[] | null = null;
    try {
      const parsed = JSON.parse(taskTemplates);
      if (!validateTaskTemplates(parsed)) {
        setTemplateError("タスクテンプレートの形式が不正です。GUI編集に切り替えできません。");
        return;
      }
      parsedTasks = parsed;
    } catch {
      setTemplateError("タスクテンプレートのJSONが不正です。GUI編集に切り替えできません。");
      return;
    }
    try {
      const parsed = JSON.parse(alertTemplates);
      if (!validateAlertTemplates(parsed)) {
        setTemplateError("アラートテンプレートの形式が不正です。GUI編集に切り替えできません。");
        return;
      }
      parsedAlerts = parsed;
    } catch {
      setTemplateError("アラートテンプレートのJSONが不正です。GUI編集に切り替えできません。");
      return;
    }
    if (parsedTasks) setTaskItems(parsedTasks);
    if (parsedAlerts) setAlertItems(parsedAlerts);
    setEditorMode("GUI");
  };

  const updateTaskItems = (items: TaskTemplate[]) => {
    setTaskItems(items);
    setTaskTemplates(formatJson(items));
    setTemplateError(null);
  };

  const updateAlertItems = (items: AlertTemplate[]) => {
    setAlertItems(items);
    setAlertTemplates(formatJson(items));
    setTemplateError(null);
  };

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
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <button
            type="button"
            onClick={switchToGui}
            className={`rounded-md border px-3 py-1 ${editorMode === "GUI" ? "border-slate-900 text-slate-900" : "border-slate-300"}`}
          >
            GUI編集
          </button>
          <button
            type="button"
            onClick={() => setEditorMode("JSON")}
            className={`rounded-md border px-3 py-1 ${editorMode === "JSON" ? "border-slate-900 text-slate-900" : "border-slate-300"}`}
          >
            JSON編集
          </button>
        </div>
        {editorMode === "GUI" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">タスクテンプレート</p>
                <button
                  type="button"
                  onClick={() =>
                    updateTaskItems([
                      ...taskItems,
                      { id: `task-${Date.now()}`, label: "", type: "COLLECTION", dueOffsetDays: 0, notes: "" },
                    ])
                  }
                  className="text-xs text-blue-600 hover:underline"
                >
                  追加
                </button>
              </div>
              <div className="space-y-2">
                {taskItems.map((item, index) => (
                  <div key={item.id} className="grid gap-2 rounded-md border border-slate-200 p-2 md:grid-cols-5">
                    <input
                      value={item.label}
                      onChange={(event) => {
                        const next = [...taskItems];
                        next[index] = { ...item, label: event.target.value };
                        updateTaskItems(next);
                      }}
                      placeholder="ラベル"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <select
                      value={item.type}
                      onChange={(event) => {
                        const next = [...taskItems];
                        next[index] = { ...item, type: event.target.value as TaskTemplate["type"] };
                        updateTaskItems(next);
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="COLLECTION">回収</option>
                      <option value="MAINTENANCE">保守</option>
                    </select>
                    <input
                      value={item.dueOffsetDays}
                      onChange={(event) => {
                        const next = [...taskItems];
                        next[index] = { ...item, dueOffsetDays: Number(event.target.value) };
                        updateTaskItems(next);
                      }}
                      type="number"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      value={item.notes}
                      onChange={(event) => {
                        const next = [...taskItems];
                        next[index] = { ...item, notes: event.target.value };
                        updateTaskItems(next);
                      }}
                      placeholder="メモ"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => updateTaskItems(taskItems.filter((_, idx) => idx !== index))}
                      className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">アラートテンプレート</p>
                <button
                  type="button"
                  onClick={() =>
                    updateAlertItems([
                      ...alertItems,
                      {
                        id: `alert-${Date.now()}`,
                        label: "",
                        type: "FULL",
                        severity: "MEDIUM",
                        notes: "",
                      },
                    ])
                  }
                  className="text-xs text-blue-600 hover:underline"
                >
                  追加
                </button>
              </div>
              <div className="space-y-2">
                {alertItems.map((item, index) => (
                  <div key={item.id} className="grid gap-2 rounded-md border border-slate-200 p-2 md:grid-cols-5">
                    <input
                      value={item.label}
                      onChange={(event) => {
                        const next = [...alertItems];
                        next[index] = { ...item, label: event.target.value };
                        updateAlertItems(next);
                      }}
                      placeholder="ラベル"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <select
                      value={item.type}
                      onChange={(event) => {
                        const next = [...alertItems];
                        next[index] = { ...item, type: event.target.value as AlertTemplate["type"] };
                        updateAlertItems(next);
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="FULL">満杯</option>
                      <option value="LOW_BATTERY">電池低下</option>
                      <option value="OFFLINE">通信断</option>
                    </select>
                    <select
                      value={item.severity}
                      onChange={(event) => {
                        const next = [...alertItems];
                        next[index] = { ...item, severity: event.target.value as AlertTemplate["severity"] };
                        updateAlertItems(next);
                      }}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      <option value="LOW">低</option>
                      <option value="MEDIUM">中</option>
                      <option value="HIGH">高</option>
                    </select>
                    <input
                      value={item.notes}
                      onChange={(event) => {
                        const next = [...alertItems];
                        next[index] = { ...item, notes: event.target.value };
                        updateAlertItems(next);
                      }}
                      placeholder="メモ"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => updateAlertItems(alertItems.filter((_, idx) => idx !== index))}
                      className="rounded-md border border-rose-200 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
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
          </div>
        )}
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
