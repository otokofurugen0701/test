import { prisma } from "@/lib/db";
import type { AlertSeverity, AlertStatus, AlertType, Prisma } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { AlertStatusSelect } from "@/components/AlertStatusSelect";
import { CreateTaskFromAlertButton } from "@/components/CreateTaskFromAlertButton";
import { getThresholds, isOffline, resolveThresholds } from "@/lib/settings";
import { syncOfflineAlert } from "@/lib/alerting";

type AlertsPageProps = {
  searchParams: {
    type?: AlertType;
    status?: AlertStatus;
    severity?: AlertSeverity;
    siteId?: string;
  };
};

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  const sites = await prisma.site.findMany({ orderBy: { name: "asc" } });
  const where: Prisma.AlertWhereInput = {};
  const andFilters: Prisma.AlertWhereInput[] = [];

  if (searchParams.type) andFilters.push({ type: searchParams.type });
  if (searchParams.status) andFilters.push({ status: searchParams.status });
  if (searchParams.severity) andFilters.push({ severity: searchParams.severity });
  if (searchParams.siteId) andFilters.push({ device: { siteId: searchParams.siteId } });
  if (andFilters.length > 0) where.AND = andFilters;

  const baseThresholds = await getThresholds();
  const devicesForOffline = await prisma.device.findMany({
    select: {
      id: true,
      lastSeenAt: true,
      offlineMinutesOverride: true,
      site: { select: { offlineMinutesOverride: true } },
    },
  });
  for (const device of devicesForOffline) {
    const thresholds = resolveThresholds(baseThresholds, [device.site ?? {}, device]);
    await syncOfflineAlert(device, isOffline(device.lastSeenAt, thresholds.offlineMinutes));
  }

  const alerts = await prisma.alert.findMany({
    where,
    include: { device: { include: { site: true } } },
    orderBy: { openedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Alerts</h2>
        <p className="text-sm text-slate-600">満杯・電池低下・通信断のアラート一覧</p>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <select
            name="type"
            defaultValue={searchParams.type ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全ての種別</option>
            <option value="FULL">満杯</option>
            <option value="LOW_BATTERY">電池低下</option>
            <option value="OFFLINE">通信断</option>
          </select>
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全てのステータス</option>
            <option value="OPEN">未対応</option>
            <option value="IN_PROGRESS">対応中</option>
            <option value="RESOLVED">解決</option>
          </select>
          <select
            name="severity"
            defaultValue={searchParams.severity ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全ての重要度</option>
            <option value="LOW">低</option>
            <option value="MEDIUM">中</option>
            <option value="HIGH">高</option>
          </select>
          <select
            name="siteId"
            defaultValue={searchParams.siteId ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全てのサイト</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">フィルタ</button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3">種別</th>
              <th className="px-4 py-3">デバイス</th>
              <th className="px-4 py-3">サイト</th>
              <th className="px-4 py-3">重要度</th>
              <th className="px-4 py-3">最終イベント</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((alert) => (
              <tr key={alert.id} className="border-t border-slate-200">
                <td className="px-4 py-3 font-semibold text-slate-900">{alert.type}</td>
                <td className="px-4 py-3 text-slate-600">{alert.device.name}</td>
                <td className="px-4 py-3 text-slate-600">{alert.device.site?.name ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{alert.severity}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(alert.lastEventAt)}</td>
                <td className="px-4 py-3">
                  <AlertStatusSelect alertId={alert.id} status={alert.status} />
                </td>
                <td className="px-4 py-3">
                  <CreateTaskFromAlertButton
                    alertId={alert.id}
                    deviceId={alert.deviceId}
                    type={alert.type === "FULL" ? "COLLECTION" : "MAINTENANCE"}
                  />
                </td>
              </tr>
            ))}
            {alerts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  アラートはありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
