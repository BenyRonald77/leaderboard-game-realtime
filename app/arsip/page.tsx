"use client";

import { useEffect, useState } from "react";

interface Archive { board: string; weekKey: string; rank: number; username: string; score: number }
interface Season {
  id: number;
  label: string;
  startsAt: string;
  endsAt: string | null;
  active: boolean;
  archives: Archive[];
}

export default function ArsipPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);

  useEffect(() => {
    fetch("/api/seasons").then((r) => r.json()).then((d) => setSeasons(d.seasons)).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">🗂️ Arsip Musim</h1>
      <p className="text-slate-600 text-sm mb-6">
        Setiap musim yang direset akan diarsipkan di sini (peringkat akhir global & mingguan).
      </p>
      {seasons.length === 0 && <p className="text-slate-500 text-sm">Memuat…</p>}
      {seasons.map((s) => (
        <div key={s.id} className="mb-6 rounded-xl bg-white shadow overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center">
            <b>{s.label}</b>
            {s.active
              ? <span className="text-xs bg-emerald-500 px-2 py-1 rounded-full">berjalan</span>
              : <span className="text-xs bg-slate-600 px-2 py-1 rounded-full">selesai</span>}
          </div>
          {s.archives.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              {s.active ? "Musim masih berjalan — arsip dibuat saat musim direset." : "Tidak ada arsip."}
            </p>
          ) : (
            ["global", "weekly"].map((b) => {
              const rows = s.archives.filter((a) => a.board === b).slice(0, 10);
              if (rows.length === 0) return null;
              return (
                <div key={b} className="p-4">
                  <h3 className="font-semibold text-sm mb-2">
                    {b === "global" ? "🌍 Global" : `📅 Mingguan${rows[0]?.weekKey ? ` (${rows[0].weekKey})` : ""}`}
                  </h3>
                  <table className="w-full text-sm">
                    <tbody>
                      {rows.map((a, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-1 w-12">#{a.rank}</td>
                          <td className="py-1">{a.username}</td>
                          <td className="py-1 text-right font-mono">{a.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}
