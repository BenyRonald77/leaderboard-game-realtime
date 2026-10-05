"use client";

import { useEffect, useRef, useState } from "react";
import {
  getStoredPlayer,
  setStoredPlayer,
  authHeaders,
  StoredPlayer,
} from "@/lib/player-client";

type Phase = "daftar" | "siap" | "main" | "kirim" | "hasil";

interface SessionInfo {
  sessionToken: string;
  secret: string;
  serverStart: number;
  durationMs: number;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomPos() {
  return { x: 5 + Math.random() * 80, y: 10 + Math.random() * 70 };
}

export default function GamePage() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("daftar");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [remaining, setRemaining] = useState(30);
  const [pos, setPos] = useState(randomPos());
  const [result, setResult] = useState<any>(null);
  const clicksRef = useRef<number[]>([]);
  const startRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setPlayer(getStoredPlayer());
  }, []);
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function daftar() {
    setError("");
    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: name }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Gagal mendaftar"); return; }
    setStoredPlayer(data);
    setPlayer(data);
    setPhase("siap");
  }

  async function mulai() {
    if (!player) return;
    setError("");
    const res = await fetch("/api/game/session", { method: "POST", headers: authHeaders(player) });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Gagal membuat sesi"); return; }
    setSession(data);
    clicksRef.current = [];
    startRef.current = Date.now();
    setRemaining(Math.ceil(data.durationMs / 1000));
    setPos(randomPos());
    setPhase("main");
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, Math.ceil((data.durationMs - elapsed) / 1000));
      setRemaining(left);
      if (left <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        selesai(data, startRef.current);
      }
    }, 100);
  }

  function klikTarget() {
    if (phase !== "main") return;
    clicksRef.current.push(Date.now());
    setPos(randomPos());
  }

  async function selesai(sess: SessionInfo, startMs: number) {
    if (!player) return;
    setPhase("kirim");
    const endMs = Date.now();
    const clicks = clicksRef.current;
    const score = clicks.length;
    const durationMs = endMs - startMs;
    try {
      const signature = await hmacHex(
        sess.secret,
        `${player.id}.${score}.${durationMs}.${sess.sessionToken}`
      );
      const res = await fetch("/api/game/submit", {
        method: "POST",
        headers: authHeaders(player),
        body: JSON.stringify({
          playerId: player.id,
          sessionToken: sess.sessionToken,
          score,
          startMs,
          endMs,
          clicks,
          signature,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`Ditolak [${data.rule ?? "?"}]: ${data.error ?? "gagal"}`);
        setPhase("siap");
        return;
      }
      setResult(data);
      setPhase("hasil");
    } catch {
      setError("Gagal mengirim skor (jaringan)");
      setPhase("siap");
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
        ⚠️ <b>Mode non-Redis:</b> leaderboard memakai sorted-set di atas SQLite
        (Redis tidak tersedia di server ini). Realtime SSE tetap jalan dalam satu proses.
      </div>

      <h1 className="text-2xl font-bold mb-1">🎯 Klik Target 30 Detik</h1>
      <p className="text-slate-600 mb-6 text-sm">
        Klik lingkaran target sebanyak-banyaknya dalam 30 detik. Skor diverifikasi
        anti-cheat di server sebelum masuk leaderboard.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {!player && (
        <div className="max-w-sm rounded-xl bg-white shadow p-5">
          <h2 className="font-semibold mb-3">Daftar dulu untuk main</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Username (3-20 karakter)"
            className="w-full border rounded-lg px-3 py-2 mb-3"
            maxLength={20}
          />
          <button onClick={daftar} className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium hover:bg-slate-700">
            Daftar & Main
          </button>
        </div>
      )}

      {player && phase === "siap" && (
        <div className="max-w-sm rounded-xl bg-white shadow p-5">
          <p className="mb-1">Halo, <b>{player.username}</b>! 👋</p>
          <p className="text-sm text-slate-500 mb-4">Kode temanmu: <b className="text-slate-800">{player.friendCode}</b></p>
          <button onClick={mulai} className="w-full bg-emerald-600 text-white rounded-lg py-3 font-bold text-lg hover:bg-emerald-500">
            ▶ Mulai Main (30 detik)
          </button>
        </div>
      )}

      {player && phase === "main" && (
        <div>
          <div className="flex items-center gap-4 mb-3">
            <div className="text-4xl font-black tabular-nums">{remaining}<span className="text-base font-normal text-slate-500"> dtk</span></div>
            <div className="text-xl font-bold text-emerald-700">Klik: {clicksRef.current.length}</div>
          </div>
          <div className="relative w-full h-[60vh] min-h-[320px] rounded-xl bg-slate-900 overflow-hidden select-none touch-none">
            <button
              onClick={klikTarget}
              aria-label="target"
              className="absolute w-16 h-16 rounded-full bg-red-500 border-4 border-white shadow-lg active:scale-90 transition-transform"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%,-50%)" }}
            />
            <p className="absolute bottom-2 w-full text-center text-slate-400 text-xs">Klik lingkaran merah secepatnya!</p>
          </div>
        </div>
      )}

      {phase === "kirim" && <p className="text-slate-600">Mengirim skor & verifikasi anti-cheat…</p>}

      {player && phase === "hasil" && result && (
        <div className="max-w-sm rounded-xl bg-white shadow p-5">
          <h2 className="text-xl font-bold mb-2">Hasil 🎉</h2>
          <p className="text-5xl font-black text-emerald-700 mb-2">{result.score}</p>
          {result.newBest && <p className="mb-2 inline-block bg-amber-100 text-amber-800 text-sm font-bold px-2 py-1 rounded">🏅 Rekor baru!</p>}
          <div className="text-sm text-slate-600 space-y-1 mt-2">
            <p>Peringkat global: <b>#{result.rankGlobal}</b></p>
            <p>Peringkat mingguan: <b>#{result.rankWeekly}</b></p>
            <p>Musim: {result.season}</p>
          </div>
          <button onClick={() => setPhase("siap")} className="mt-4 w-full bg-slate-900 text-white rounded-lg py-2 font-medium hover:bg-slate-700">
            Main Lagi
          </button>
        </div>
      )}
    </div>
  );
}
