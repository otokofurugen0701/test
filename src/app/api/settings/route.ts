import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { isAlertTemplates, isTaskTemplates } from "@/lib/templates";
import { Prisma } from "@prisma/client";
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

  const hasTaskTemplates = Object.prototype.hasOwnProperty.call(body ?? {}, "taskTemplatesJson");
  const hasAlertTemplates = Object.prototype.hasOwnProperty.call(body ?? {}, "alertTemplatesJson");

  const taskTemplatesJson = hasTaskTemplates
    ? parseTemplates(body?.taskTemplatesJson, isTaskTemplates)
    : undefined;
  if (taskTemplatesJson && (taskTemplatesJson as { error?: boolean }).error) {
    return NextResponse.json({ error: "Invalid task templates" }, { status: 400 });
  }
  const alertTemplatesJson = hasAlertTemplates
    ? parseTemplates(body?.alertTemplatesJson, isAlertTemplates)
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
              ? undefined
              : taskTemplatesJson === null
                ? Prisma.DbNull
                : (taskTemplatesJson as object),
          alertTemplatesJson:
            alertTemplatesJson === undefined
              ? undefined
              : alertTemplatesJson === null
                ? Prisma.DbNull
                : (alertTemplatesJson as object),
        },
      })
    : await prisma.settings.create({
        data: {
          fullThreshold: body?.fullThreshold ?? 85,
          lowBatteryThreshold: body?.lowBatteryThreshold ?? 20,
          offlineMinutes: body?.offlineMinutes ?? 30,
          taskTemplatesJson:
            taskTemplatesJson === undefined || taskTemplatesJson === null
              ? Prisma.DbNull
              : (taskTemplatesJson as object),
          alertTemplatesJson:
            alertTemplatesJson === undefined || alertTemplatesJson === null
              ? Prisma.DbNull
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
