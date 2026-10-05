"use client";

import { useEffect, useState } from "react";
import { getStoredPlayer, StoredPlayer, authHeaders } from "@/lib/player-client";

interface Entry { playerId: number; username: string; score: number; rank: number }
interface RankData {
  rank: number | null;
  total: number;
  entries: Entry[];
  message?: string;
}

export default function ProfilPage() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [board, setBoard] = useState<"global" | "weekly">("global");
  const [data, setData] = useState<RankData | null>(null);

  useEffect(() => { setPlayer(getStoredPlayer()); }, []);
  useEffect(() => {
    const p = getStoredPlayer();
    if (!p) return;
    fetch(`/api/rank/me?board=${board}&window=5`, { headers: authHeaders(p) })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [board]);

  if (!player) {
    return <p className="text-slate-600">Daftar dulu di halaman <a href="/" className="text-blue-600 underline">Main</a> untuk melihat peringkatmu.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">👤 Peringkat Saya</h1>
      <p className="text-slate-600 text-sm mb-4">{player.username} · Kode teman: <b>{player.friendCode}</b></p>

      <div className="flex gap-2 mb-4">
        {(["global", "weekly"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBoard(b)}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${board === b ? "bg-slate-900 text-white" : "bg-white text-slate-700 border"}`}
          >
            {b === "global" ? "🌍 Global" : "📅 Mingguan"}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="text-slate-500 text-sm">Memuat…</p>
      ) : data.rank === null ? (
        <p className="text-slate-600">{data.message}</p>
      ) : (
        <div className="max-w-md rounded-xl bg-white shadow overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white text-sm">
            Peringkat <b>#{data.rank}</b> dari {data.total} pemain
          </div>
          <table className="w-full text-sm">
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.playerId} className={`border-t ${e.playerId === player.id ? "bg-amber-100 font-bold" : ""}`}>
                  <td className="px-4 py-2 w-16">#{e.rank}</td>
                  <td className="px-4 py-2">{e.username}{e.playerId === player.id ? " ← kamu" : ""}</td>
                  <td className="px-4 py-2 text-right font-mono">{e.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
