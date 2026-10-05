"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredPlayer, StoredPlayer, authHeaders } from "@/lib/player-client";

type Board = "global" | "weekly" | "friends";
const TABS: { key: Board; label: string }[] = [
  { key: "global", label: "🌍 Global" },
  { key: "weekly", label: "📅 Mingguan" },
  { key: "friends", label: "👥 Teman" },
];

interface Entry { playerId: number; username: string; score: number; rank: number }

export default function LeaderboardPage() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [board, setBoard] = useState<Board>("global");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [live, setLive] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const load = useCallback(async (b: Board, p: StoredPlayer | null) => {
    const headers = p ? { "x-player-token": p.token } : undefined;
    const res = await fetch(`/api/leaderboard?board=${b}&limit=20`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    setEntries(data.entries);
    setTotal(data.total);
  }, []);

  useEffect(() => {
    const p = getStoredPlayer();
    setPlayer(p);
    load("global", p);

    // SSE realtime; fallback polling 5 detik bila SSE gagal.
    let poll: ReturnType<typeof setInterval> | null = null;
    let sseOk = false;
    try {
      const es = new EventSource("/api/leaderboard/stream");
      esRef.current = es;
      es.addEventListener("update", () => {
        sseOk = true;
        setLive(true);
        load(board, getStoredPlayer());
      });
      es.onerror = () => {
        if (!sseOk && !poll) {
          poll = setInterval(() => load(board, getStoredPlayer()), 5000);
        }
      };
    } catch {
      poll = setInterval(() => load(board, getStoredPlayer()), 5000);
    }
    return () => {
      esRef.current?.close();
      if (poll) clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(board, player); }, [board, player, load]);

  function medal(rank: number) {
    return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">🏆 Leaderboard</h1>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${live ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
          {live ? "● LIVE (SSE)" : "○ polling"}
        </span>
      </div>

      <div className="flex gap-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setBoard(t.key)}
            className={`px-4 py-2 rounded-lg font-medium text-sm ${board === t.key ? "bg-slate-900 text-white" : "bg-white text-slate-700 border"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {board === "friends" && !player && (
        <p className="text-slate-600 text-sm">Daftar dulu di halaman Main untuk melihat leaderboard teman.</p>
      )}

      <div className="rounded-xl bg-white shadow overflow-hidden">
        {entries.length === 0 ? (
          <p className="p-6 text-slate-500 text-sm">Belum ada skor di board ini.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr><th className="text-left px-4 py-2">Peringkat</th><th className="text-left px-4 py-2">Pemain</th><th className="text-right px-4 py-2">Skor</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.playerId} className={`border-t ${player?.id === e.playerId ? "bg-amber-50 font-bold" : ""}`}>
                  <td className="px-4 py-2">{medal(e.rank)}</td>
                  <td className="px-4 py-2">{e.username}{player?.id === e.playerId ? " (kamu)" : ""}</td>
                  <td className="px-4 py-2 text-right font-mono">{e.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">{total} pemain di board ini.</p>
    </div>
  );
}
