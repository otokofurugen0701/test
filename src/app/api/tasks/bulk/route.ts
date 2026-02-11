import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { TaskStatus, TaskType } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const deviceIds = Array.isArray(body?.deviceIds) ? body.deviceIds : [];
  const type = body?.type as TaskType | undefined;

  if (deviceIds.length === 0 || !type || !Object.values(TaskType).includes(type)) {
    return NextResponse.json({ error: "deviceIds and valid type are required" }, { status: 400 });
  }

  const assigneeUserId = body?.assigneeUserId ?? null;
  if (assigneeUserId) {
    const user = await prisma.user.findUnique({ where: { id: assigneeUserId } });
    if (!user) {
      return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
    }
  }

  const dueAt = body?.dueAt ? new Date(body.dueAt) : null;
  const notes = body?.notes ?? "地図から一括作成";

  const existing = await prisma.task.findMany({
    where: {
      deviceId: { in: deviceIds },
      type,
      status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
    },
    select: { deviceId: true },
  });
  const existingSet = new Set(existing.map((item) => item.deviceId));
  const createIds = deviceIds.filter((id: string) => !existingSet.has(id));

  const created = await prisma.task.createMany({
    data: createIds.map((deviceId: string) => ({
      deviceId,
      type,
      status: TaskStatus.TODO,
      assigneeUserId,
      dueAt,
      notes,
    })),
  });

  await logAudit({
    userId: session.user.id,
    action: "TASK_BULK_CREATED",
    entityType: "Task",
    entityId: deviceIds.join(","),
    after: {
      count: created.count,
      skipped: deviceIds.length - createIds.length,
      type,
      assigneeUserId,
      dueAt,
      notes,
    },
  });

  return NextResponse.json({
    createdCount: created.count,
    skippedCount: deviceIds.length - createIds.length,
  });
}
