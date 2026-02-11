import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getThresholds, isOffline, resolveThresholds } from "@/lib/settings";
import { syncOfflineAlert } from "@/lib/alerting";
import { logAudit } from "@/lib/audit";
import { DeviceStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      site: true,
      responsibleUser: true,
      alerts: { orderBy: { openedAt: "desc" } },
      tasks: { include: { assignee: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [latestTelemetry, telemetry24h, telemetry7d, baseThresholds] = await Promise.all([
    prisma.telemetry.findFirst({
      where: { deviceId: id },
      orderBy: { ts: "desc" },
    }),
    prisma.telemetry.findMany({
      where: { deviceId: id, ts: { gte: since24h } },
      orderBy: { ts: "asc" },
    }),
    prisma.telemetry.findMany({
      where: { deviceId: id, ts: { gte: since7d } },
      orderBy: { ts: "asc" },
    }),
    getThresholds(),
  ]);

  const thresholds = resolveThresholds(baseThresholds, [device.site ?? {}, device]);
  await syncOfflineAlert(device, isOffline(device.lastSeenAt, thresholds.offlineMinutes));

  return NextResponse.json({
    data: {
      device,
      latestTelemetry,
      history: {
        last24h: telemetry24h,
        last7d: telemetry7d,
      },
      thresholds,
    },
  });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.device.findUnique({
    where: { id },
    include: { site: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const body = await request.json();

  const parseNullableNumber = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
  };
  const hasKey = (key: string) => Object.prototype.hasOwnProperty.call(body ?? {}, key);

  const status =
    body.status && Object.values(DeviceStatus).includes(body.status) ? body.status : existing.status;

  const updated = await prisma.device.update({
    where: { id: existing.id },
    data: {
      deviceCode: body.deviceCode ?? existing.deviceCode,
      name: body.name ?? existing.name,
      siteId: body.siteId === "" ? null : body.siteId ?? existing.siteId,
      installedAt:
        body.installedAt === ""
          ? null
          : body.installedAt
            ? new Date(body.installedAt)
            : existing.installedAt,
      status,
      notes: body.notes ?? existing.notes,
      responsibleUserId:
        body.responsibleUserId === "" ? null : body.responsibleUserId ?? existing.responsibleUserId,
      fullThresholdOverride: hasKey("fullThresholdOverride")
        ? parseNullableNumber(body.fullThresholdOverride)
        : existing.fullThresholdOverride,
      lowBatteryThresholdOverride: hasKey("lowBatteryThresholdOverride")
        ? parseNullableNumber(body.lowBatteryThresholdOverride)
        : existing.lowBatteryThresholdOverride,
      offlineMinutesOverride: hasKey("offlineMinutesOverride")
        ? parseNullableNumber(body.offlineMinutesOverride)
        : existing.offlineMinutesOverride,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "DEVICE_UPDATED",
    entityType: "Device",
    entityId: updated.id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.device.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  await prisma.task.deleteMany({ where: { deviceId: existing.id } });
  await prisma.alert.deleteMany({ where: { deviceId: existing.id } });
  await prisma.telemetry.deleteMany({ where: { deviceId: existing.id } });
  await prisma.device.delete({ where: { id: existing.id } });

  await logAudit({
    userId: session.user.id,
    action: "DEVICE_DELETED",
    entityType: "Device",
    entityId: existing.id,
    before: existing,
  });

  return NextResponse.json({ ok: true });
}
