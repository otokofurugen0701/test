export function formatDateTime(value?: Date | string | null) {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatPct(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return `${value}%`;
}

export function formatTemperature(value?: number | null) {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}°C`;
}
