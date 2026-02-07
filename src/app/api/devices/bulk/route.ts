import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const deviceIds = Array.isArray(body?.deviceIds) ? body.deviceIds : [];
  const siteId = body?.siteId ?? null;

  if (deviceIds.length === 0) {
    return NextResponse.json({ error: "deviceIds are required" }, { status: 400 });
  }

  if (siteId) {
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
  }

  const updated = await prisma.device.updateMany({
    where: { id: { in: deviceIds } },
    data: { siteId },
  });

  await logAudit({
    userId: session.user.id,
    action: "DEVICE_BULK_SITE_UPDATED",
    entityType: "Device",
    entityId: deviceIds.join(","),
    after: { siteId, count: updated.count },
  });

  return NextResponse.json({ updatedCount: updated.count });
}
