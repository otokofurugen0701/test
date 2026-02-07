import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getThresholds, isOffline, resolveThresholds } from "@/lib/settings";
import { syncOfflineAlert } from "@/lib/alerting";
import type { AlertStatus, AlertType, AlertSeverity, Prisma } from "@prisma/client";
import { AlertSeverity as AlertSeverityEnum, AlertStatus as AlertStatusEnum, AlertType as AlertTypeEnum } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") as AlertType | null;
  const status = searchParams.get("status") as AlertStatus | null;
  const severity = searchParams.get("severity") as AlertSeverity | null;
  const siteId = searchParams.get("siteId");

  const where: Prisma.AlertWhereInput = {};
  const andFilters: Prisma.AlertWhereInput[] = [];

  if (type) andFilters.push({ type });
  if (status) andFilters.push({ status });
  if (severity) andFilters.push({ severity });
  if (siteId) andFilters.push({ device: { siteId } });
  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  const baseThresholds = await getThresholds();
  const devices = await prisma.device.findMany({
    select: {
      id: true,
      lastSeenAt: true,
      offlineMinutesOverride: true,
      site: { select: { offlineMinutesOverride: true } },
    },
  });
  for (const device of devices) {
    const thresholds = resolveThresholds(baseThresholds, [device.site ?? {}, device]);
    await syncOfflineAlert(device, isOffline(device.lastSeenAt, thresholds.offlineMinutes));
  }

  const alerts = await prisma.alert.findMany({
    where,
    include: {
      device: { include: { site: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  return NextResponse.json({ data: alerts });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const deviceId = body?.deviceId as string | undefined;
  const type = body?.type as AlertType | undefined;
  const severity = body?.severity as AlertSeverity | undefined;

  if (!deviceId || !type || !Object.values(AlertTypeEnum).includes(type)) {
    return NextResponse.json({ error: "deviceId and valid type are required" }, { status: 400 });
  }

  const normalizedSeverity = Object.values(AlertSeverityEnum).includes(severity as AlertSeverity)
    ? (severity as AlertSeverity)
    : AlertSeverityEnum.MEDIUM;

  const existing = await prisma.alert.findFirst({
    where: { deviceId, type, status: { in: [AlertStatusEnum.OPEN, AlertStatusEnum.IN_PROGRESS] } },
  });

  const now = new Date();

  const updatedOrCreated = existing
    ? await prisma.alert.update({
        where: { id: existing.id },
        data: {
          severity: normalizedSeverity,
          lastEventAt: now,
          detailsJson: body?.details ?? existing.detailsJson,
        },
      })
    : await prisma.alert.create({
        data: {
          deviceId,
          type,
          severity: normalizedSeverity,
          status: AlertStatusEnum.OPEN,
          openedAt: now,
          lastEventAt: now,
          detailsJson: body?.details ?? null,
        },
      });

  await logAudit({
    userId: session.user.id,
    action: existing ? "ALERT_UPDATED" : "ALERT_CREATED",
    entityType: "Alert",
    entityId: updatedOrCreated.id,
    before: existing ?? undefined,
    after: updatedOrCreated,
  });

  return NextResponse.json({ data: updatedOrCreated }, { status: existing ? 200 : 201 });
}
