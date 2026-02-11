"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { defaultAlertTemplates, isAlertTemplates } from "@/lib/templates";

type DeviceAlertCreateFormProps = {
  deviceId: string;
  globalAlertTemplates?: unknown;
  siteAlertTemplates?: unknown;
};

export function DeviceAlertCreateForm({
  deviceId,
  globalAlertTemplates,
  siteAlertTemplates,
}: DeviceAlertCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState("");
  const [alertType, setAlertType] = useState("FULL");
  const [alertSeverity, setAlertSeverity] = useState("MEDIUM");
  const [alertDetails, setAlertDetails] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const templateOptions = useMemo(() => {
    if (isAlertTemplates(siteAlertTemplates)) {
      return siteAlertTemplates;
    }
    if (isAlertTemplates(globalAlertTemplates)) {
      return globalAlertTemplates;
    }
    return defaultAlertTemplates;
  }, [globalAlertTemplates, siteAlertTemplates]);

  const applyTemplate = (value: string) => {
    const template = templateOptions.find((item) => item.id === value);
    if (!template) return;
    setAlertType(template.type);
    setAlertSeverity(template.severity);
    setAlertDetails(template.notes);
  };

  const onCreate = () => {
    if (!deviceId) return;
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          type: alertType,
          severity: alertSeverity,
          details: alertDetails ? { note: alertDetails } : null,
        }),
      });
      setMessage(response.ok ? "アラートを作成しました。" : "アラート作成に失敗しました。");
      setAlertDetails("");
      setTemplateId("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-slate-400">手動アラート作成</p>
        {isAlertTemplates(siteAlertTemplates) && (
          <span className="text-[11px] text-emerald-600">サイトテンプレート使用中</span>
        )}
      </div>
      <select
        value={templateId}
        onChange={(event) => {
          const value = event.target.value;
          setTemplateId(value);
          applyTemplate(value);
        }}
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
      >
        <option value="">テンプレートを選択</option>
        {templateOptions.map((template) => (
          <option key={template.id} value={template.id}>
            {template.label}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-slate-500">
        プレビュー: {alertType} / {alertSeverity} / {alertDetails || "-"}
      </p>
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
        onClick={onCreate}
        disabled={isPending}
        className="w-full rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {isPending ? "作成中..." : "アラート作成"}
      </button>
      {message && <p className="text-[11px] text-slate-500">{message}</p>}
    </div>
  );
}
