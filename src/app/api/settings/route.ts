import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await prisma.settings.findFirst();
  return NextResponse.json({ data: settings });
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await prisma.settings.findFirst();
  const body = await request.json();

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const validateTaskTemplates = (value: unknown) =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        (item.type === "COLLECTION" || item.type === "MAINTENANCE") &&
        typeof item.dueOffsetDays === "number" &&
        typeof item.notes === "string"
    );

  const validateAlertTemplates = (value: unknown) =>
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        (item.type === "FULL" || item.type === "LOW_BATTERY" || item.type === "OFFLINE") &&
        (item.severity === "LOW" || item.severity === "MEDIUM" || item.severity === "HIGH") &&
        typeof item.notes === "string"
    );

  const parseTemplates = (value: unknown, validator: (parsed: unknown) => boolean) => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = value;
    if (!validator(parsed)) {
      return { error: true };
    }
    return parsed;
  };

  const hasTaskTemplates = Object.prototype.hasOwnProperty.call(body ?? {}, "taskTemplatesJson");
  const hasAlertTemplates = Object.prototype.hasOwnProperty.call(body ?? {}, "alertTemplatesJson");

  const taskTemplatesJson = hasTaskTemplates
    ? parseTemplates(body?.taskTemplatesJson, validateTaskTemplates)
    : undefined;
  if (taskTemplatesJson && (taskTemplatesJson as { error?: boolean }).error) {
    return NextResponse.json({ error: "Invalid task templates" }, { status: 400 });
  }
  const alertTemplatesJson = hasAlertTemplates
    ? parseTemplates(body?.alertTemplatesJson, validateAlertTemplates)
    : undefined;
  if (alertTemplatesJson && (alertTemplatesJson as { error?: boolean }).error) {
    return NextResponse.json({ error: "Invalid alert templates" }, { status: 400 });
  }

  const updated = existing
    ? await prisma.settings.update({
        where: { id: existing.id },
        data: {
          fullThreshold: body?.fullThreshold ?? existing.fullThreshold,
          lowBatteryThreshold: body?.lowBatteryThreshold ?? existing.lowBatteryThreshold,
          offlineMinutes: body?.offlineMinutes ?? existing.offlineMinutes,
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
      })
    : await prisma.settings.create({
        data: {
          fullThreshold: body?.fullThreshold ?? 85,
          lowBatteryThreshold: body?.lowBatteryThreshold ?? 20,
          offlineMinutes: body?.offlineMinutes ?? 30,
          taskTemplatesJson:
            taskTemplatesJson === undefined
              ? null
              : taskTemplatesJson === null
                ? null
                : (taskTemplatesJson as object),
          alertTemplatesJson:
            alertTemplatesJson === undefined
              ? null
              : alertTemplatesJson === null
                ? null
                : (alertTemplatesJson as object),
        },
      });

  await logAudit({
    userId: session.user.id,
    action: "SETTINGS_UPDATED",
    entityType: "Settings",
    entityId: updated.id,
    before: existing ?? undefined,
    after: updated,
  });

  return NextResponse.json({ data: updated });
}
