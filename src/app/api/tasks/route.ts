import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { Prisma, TaskStatus, TaskType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as TaskStatus | null;
  const assigneeUserId = searchParams.get("assigneeUserId");
  const deviceId = searchParams.get("deviceId");

  const where: Prisma.TaskWhereInput = {};
  const andFilters: Prisma.TaskWhereInput[] = [];

  if (status) andFilters.push({ status });
  if (assigneeUserId) andFilters.push({ assigneeUserId });
  if (deviceId) andFilters.push({ deviceId });
  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      device: { include: { site: true } },
      assignee: true,
      alert: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: tasks });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body?.deviceId || !body?.type) {
    return NextResponse.json({ error: "deviceId and type are required" }, { status: 400 });
  }

  const created = await prisma.task.create({
    data: {
      deviceId: body.deviceId,
      alertId: body.alertId ?? null,
      type: body.type as TaskType,
      status: body.status ?? "TODO",
      assigneeUserId: body.assigneeUserId ?? null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      notes: body.notes ?? null,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "TASK_CREATED",
    entityType: "Task",
    entityId: created.id,
    after: created,
  });

  return NextResponse.json({ data: created }, { status: 201 });
}
