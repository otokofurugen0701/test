"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type TaskStatusSelectProps = {
  taskId: string;
  status: string;
};

export function TaskStatusSelect({ taskId, status }: TaskStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = event.target.value;
    startTransition(async () => {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      router.refresh();
    });
  };

  return (
    <select
      value={status}
      onChange={onChange}
      disabled={isPending}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
    >
      <option value="TODO">未着手</option>
      <option value="IN_PROGRESS">進行中</option>
      <option value="DONE">完了</option>
    </select>
  );
}
