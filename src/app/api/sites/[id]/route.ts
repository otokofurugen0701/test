import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.site.findUnique({ where: { id: context.params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const body = await request.json();
  const updated = await prisma.site.update({
    where: { id: existing.id },
    data: {
      name: body?.name ?? existing.name,
      address: body?.address ?? existing.address,
      lat: body?.lat ?? existing.lat,
      lng: body?.lng ?? existing.lng,
      notes: body?.notes ?? existing.notes,
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

export async function DELETE(_request: NextRequest, context: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.site.findUnique({ where: { id: context.params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

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
