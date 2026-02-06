import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getThresholds, isOffline, resolveThresholds } from "@/lib/settings";
import { syncOfflineAlert } from "@/lib/alerting";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiKey =
    request.headers.get("x-api-key") ??
    request.nextUrl.searchParams.get("api_key") ??
    request.nextUrl.searchParams.get("key");

  if (!process.env.CRON_API_KEY || apiKey !== process.env.CRON_API_KEY) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
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

  return NextResponse.json({ ok: true, devices: devices.length });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
