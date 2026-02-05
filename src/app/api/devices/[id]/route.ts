import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getThresholds, isOffline } from "@/lib/settings";
import { syncOfflineAlert } from "@/lib/alerting";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
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

  const [latestTelemetry, telemetry24h, telemetry7d, thresholds] = await Promise.all([
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
