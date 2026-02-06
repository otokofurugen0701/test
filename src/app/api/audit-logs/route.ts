import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const entityType = searchParams.get("entityType");
  const userId = searchParams.get("userId");
  const action = searchParams.get("action");

  const where: Prisma.AuditLogWhereInput = {};
  const andFilters: Prisma.AuditLogWhereInput[] = [];

  if (entityType) andFilters.push({ entityType });
  if (userId) andFilters.push({ userId });
  if (action) andFilters.push({ action: { contains: action, mode: "insensitive" } });
  if (andFilters.length > 0) where.AND = andFilters;

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: true },
    orderBy: { ts: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: logs });
}
