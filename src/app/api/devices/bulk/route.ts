import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { DeviceStatus } from "@prisma/client";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const deviceIds = Array.isArray(body?.deviceIds) ? body.deviceIds : [];
  const siteId = Object.prototype.hasOwnProperty.call(body ?? {}, "siteId") ? body.siteId : undefined;
  const responsibleUserId = Object.prototype.hasOwnProperty.call(body ?? {}, "responsibleUserId")
    ? body.responsibleUserId
    : undefined;
  const status = Object.prototype.hasOwnProperty.call(body ?? {}, "status") ? body.status : undefined;

  if (deviceIds.length === 0) {
    return NextResponse.json({ error: "deviceIds are required" }, { status: 400 });
  }

  if (siteId === undefined && responsibleUserId === undefined && status === undefined) {
    return NextResponse.json({ error: "siteId, responsibleUserId, or status is required" }, { status: 400 });
  }

  if (siteId) {
    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
  }

  if (responsibleUserId) {
    const user = await prisma.user.findUnique({ where: { id: responsibleUserId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
  }

  const data: { siteId?: string | null; responsibleUserId?: string | null; status?: DeviceStatus } = {};
  if (siteId !== undefined) data.siteId = siteId === "" ? null : siteId;
  if (responsibleUserId !== undefined) {
    data.responsibleUserId = responsibleUserId === "" ? null : responsibleUserId;
  }
  if (status !== undefined && Object.values(DeviceStatus).includes(status)) {
    data.status = status;
  }

  const updated = await prisma.device.updateMany({
    where: { id: { in: deviceIds } },
    data,
  });

  await logAudit({
    userId: session.user.id,
    action: "DEVICE_BULK_UPDATED",
    entityType: "Device",
    entityId: deviceIds.join(","),
    after: {
      siteId: data.siteId,
      responsibleUserId: data.responsibleUserId,
      status: data.status,
      count: updated.count,
    },
  });

  return NextResponse.json({ updatedCount: updated.count });
}
