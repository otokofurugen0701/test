import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getThresholds, isOffline } from "@/lib/settings";
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

  const thresholds = await getThresholds();
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

  if (fullParam === "true") {
    andFilters.push({ lastFillLevelPct: { gte: thresholds.fullThreshold } });
  }

  if (lowBatteryParam === "true") {
    andFilters.push({ lastBatteryPct: { lte: thresholds.lowBatteryThreshold } });
  }

  if (offlineParam === "true") {
    const cutoff = new Date(Date.now() - thresholds.offlineMinutes * 60 * 1000);
    andFilters.push({
      OR: [{ lastSeenAt: { lt: cutoff } }, { lastSeenAt: null }],
    });
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

  const response = devices.map((device) => ({
    ...device,
    isFull:
      device.lastFillLevelPct !== null &&
      device.lastFillLevelPct !== undefined &&
      device.lastFillLevelPct >= thresholds.fullThreshold,
    isLowBattery:
      device.lastBatteryPct !== null &&
      device.lastBatteryPct !== undefined &&
      device.lastBatteryPct <= thresholds.lowBatteryThreshold,
    isOffline: isOffline(device.lastSeenAt, thresholds.offlineMinutes),
  }));

  return NextResponse.json({ data: response, thresholds });
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
