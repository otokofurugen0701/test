import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { AlertStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const status = body?.status as AlertStatus | undefined;

  if (!status || !Object.values(AlertStatus).includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const existing = await prisma.alert.findUnique({ where: { id: context.params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const updated = await prisma.alert.update({
    where: { id: existing.id },
    data: {
      status,
      closedAt: status === AlertStatus.RESOLVED ? new Date() : null,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "ALERT_STATUS_UPDATED",
    entityType: "Alert",
    entityId: updated.id,
    before: existing,
    after: updated,
  });

  return NextResponse.json({ data: updated });
}
