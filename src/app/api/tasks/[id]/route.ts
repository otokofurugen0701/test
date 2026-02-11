import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { TaskStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await request.json();
  const nextStatus = body?.status as TaskStatus | undefined;

  if (nextStatus && !Object.values(TaskStatus).includes(nextStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.task.update({
    where: { id: existing.id },
    data: {
      status: nextStatus ?? existing.status,
      assigneeUserId: body?.assigneeUserId ?? existing.assigneeUserId,
      dueAt: body?.dueAt ? new Date(body.dueAt) : existing.dueAt,
      notes: body?.notes ?? existing.notes,
      completedAt: nextStatus
        ? nextStatus === TaskStatus.DONE
          ? new Date()
          : null
        : existing.completedAt,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "TASK_UPDATED",
    entityType: "Task",
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
  const existing = await prisma.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id: existing.id } });

  await logAudit({
    userId: session.user.id,
    action: "TASK_DELETED",
    entityType: "Task",
    entityId: existing.id,
    before: existing,
  });

  return NextResponse.json({ ok: true });
}
