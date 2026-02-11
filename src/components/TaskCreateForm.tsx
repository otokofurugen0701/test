"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

type TaskCreateFormProps = {
  devices: Option[];
  users: Option[];
};

export function TaskCreateForm({ devices, users }: TaskCreateFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [type, setType] = useState("COLLECTION");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deviceId) return;

    startTransition(async () => {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          type,
          assigneeUserId: assigneeUserId || null,
          dueAt: dueAt || null,
          notes: notes || null,
        }),
      });
      setNotes("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">新規タスク作成</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-5">
        <select
          value={deviceId}
          onChange={(event) => setDeviceId(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.name}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="COLLECTION">回収</option>
          <option value="MAINTENANCE">保守</option>
        </select>
        <select
          value={assigneeUserId}
          onChange={(event) => setAssigneeUserId(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">担当者未設定</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="text"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="作業メモ"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "作成中..." : "作成"}
        </button>
      </div>
    </form>
  );
}
