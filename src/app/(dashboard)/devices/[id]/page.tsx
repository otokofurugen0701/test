import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getThresholds, isOffline, resolveThresholds } from "@/lib/settings";
import { formatDateTime, formatPct, formatTemperature } from "@/lib/format";
import { TelemetryCharts } from "@/components/TelemetryCharts";
import { DeviceEditForm } from "@/components/DeviceEditForm";
import { DeviceAlertCreateForm } from "@/components/DeviceAlertCreateForm";

export default async function DeviceDetailPage({ params }: { params: { id: string } }) {
  const device = await prisma.device.findUnique({
    where: { id: params.id },
    include: {
      site: true,
      responsibleUser: true,
      alerts: { orderBy: { openedAt: "desc" } },
      tasks: { include: { assignee: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!device) return notFound();

  const baseThresholds = await getThresholds();
  const thresholds = resolveThresholds(baseThresholds, [device.site ?? {}, device]);
  const isDeviceOffline = isOffline(device.lastSeenAt, thresholds.offlineMinutes);
  const isFull =
    device.lastFillLevelPct !== null &&
    device.lastFillLevelPct !== undefined &&
    device.lastFillLevelPct >= thresholds.fullThreshold;
  const isLowBattery =
    device.lastBatteryPct !== null &&
    device.lastBatteryPct !== undefined &&
    device.lastBatteryPct <= thresholds.lowBatteryThreshold;

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [telemetry24h, telemetry7d, sites, users, settings] = await Promise.all([
    prisma.telemetry.findMany({
      where: { deviceId: device.id, ts: { gte: since24h } },
      orderBy: { ts: "asc" },
    }),
    prisma.telemetry.findMany({
      where: { deviceId: device.id, ts: { gte: since7d } },
      orderBy: { ts: "asc" },
    }),
    prisma.site.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.settings.findFirst({ select: { alertTemplatesJson: true } }),
  ]);

  const chartData24h = telemetry24h.map((row) => ({
    ts: row.ts.toISOString(),
    fillLevelPct: row.fillLevelPct ?? undefined,
    batteryPct: row.batteryPct ?? undefined,
    rssi: row.rssi ?? undefined,
  }));
  const chartData7d = telemetry7d.map((row) => ({
    ts: row.ts.toISOString(),
    fillLevelPct: row.fillLevelPct ?? undefined,
    batteryPct: row.batteryPct ?? undefined,
    rssi: row.rssi ?? undefined,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-slate-900">{device.name}</h2>
        <p className="text-sm text-slate-500">{device.deviceCode}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">積載量</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPct(device.lastFillLevelPct)}</p>
          {isFull && <p className="mt-1 text-xs text-rose-600">満杯</p>}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">電池残量</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatPct(device.lastBatteryPct)}</p>
          {isLowBattery && <p className="mt-1 text-xs text-amber-600">電池低下</p>}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">オンライン状態</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {isDeviceOffline ? "オフライン" : "オンライン"}
          </p>
          <p className="mt-1 text-xs text-slate-500">最終通信: {formatDateTime(device.lastSeenAt)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">温度 / 扉</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatTemperature(device.lastTempC)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{device.lastDoorOpen ? "扉開放" : "扉閉鎖"}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">直近24時間</h3>
          <TelemetryCharts data={chartData24h} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">直近7日</h3>
          <TelemetryCharts data={chartData7d} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">基本情報</h3>
          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            <div className="flex justify-between">
              <dt>設置場所</dt>
              <dd>{device.site?.name ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>住所</dt>
              <dd>{device.site?.address ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>担当者</dt>
              <dd>{device.responsibleUser?.name ?? device.responsibleUser?.email ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt>設置日</dt>
              <dd>{formatDateTime(device.installedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>満杯しきい値</dt>
              <dd>{thresholds.fullThreshold}%</dd>
            </div>
            <div className="flex justify-between">
              <dt>電池低下しきい値</dt>
              <dd>{thresholds.lowBatteryThreshold}%</dd>
            </div>
            <div className="flex justify-between">
              <dt>オフライン判定</dt>
              <dd>{thresholds.offlineMinutes}分</dd>
            </div>
            <div className="flex justify-between">
              <dt>メモ</dt>
              <dd className="text-right">{device.notes ?? "-"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">アラート履歴</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            {device.alerts.map((alert) => (
              <div key={alert.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{alert.type}</span>
                  <span className="text-xs text-slate-500">{alert.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">発生: {formatDateTime(alert.openedAt)}</p>
              </div>
            ))}
            {device.alerts.length === 0 && (
              <p className="text-sm text-slate-500">アラートはありません</p>
            )}
          </div>
          <div className="mt-4 border-t border-slate-200 pt-4">
            <DeviceAlertCreateForm
              deviceId={device.id}
              siteAlertTemplates={device.site?.alertTemplatesJson ?? null}
              globalAlertTemplates={settings?.alertTemplatesJson ?? null}
            />
          </div>
        </div>
      </div>

      <DeviceEditForm
        device={device}
        sites={sites.map((site) => ({ id: site.id, name: site.name }))}
        users={users.map((user) => ({ id: user.id, name: user.name ?? user.email }))}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">タスク履歴</h3>
        <div className="mt-4 space-y-3 text-sm text-slate-600">
          {device.tasks.map((task) => (
            <div key={task.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">{task.type}</span>
                <span className="text-xs text-slate-500">{task.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                担当: {task.assignee?.name ?? task.assignee?.email ?? "-"} / 期限:{" "}
                {formatDateTime(task.dueAt)}
              </p>
              <p className="mt-1 text-xs text-slate-500">{task.notes ?? "-"}</p>
            </div>
          ))}
          {device.tasks.length === 0 && <p className="text-sm text-slate-500">タスクはありません</p>}
        </div>
      </div>
    </div>
  );
}
