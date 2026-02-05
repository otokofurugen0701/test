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

  const updated = existing
    ? await prisma.settings.update({
        where: { id: existing.id },
        data: {
          fullThreshold: body?.fullThreshold ?? existing.fullThreshold,
          lowBatteryThreshold: body?.lowBatteryThreshold ?? existing.lowBatteryThreshold,
          offlineMinutes: body?.offlineMinutes ?? existing.offlineMinutes,
        },
      })
    : await prisma.settings.create({
        data: {
          fullThreshold: body?.fullThreshold ?? 85,
          lowBatteryThreshold: body?.lowBatteryThreshold ?? 20,
          offlineMinutes: body?.offlineMinutes ?? 30,
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
