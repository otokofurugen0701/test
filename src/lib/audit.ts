import { prisma } from "@/lib/db";

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

export async function logAudit({
  userId,
  action,
  entityType,
  entityId,
  before,
  after,
}: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId,
        beforeJson: before ?? undefined,
        afterJson: after ?? undefined,
      },
    });
  } catch (error) {
    console.error("Audit log failed", error);
  }
}
