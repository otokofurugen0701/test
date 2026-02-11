import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { Role } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ data: users });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  if (!body?.email || !body?.password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const created = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name ?? null,
      passwordHash,
      role: body.role && Object.values(Role).includes(body.role) ? body.role : Role.OPERATOR,
    },
  });

  await logAudit({
    userId: session.user.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: created.id,
    after: created,
  });

  const response = {
    id: created.id,
    email: created.email,
    name: created.name,
    role: created.role,
    createdAt: created.createdAt,
  };

  return NextResponse.json({ data: response }, { status: 201 });
}
