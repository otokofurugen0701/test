"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

type AlertStatusSelectProps = {
  alertId: string;
  status: string;
};

export function AlertStatusSelect({ alertId, status }: AlertStatusSelectProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = event.target.value;
    startTransition(async () => {
      await fetch(`/api/alerts/${alertId}`, {
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
      <option value="OPEN">未対応</option>
      <option value="IN_PROGRESS">対応中</option>
      <option value="RESOLVED">解決</option>
    </select>
  );
}
