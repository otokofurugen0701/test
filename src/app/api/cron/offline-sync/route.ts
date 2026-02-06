import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getThresholds } from "@/lib/settings";
import { syncOfflineAlertsForDevices } from "@/lib/alerting";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiKey =
    request.headers.get("x-api-key") ??
    request.nextUrl.searchParams.get("api_key") ??
    request.nextUrl.searchParams.get("key");

  if (!process.env.CRON_API_KEY || apiKey !== process.env.CRON_API_KEY) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const thresholds = await getThresholds();
  const devices = await prisma.device.findMany({ select: { id: true, lastSeenAt: true } });

  await syncOfflineAlertsForDevices(devices, thresholds.offlineMinutes);

  return NextResponse.json({ ok: true, devices: devices.length });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
