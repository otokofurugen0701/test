"use client";

import { useState } from "react";
import {
  AlertTemplate,
  TaskTemplate,
  defaultAlertTemplates,
  defaultTaskTemplates,
  formatJson,
  isAlertTemplates,
  isTaskTemplates,
  parseTemplateText,
} from "@/lib/templates";

type TemplateOverrideEditorProps = {
  taskTemplatesText: string;
  alertTemplatesText: string;
  onTaskTemplatesTextChange: (value: string) => void;
  onAlertTemplatesTextChange: (value: string) => void;
  externalError?: string | null;
};

const isValidJson = (text: string, validator: (value: unknown) => boolean) => {
  if (!text.trim()) return true;
  try {
    return validator(JSON.parse(text));
  } catch {
    return false;
  }
};

export function TemplateOverrideEditor({
  taskTemplatesText,
  alertTemplatesText,
  onTaskTemplatesTextChange,
  onAlertTemplatesTextChange,
  externalError,
}: TemplateOverrideEditorProps) {
  const initialTaskJson = taskTemplatesText.trim() ? taskTemplatesText : formatJson(defaultTaskTemplates);
  const initialAlertJson = alertTemplatesText.trim() ? alertTemplatesText : formatJson(defaultAlertTemplates);
  const initialTaskValid = isValidJson(initialTaskJson, isTaskTemplates);
  const initialAlertValid = isValidJson(initialAlertJson, isAlertTemplates);
  const [editorMode, setEditorMode] = useState<"GUI" | "JSON">(
    initialTaskValid && initialAlertValid ? "GUI" : "JSON"
  );
  const [taskItems, setTaskItems] = useState<TaskTemplate[]>(
    parseTemplateText(initialTaskJson, defaultTaskTemplates, isTaskTemplates)
  );
  const [alertItems, setAlertItems] = useState<AlertTemplate[]>(
    parseTemplateText(initialAlertJson, defaultAlertTemplates, isAlertTemplates)
  );
  const [templateError, setTemplateError] = useState<string | null>(
    initialTaskValid && initialAlertValid ? null : "テンプレートJSONが不正です。JSON編集で修正してください。"
  );

  const switchToGui = () => {
    const taskText = taskTemplatesText.trim() ? taskTemplatesText : formatJson(defaultTaskTemplates);
    const alertText = alertTemplatesText.trim() ? alertTemplatesText : formatJson(defaultAlertTemplates);
    if (!isValidJson(taskText, isTaskTemplates) || !isValidJson(alertText, isAlertTemplates)) {
      setTemplateError("テンプレートJSONが不正です。JSON編集で修正してください。");
      return;
    }
    setTaskItems(parseTemplateText(taskText, defaultTaskTemplates, isTaskTemplates));
    setAlertItems(parseTemplateText(alertText, defaultAlertTemplates, isAlertTemplates));
    setTemplateError(null);
    setEditorMode("GUI");
  };

  const updateTaskItems = (items: TaskTemplate[]) => {
    setTaskItems(items);
    onTaskTemplatesTextChange(formatJson(items));
    setTemplateError(null);
  };

  const updateAlertItems = (items: AlertTemplate[]) => {
    setAlertItems(items);
    onAlertTemplatesTextChange(formatJson(items));
    setTemplateError(null);
  };

  return (
    <div className="space-y-3">
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
          <div className="rounded-md border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">タスクテンプレート</p>
              <button
                type="button"
                onClick={() =>
                  updateTaskItems([
                    ...taskItems,
                    { id: "new-task", label: "新規タスク", type: "COLLECTION", dueOffsetDays: 0, notes: "" },
                  ])
                }
                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
              >
                追加
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {taskItems.map((item, index) => (
                <div key={`${item.id}-${index}`} className="grid gap-2 md:grid-cols-5">
                  <input
                    value={item.id}
                    onChange={(event) => {
                      const next = [...taskItems];
                      next[index] = { ...item, id: event.target.value };
                      updateTaskItems(next);
                    }}
                    placeholder="id"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    value={item.label}
                    onChange={(event) => {
                      const next = [...taskItems];
                      next[index] = { ...item, label: event.target.value };
                      updateTaskItems(next);
                    }}
                    placeholder="表示名"
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
                    type="number"
                    value={item.dueOffsetDays}
                    onChange={(event) => {
                      const next = [...taskItems];
                      next[index] = { ...item, dueOffsetDays: Number(event.target.value) };
                      updateTaskItems(next);
                    }}
                    placeholder="期限オフセット"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      value={item.notes}
                      onChange={(event) => {
                        const next = [...taskItems];
                        next[index] = { ...item, notes: event.target.value };
                        updateTaskItems(next);
                      }}
                      placeholder="メモ"
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => updateTaskItems(taskItems.filter((_, idx) => idx !== index))}
                      className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
              {taskItems.length === 0 && (
                <p className="text-[11px] text-slate-400">テンプレートがありません。</p>
              )}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-700">アラートテンプレート</p>
              <button
                type="button"
                onClick={() =>
                  updateAlertItems([
                    ...alertItems,
                    { id: "new-alert", label: "新規アラート", type: "FULL", severity: "MEDIUM", notes: "" },
                  ])
                }
                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600"
              >
                追加
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {alertItems.map((item, index) => (
                <div key={`${item.id}-${index}`} className="grid gap-2 md:grid-cols-5">
                  <input
                    value={item.id}
                    onChange={(event) => {
                      const next = [...alertItems];
                      next[index] = { ...item, id: event.target.value };
                      updateAlertItems(next);
                    }}
                    placeholder="id"
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                  />
                  <input
                    value={item.label}
                    onChange={(event) => {
                      const next = [...alertItems];
                      next[index] = { ...item, label: event.target.value };
                      updateAlertItems(next);
                    }}
                    placeholder="表示名"
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
                  <div className="flex gap-2">
                    <input
                      value={item.notes}
                      onChange={(event) => {
                        const next = [...alertItems];
                        next[index] = { ...item, notes: event.target.value };
                        updateAlertItems(next);
                      }}
                      placeholder="メモ"
                      className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => updateAlertItems(alertItems.filter((_, idx) => idx !== index))}
                      className="rounded-md border border-rose-200 px-2 py-1 text-[11px] text-rose-600 hover:bg-rose-50"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
              {alertItems.length === 0 && (
                <p className="text-[11px] text-slate-400">テンプレートがありません。</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="text-xs text-slate-600">
            タスクテンプレート
            <textarea
              value={taskTemplatesText}
              onChange={(event) => onTaskTemplatesTextChange(event.target.value)}
              rows={6}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
            />
          </label>
          <label className="text-xs text-slate-600">
            アラートテンプレート
            <textarea
              value={alertTemplatesText}
              onChange={(event) => onAlertTemplatesTextChange(event.target.value)}
              rows={6}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono"
            />
          </label>
        </div>
      )}

      {(templateError || externalError) && (
        <p className="text-xs text-rose-600">{templateError ?? externalError}</p>
      )}
    </div>
  );
}
