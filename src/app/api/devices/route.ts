import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getThresholds, isOffline, resolveThresholds } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { DeviceStatus, type Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search")?.trim() ?? "";
  const siteId = searchParams.get("siteId");
  const statusParam = searchParams.get("status");
  const fullParam = searchParams.get("full");
  const lowBatteryParam = searchParams.get("low_battery");
  const offlineParam = searchParams.get("offline");

  const baseThresholds = await getThresholds();
  const where: Prisma.DeviceWhereInput = {};
  const andFilters: Prisma.DeviceWhereInput[] = [];

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { deviceCode: { contains: search, mode: "insensitive" } },
    ];
  }

  if (siteId) {
    andFilters.push({ siteId });
  }

  if (statusParam && Object.values(DeviceStatus).includes(statusParam as DeviceStatus)) {
    andFilters.push({ status: statusParam as DeviceStatus });
  }

  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  const devices = await prisma.device.findMany({
    where,
    include: {
      site: true,
      responsibleUser: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });

  const enriched = devices.map((device) => {
    const thresholds = resolveThresholds(baseThresholds, [device.site ?? {}, device]);
    return {
      ...device,
      thresholds,
      isFull:
        device.lastFillLevelPct !== null &&
        device.lastFillLevelPct !== undefined &&
        device.lastFillLevelPct >= thresholds.fullThreshold,
      isLowBattery:
        device.lastBatteryPct !== null &&
        device.lastBatteryPct !== undefined &&
        device.lastBatteryPct <= thresholds.lowBatteryThreshold,
      isOffline: isOffline(device.lastSeenAt, thresholds.offlineMinutes),
    };
  });

  const filtered = enriched.filter((device) => {
    if (fullParam === "true" && !device.isFull) return false;
    if (lowBatteryParam === "true" && !device.isLowBattery) return false;
    if (offlineParam === "true" && !device.isOffline) return false;
    return true;
  });

  return NextResponse.json({ data: filtered, thresholds: baseThresholds });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body?.deviceCode || !body?.name) {
    return NextResponse.json({ error: "deviceCode and name are required" }, { status: 400 });
  }

  const status =
    body.status && Object.values(DeviceStatus).includes(body.status) ? body.status : DeviceStatus.ACTIVE;

  const created = await prisma.device.create({
    data: {
      deviceCode: body.deviceCode,
      name: body.name,
      siteId: body.siteId ?? null,
      installedAt: body.installedAt ? new Date(body.installedAt) : null,
      status,
      notes: body.notes ?? null,
      responsibleUserId: body.responsibleUserId ?? null,
      fullThresholdOverride:
        body.fullThresholdOverride === "" || body.fullThresholdOverride === undefined
          ? null
          : Number(body.fullThresholdOverride),
      lowBatteryThresholdOverride:
        body.lowBatteryThresholdOverride === "" || body.lowBatteryThresholdOverride === undefined
          ? null
          : Number(body.lowBatteryThresholdOverride),
      offlineMinutesOverride:
        body.offlineMinutesOverride === "" || body.offlineMinutesOverride === undefined
          ? null
          : Number(body.offlineMinutesOverride),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "DEVICE_CREATED",
    entityType: "Device",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
