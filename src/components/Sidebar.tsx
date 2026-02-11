"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { SignOutButton } from "@/components/SignOutButton";

const baseLinks = [
  { href: "/devices", label: "Devices" },
  { href: "/alerts", label: "Alerts" },
  { href: "/tasks", label: "Tasks" },
  { href: "/sites", label: "Sites" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";

  const links = isAdmin
    ? [...baseLinks, { href: "/users", label: "Users" }, { href: "/audit-logs", label: "Audit Logs" }]
    : baseLinks.filter((link) => link.href !== "/settings");

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-slate-200 bg-white px-4 py-6">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-slate-900">スマゴミ運用</h1>
        <p className="text-xs text-slate-500">IoTゴミ箱ダッシュボード</p>
      </div>
      <nav className="flex-1 space-y-1">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium ${
                active
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 text-xs text-slate-500">
        <p>{session?.user?.email}</p>
        <SignOutButton />
      </div>
    </aside>
  );
}
