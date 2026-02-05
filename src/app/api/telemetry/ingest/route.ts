import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getThresholds, isOffline } from "@/lib/settings";
import { upsertThresholdAlert, syncOfflineAlert } from "@/lib/alerting";
import { AlertSeverity, AlertType } from "@prisma/client";

export const runtime = "nodejs";

const telemetrySchema = z.object({
  deviceCode: z.string().min(1),
  ts: z.string().datetime().optional(),
  fill_level_pct: z.coerce.number().int().min(0).max(100).optional(),
  fillLevelPct: z.coerce.number().int().min(0).max(100).optional(),
  battery_pct: z.coerce.number().int().min(0).max(100).optional(),
  batteryPct: z.coerce.number().int().min(0).max(100).optional(),
  door_open: z.boolean().optional(),
  doorOpen: z.boolean().optional(),
  temp_c: z.coerce.number().optional(),
  tempC: z.coerce.number().optional(),
  rssi: z.coerce.number().optional(),
  raw: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const apiKey =
    request.headers.get("x-api-key") ??
    request.nextUrl.searchParams.get("api_key") ??
    request.nextUrl.searchParams.get("key");

  if (!process.env.TELEMETRY_API_KEY || apiKey !== process.env.TELEMETRY_API_KEY) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = telemetrySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const device = await prisma.device.findUnique({ where: { deviceCode: data.deviceCode } });

  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  const ts = data.ts ? new Date(data.ts) : new Date();
  const fillLevelPct = data.fillLevelPct ?? data.fill_level_pct ?? null;
  const batteryPct = data.batteryPct ?? data.battery_pct ?? null;
  const doorOpen = data.doorOpen ?? data.door_open ?? null;
  const tempC = data.tempC ?? data.temp_c ?? null;
  const rssi = data.rssi ?? null;

  await prisma.telemetry.create({
    data: {
      deviceId: device.id,
      ts,
      fillLevelPct,
      batteryPct,
      doorOpen,
      tempC,
      rssi,
      rawJson: data.raw ?? body,
    },
  });

  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: ts,
      lastFillLevelPct: fillLevelPct ?? undefined,
      lastBatteryPct: batteryPct ?? undefined,
      lastDoorOpen: doorOpen ?? undefined,
      lastTempC: tempC ?? undefined,
      lastRssi: rssi ?? undefined,
    },
  });

  const thresholds = await getThresholds();

  if (fillLevelPct !== null) {
    await upsertThresholdAlert({
      deviceId: device.id,
      type: AlertType.FULL,
      active: fillLevelPct >= thresholds.fullThreshold,
      severity: AlertSeverity.HIGH,
      details: { current: fillLevelPct, threshold: thresholds.fullThreshold },
    });
  }

  if (batteryPct !== null) {
    await upsertThresholdAlert({
      deviceId: device.id,
      type: AlertType.LOW_BATTERY,
      active: batteryPct <= thresholds.lowBatteryThreshold,
      severity: AlertSeverity.MEDIUM,
      details: { current: batteryPct, threshold: thresholds.lowBatteryThreshold },
    });
  }

  await syncOfflineAlert(device, isOffline(ts, thresholds.offlineMinutes));

  return NextResponse.json({ ok: true });
}
