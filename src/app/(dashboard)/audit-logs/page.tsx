import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import type { Prisma } from "@prisma/client";

type AuditLogsPageProps = {
  searchParams: {
    entityType?: string;
    userId?: string;
    action?: string;
  };
};

const truncate = (value: unknown, limit = 180) => {
  if (!value) return "-";
  const text = JSON.stringify(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
};

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { name: "asc" },
  });

  const where: Prisma.AuditLogWhereInput = {};
  const andFilters: Prisma.AuditLogWhereInput[] = [];
  if (searchParams.entityType) andFilters.push({ entityType: searchParams.entityType });
  if (searchParams.userId) andFilters.push({ userId: searchParams.userId });
  if (searchParams.action) {
    andFilters.push({ action: { contains: searchParams.action, mode: "insensitive" } });
  }
  if (andFilters.length > 0) where.AND = andFilters;

  const logs = await prisma.auditLog.findMany({
    where,
    include: { user: true },
    orderBy: { ts: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Audit Logs</h2>
        <p className="text-sm text-slate-600">操作履歴の確認（最新200件）</p>
      </div>

      <form className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <input
            name="action"
            placeholder="アクション検索"
            defaultValue={searchParams.action ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="entityType"
            placeholder="Entity Type（例: Task）"
            defaultValue={searchParams.entityType ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            name="userId"
            defaultValue={searchParams.userId ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全てのユーザー</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ?? user.email}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            フィルタ
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3">日時</th>
              <th className="px-4 py-3">ユーザー</th>
              <th className="px-4 py-3">アクション</th>
              <th className="px-4 py-3">対象</th>
              <th className="px-4 py-3">変更内容</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-200 align-top">
                <td className="px-4 py-3 text-slate-600">{formatDateTime(log.ts)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {log.user?.name ?? log.user?.email ?? "system"}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">{log.action}</td>
                <td className="px-4 py-3 text-slate-600">
                  {log.entityType} / {log.entityId}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  <div>before: {truncate(log.beforeJson)}</div>
                  <div>after: {truncate(log.afterJson)}</div>
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                  監査ログはありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
