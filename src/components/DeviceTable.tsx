"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

type DeviceRow = {
  id: string;
  name: string;
  deviceCode: string;
  siteName: string;
  fillLevel: string;
  battery: string;
  lastSeen: string;
  full: boolean;
  lowBattery: boolean;
  offline: boolean;
};

type DeviceTableProps = {
  rows: DeviceRow[];
  sites: Option[];
};

export function DeviceTable({ rows, sites }: DeviceTableProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkSiteId, setBulkSiteId] = useState("");
  const [isPending, startTransition] = useTransition();

  const allSelected = useMemo(() => rows.length > 0 && selected.length === rows.length, [rows, selected]);

  const toggleAll = () => {
    setSelected(allSelected ? [] : rows.map((row) => row.id));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const bulkUpdate = (siteId: string | null) => {
    if (selected.length === 0) return;
    startTransition(async () => {
      await fetch("/api/devices/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceIds: selected, siteId }),
      });
      setSelected([]);
      setBulkSiteId("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs">
          <div className="text-slate-600">選択中: {selected.length}件</div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkSiteId}
              onChange={(event) => setBulkSiteId(event.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            >
              <option value="">サイトを選択</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => bulkUpdate(bulkSiteId || null)}
              disabled={isPending || !bulkSiteId}
              className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-60"
            >
              サイト割当
            </button>
            <button
              onClick={() => bulkUpdate(null)}
              disabled={isPending}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              サイト解除
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs text-slate-600">
            <tr>
              <th className="px-4 py-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3">デバイス</th>
              <th className="px-4 py-3">サイト</th>
              <th className="px-4 py-3">積載量</th>
              <th className="px-4 py-3">電池</th>
              <th className="px-4 py-3">状態</th>
              <th className="px-4 py-3">最終通信</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200">
                <td className="px-4 py-3">
                  <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggleOne(row.id)} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/devices/${row.id}`} className="font-semibold text-slate-900 hover:underline">
                    {row.name}
                  </Link>
                  <div className="text-xs text-slate-500">{row.deviceCode}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.siteName}</td>
                <td className="px-4 py-3">{row.fillLevel}</td>
                <td className="px-4 py-3">{row.battery}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {row.full && (
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-xs text-rose-700">満杯</span>
                    )}
                    {row.lowBattery && (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
                        電池低下
                      </span>
                    )}
                    {row.offline && (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">
                        オフライン
                      </span>
                    )}
                    {!row.full && !row.lowBattery && !row.offline && (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
                        正常
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.lastSeen}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                  該当するデバイスがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
