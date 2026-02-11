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
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sites = await prisma.site.findMany({
    include: { devices: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: sites });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

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

  const taskTemplatesJson = parseTemplates(body?.taskTemplatesJson, isTaskTemplates);
  if (taskTemplatesJson && (taskTemplatesJson as { error?: boolean }).error) {
    return NextResponse.json({ error: "Invalid task templates" }, { status: 400 });
  }
  const alertTemplatesJson = parseTemplates(body?.alertTemplatesJson, isAlertTemplates);
  if (alertTemplatesJson && (alertTemplatesJson as { error?: boolean }).error) {
    return NextResponse.json({ error: "Invalid alert templates" }, { status: 400 });
  }

  const created = await prisma.site.create({
    data: {
      name: body.name,
      address: body.address ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      notes: body.notes ?? null,
      fullThresholdOverride:
        body.fullThresholdOverride === "" || body.fullThresholdOverride === undefined
          ? null
          : Number(body.fullThresholdOverride),
      lowBatteryThresholdOverride:
        body.lowBatteryThresholdOverride === "" || body.lowBatteryThresholdOverride === undefined
          ? null
          : Number(body.lowBatteryThresholdOverride),
      offlineMinutesOverride:
        body.offlineMinutesOverride === "" || body.offlineMinutesOverride === undefined
          ? null
          : Number(body.offlineMinutesOverride),
      taskTemplatesJson:
        taskTemplatesJson === null || taskTemplatesJson === undefined
          ? Prisma.DbNull
          : (taskTemplatesJson as object),
      alertTemplatesJson:
        alertTemplatesJson === null || alertTemplatesJson === undefined
          ? Prisma.DbNull
          : (alertTemplatesJson as object),
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "SITE_CREATED",
    entityType: "Site",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
