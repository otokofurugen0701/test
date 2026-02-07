import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { AlertSeverity, AlertStatus, AlertType } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const deviceIds = Array.isArray(body?.deviceIds) ? body.deviceIds : [];
  const type = body?.type as AlertType | undefined;
  const severity =
    body?.severity && Object.values(AlertSeverity).includes(body.severity)
      ? (body.severity as AlertSeverity)
      : AlertSeverity.MEDIUM;

  if (deviceIds.length === 0 || !type || !Object.values(AlertType).includes(type)) {
    return NextResponse.json({ error: "deviceIds and valid type are required" }, { status: 400 });
  }

  const existing = await prisma.alert.findMany({
    where: {
      deviceId: { in: deviceIds },
      type,
      status: { in: [AlertStatus.OPEN, AlertStatus.IN_PROGRESS] },
    },
    select: { deviceId: true },
  });
  const existingSet = new Set(existing.map((item) => item.deviceId));
  const createIds = deviceIds.filter((id: string) => !existingSet.has(id));
  const now = new Date();

  const created = await prisma.alert.createMany({
    data: createIds.map((deviceId: string) => ({
      deviceId,
      type,
      severity,
      status: AlertStatus.OPEN,
      openedAt: now,
      lastEventAt: now,
      detailsJson: body?.details ?? null,
    })),
  });

  await logAudit({
    userId: session.user.id,
    action: "ALERT_BULK_CREATED",
    entityType: "Alert",
    entityId: deviceIds.join(","),
    after: {
      count: created.count,
      skipped: deviceIds.length - createIds.length,
      type,
      severity,
    },
  });

  return NextResponse.json({
    createdCount: created.count,
    skippedCount: deviceIds.length - createIds.length,
  });
}
