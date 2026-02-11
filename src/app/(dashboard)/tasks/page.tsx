import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { TaskStatusSelect } from "@/components/TaskStatusSelect";
import { TaskCreateForm } from "@/components/TaskCreateForm";
import type { Prisma, TaskStatus } from "@prisma/client";

type TasksPageProps = {
  searchParams: {
    status?: TaskStatus;
    assigneeUserId?: string;
  };
};

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const where: Prisma.TaskWhereInput = {};
  const andFilters: Prisma.TaskWhereInput[] = [];
  if (searchParams.status) andFilters.push({ status: searchParams.status });
  if (searchParams.assigneeUserId) andFilters.push({ assigneeUserId: searchParams.assigneeUserId });
  if (andFilters.length > 0) where.AND = andFilters;

  const [tasks, devices, users] = await Promise.all([
    prisma.task.findMany({
      where,
      include: { device: true, assignee: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.device.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Tasks</h2>
        <p className="text-sm text-slate-600">回収・保守タスクの進行管理</p>
      </div>

      <TaskCreateForm
        devices={devices.map((device) => ({ id: device.id, name: device.name }))}
        users={users.map((user) => ({ id: user.id, name: user.name ?? user.email }))}
      />

      <form className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全てのステータス</option>
            <option value="TODO">未着手</option>
            <option value="IN_PROGRESS">進行中</option>
            <option value="DONE">完了</option>
          </select>
          <select
            name="assigneeUserId"
            defaultValue={searchParams.assigneeUserId ?? ""}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全ての担当者</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name ?? user.email}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex justify-end">
          <button className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white">フィルタ</button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3">種別</th>
              <th className="px-4 py-3">デバイス</th>
              <th className="px-4 py-3">担当者</th>
              <th className="px-4 py-3">期限</th>
              <th className="px-4 py-3">ステータス</th>
              <th className="px-4 py-3">メモ</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-slate-200">
                <td className="px-4 py-3 font-semibold text-slate-900">{task.type}</td>
                <td className="px-4 py-3 text-slate-600">{task.device.name}</td>
                <td className="px-4 py-3 text-slate-600">{task.assignee?.name ?? task.assignee?.email ?? "-"}</td>
                <td className="px-4 py-3 text-slate-600">{formatDateTime(task.dueAt)}</td>
                <td className="px-4 py-3">
                  <TaskStatusSelect taskId={task.id} status={task.status} />
                </td>
                <td className="px-4 py-3 text-slate-600">{task.notes ?? "-"}</td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                  タスクがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
