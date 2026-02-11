import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isAlertTemplates, isTaskTemplates } from "@/lib/templates";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const body = await request.json();
  const parseNullableNumber = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? null : numberValue;
  };
  const hasKey = (key: string) => Object.prototype.hasOwnProperty.call(body ?? {}, key);
  const parseTemplates = (value: unknown, validator: (parsed: unknown) => boolean) => {
    if (value === null || value === undefined || value === "") return null;
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (!validator(parsed)) {
        return { error: true };
      }
      return parsed;
    } catch {
      return { error: true };
    }
  };
  const taskTemplatesJson = hasKey("taskTemplatesJson")
    ? parseTemplates(body?.taskTemplatesJson, isTaskTemplates)
    : undefined;
  if (taskTemplatesJson && (taskTemplatesJson as { error?: boolean }).error) {
    return NextResponse.json({ error: "Invalid task templates" }, { status: 400 });
  }
  const alertTemplatesJson = hasKey("alertTemplatesJson")
    ? parseTemplates(body?.alertTemplatesJson, isAlertTemplates)
    : undefined;
  if (alertTemplatesJson && (alertTemplatesJson as { error?: boolean }).error) {
    return NextResponse.json({ error: "Invalid alert templates" }, { status: 400 });
  }
  const updated = await prisma.site.update({
    where: { id: existing.id },
    data: {
      name: body?.name ?? existing.name,
      address: body?.address ?? existing.address,
      lat: body?.lat ?? existing.lat,
      lng: body?.lng ?? existing.lng,
      notes: body?.notes ?? existing.notes,
      fullThresholdOverride: hasKey("fullThresholdOverride")
        ? parseNullableNumber(body?.fullThresholdOverride)
        : existing.fullThresholdOverride,
      lowBatteryThresholdOverride: hasKey("lowBatteryThresholdOverride")
        ? parseNullableNumber(body?.lowBatteryThresholdOverride)
        : existing.lowBatteryThresholdOverride,
      offlineMinutesOverride: hasKey("offlineMinutesOverride")
        ? parseNullableNumber(body?.offlineMinutesOverride)
        : existing.offlineMinutesOverride,
      taskTemplatesJson:
        taskTemplatesJson === undefined
          ? existing.taskTemplatesJson
          : taskTemplatesJson === null
            ? null
            : (taskTemplatesJson as object),
      alertTemplatesJson:
        alertTemplatesJson === undefined
          ? existing.alertTemplatesJson
          : alertTemplatesJson === null
            ? null
            : (alertTemplatesJson as object),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "SITE_UPDATED",
    entityType: "Site",
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
  const existing = await prisma.site.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  await prisma.device.updateMany({
    where: { siteId: existing.id },
    data: { siteId: null },
  });
  await prisma.site.delete({ where: { id: existing.id } });

  await logAudit({
    userId: session.user.id,
    action: "SITE_DELETED",
    entityType: "Site",
    entityId: existing.id,
    before: existing,
  });

  return NextResponse.json({ ok: true });
}
