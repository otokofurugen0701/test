"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type CreateTaskFromAlertButtonProps = {
  alertId: string;
  deviceId: string;
  type: string;
};

export function CreateTaskFromAlertButton({ alertId, deviceId, type }: CreateTaskFromAlertButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onClick = () => {
    startTransition(async () => {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          alertId,
          type,
          notes: "アラートから作成",
        }),
      });
      router.refresh();
    });
  };

  return (
    <button
      onClick={onClick}
      disabled={isPending}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {isPending ? "作成中..." : "タスク作成"}
    </button>
  );
}
