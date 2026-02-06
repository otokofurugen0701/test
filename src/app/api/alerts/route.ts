import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getThresholds, isOffline, resolveThresholds } from "@/lib/settings";
import { syncOfflineAlert } from "@/lib/alerting";
import type { AlertStatus, AlertType, AlertSeverity, Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
