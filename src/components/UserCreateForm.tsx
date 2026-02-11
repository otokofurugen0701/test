"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function UserCreateForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("OPERATOR");
  const [password, setPassword] = useState("");

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) return;
    startTransition(async () => {
      await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, role, password }),
      });
      setEmail("");
      setName("");
      setRole("OPERATOR");
      setPassword("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">ユーザー追加</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="氏名"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="初期パスワード"
          type="password"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ADMIN">Admin</option>
          <option value="OPERATOR">Operator</option>
        </select>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "作成中..." : "追加"}
        </button>
      </div>
    </form>
  );
}
