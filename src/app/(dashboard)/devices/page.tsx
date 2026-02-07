import { prisma } from "@/lib/db";
import { getThresholds, isOffline, resolveThresholds } from "@/lib/settings";
import { formatDateTime, formatPct } from "@/lib/format";
import { DeviceMapPanel } from "@/components/DeviceMapPanel";
import { DeviceCreateForm } from "@/components/DeviceCreateForm";
import { DeviceTable } from "@/components/DeviceTable";
import { AlertStatus } from "@prisma/client";
import type { DeviceStatus, Prisma } from "@prisma/client";

type DevicesPageProps = {
  searchParams: {
    search?: string;
    siteId?: string;
    status?: DeviceStatus;
    full?: string;
    low_battery?: string;
    offline?: string;
  };
};

export default async function DevicesPage({ searchParams }: DevicesPageProps) {
  const baseThresholds = await getThresholds();
  const [sites, users] = await Promise.all([
    prisma.site.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const where: Prisma.DeviceWhereInput = {};
  const andFilters: Prisma.DeviceWhereInput[] = [];
  const search = searchParams.search?.trim();

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { deviceCode: { contains: search, mode: "insensitive" } },
    ];
  }

  if (searchParams.siteId) andFilters.push({ siteId: searchParams.siteId });
  if (searchParams.status) andFilters.push({ status: searchParams.status });
  if (andFilters.length > 0) where.AND = andFilters;

  const devices = await prisma.device.findMany({
    where,
    include: { site: true },
    orderBy: { lastSeenAt: "desc" },
  });

  const enriched = devices.map((device) => {
    const thresholds = resolveThresholds(baseThresholds, [device.site ?? {}, device]);
    const full =
      device.lastFillLevelPct !== null && device.lastFillLevelPct !== undefined
        ? device.lastFillLevelPct >= thresholds.fullThreshold
        : false;
    const lowBattery =
      device.lastBatteryPct !== null && device.lastBatteryPct !== undefined
        ? device.lastBatteryPct <= thresholds.lowBatteryThreshold
        : false;
    const offline = isOffline(device.lastSeenAt, thresholds.offlineMinutes);
    return { device, full, lowBattery, offline, thresholds };
  });

  const filtered = enriched.filter(({ full, lowBattery, offline }) => {
    if (searchParams.full === "true" && !full) return false;
    if (searchParams.low_battery === "true" && !lowBattery) return false;
    if (searchParams.offline === "true" && !offline) return false;
    return true;
  });

  const deviceIds = filtered.map(({ device }) => device.id);
  const openAlerts =
    deviceIds.length > 0
      ? await prisma.alert.findMany({
          where: {
            deviceId: { in: deviceIds },
            status: { in: [AlertStatus.OPEN, AlertStatus.IN_PROGRESS] },
          },
          orderBy: { openedAt: "desc" },
        })
      : [];
  const alertsByDevice = new Map<string, typeof openAlerts>();
  for (const alert of openAlerts) {
    const current = alertsByDevice.get(alert.deviceId) ?? [];
    current.push(alert);
    alertsByDevice.set(alert.deviceId, current);
  }

  const counts = {
    total: filtered.length,
    full: filtered.filter((d) => d.full).length,
    lowBattery: filtered.filter((d) => d.lowBattery).length,
    offline: filtered.filter((d) => d.offline).length,
  };

  const mapPoints = filtered
    .filter(
      ({ device }) =>
        device.site?.lat !== null &&
        device.site?.lat !== undefined &&
        device.site?.lng !== null &&
        device.site?.lng !== undefined
    )
    .map(({ device, full, lowBattery, offline }) => ({
      id: device.id,
      name: device.name,
      deviceCode: device.deviceCode,
      siteName: device.site?.name ?? null,
      address: device.site?.address ?? null,
      siteLat: device.site?.lat ?? null,
      siteLng: device.site?.lng ?? null,
      siteNotes: device.site?.notes ?? null,
      siteFullThresholdOverride: device.site?.fullThresholdOverride ?? null,
      siteLowBatteryThresholdOverride: device.site?.lowBatteryThresholdOverride ?? null,
      siteOfflineMinutesOverride: device.site?.offlineMinutesOverride ?? null,
      siteId: device.siteId ?? null,
      responsibleUserId: device.responsibleUserId ?? null,
      notes: device.notes ?? null,
      deviceStatus: device.status,
      lat: device.site!.lat!,
      lng: device.site!.lng!,
      status: offline ? "offline" : full ? "full" : lowBattery ? "low_battery" : "ok",
      alerts:
        alertsByDevice.get(device.id)?.map((alert) => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          status: alert.status,
        })) ?? [],
    }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Devices</h2>
        <p className="text-sm text-slate-600">デバイスの稼働状況と最新テレメトリ</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "総数", value: counts.total },
          { label: "満杯", value: counts.full },
          { label: "電池低下", value: counts.lowBattery },
          { label: "オフライン", value: counts.offline },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <DeviceCreateForm
        sites={sites.map((site) => ({ id: site.id, name: site.name }))}
        users={users.map((user) => ({ id: user.id, name: user.name ?? user.email }))}
      />

      <form className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-6">
          <input
            name="search"
            placeholder="検索: デバイス名 / ID"
            defaultValue={search ?? ""}
            className="col-span-2 rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
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
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全ての稼働状態</option>
            <option value="ACTIVE">稼働中</option>
            <option value="INACTIVE">停止</option>
            <option value="MAINTENANCE">保守中</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="full" value="true" defaultChecked={searchParams.full === "true"} />
            満杯のみ
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              name="low_battery"
              value="true"
              defaultChecked={searchParams.low_battery === "true"}
            />
            電池低下のみ
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="offline" value="true" defaultChecked={searchParams.offline === "true"} />
            オフラインのみ
          </label>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">フィルタ</button>
        </div>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">デバイス位置マップ</h3>
        <DeviceMapPanel
          devices={mapPoints}
          sites={sites.map((site) => ({ id: site.id, name: site.name }))}
          users={users.map((user) => ({ id: user.id, name: user.name ?? user.email }))}
        />
      </div>

      <DeviceTable
        rows={filtered.map(({ device, full, lowBattery, offline }) => ({
          id: device.id,
          name: device.name,
          deviceCode: device.deviceCode,
          siteName: device.site?.name ?? "-",
          fillLevel: formatPct(device.lastFillLevelPct),
          battery: formatPct(device.lastBatteryPct),
          lastSeen: formatDateTime(device.lastSeenAt),
          full,
          lowBattery,
          offline,
        }))}
        sites={sites.map((site) => ({ id: site.id, name: site.name }))}
        users={users.map((user) => ({ id: user.id, name: user.name ?? user.email }))}
      />
    </div>
  );
}
