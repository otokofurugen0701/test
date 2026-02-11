export type TaskTemplate = {
  id: string;
  label: string;
  type: "COLLECTION" | "MAINTENANCE";
  dueOffsetDays: number;
  notes: string;
};

export type AlertTemplate = {
  id: string;
  label: string;
  type: "FULL" | "LOW_BATTERY" | "OFFLINE";
  severity: "LOW" | "MEDIUM" | "HIGH";
  notes: string;
};

export const defaultTaskTemplates: TaskTemplate[] = [
  { id: "collect-today", label: "回収（当日）", type: "COLLECTION", dueOffsetDays: 0, notes: "当日回収" },
  { id: "collect-tomorrow", label: "回収（翌日）", type: "COLLECTION", dueOffsetDays: 1, notes: "翌日回収" },
  { id: "battery", label: "保守（バッテリー交換）", type: "MAINTENANCE", dueOffsetDays: 2, notes: "バッテリー交換" },
  { id: "cleaning", label: "保守（清掃）", type: "MAINTENANCE", dueOffsetDays: 3, notes: "清掃対応" },
];

export const defaultAlertTemplates: AlertTemplate[] = [
  { id: "full", label: "満杯アラート", type: "FULL", severity: "HIGH", notes: "満杯対応" },
  { id: "battery", label: "電池低下アラート", type: "LOW_BATTERY", severity: "MEDIUM", notes: "バッテリー確認" },
  { id: "offline", label: "通信断アラート", type: "OFFLINE", severity: "HIGH", notes: "通信断調査" },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const isTaskTemplates = (value: unknown): value is TaskTemplate[] =>
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

export const isAlertTemplates = (value: unknown): value is AlertTemplate[] =>
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

export const formatJson = (value: unknown) => JSON.stringify(value, null, 2);

export const parseTemplateText = <T,>(
  text: string,
  fallback: T[],
  validator: (value: unknown) => value is T[]
) => {
  try {
    const parsed = JSON.parse(text);
    if (validator(parsed)) return parsed;
  } catch {
    return fallback;
  }
  return fallback;
};
