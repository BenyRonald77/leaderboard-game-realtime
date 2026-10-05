"use client";

import { useEffect, useState } from "react";
import { getStoredPlayer, StoredPlayer, authHeaders } from "@/lib/player-client";

interface Friend { id: number; username: string; friendCode: string; bestScore: number }

export default function TemanPage() {
  const [player, setPlayer] = useState<StoredPlayer | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myCode, setMyCode] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  async function load(p: StoredPlayer) {
    const res = await fetch("/api/friends", { headers: authHeaders(p) });
    if (!res.ok) return;
    const data = await res.json();
    setFriends(data.friends);
    setMyCode(data.myCode);
  }

  useEffect(() => {
    const p = getStoredPlayer();
    setPlayer(p);
    if (p) load(p);
  }, []);

  async function tambah() {
    if (!player) return;
    setMsg("");
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: authHeaders(player),
      body: JSON.stringify({ friendCode: code }),
    });
    const data = await res.json();
    if (!res.ok) { setMsg(`❌ ${data.error}`); return; }
    setMsg(`✅ Berteman dengan ${data.friend.username}!`);
    setCode("");
    load(player);
  }

  if (!player) {
    return <p className="text-slate-600">Daftar dulu di halaman <a href="/" className="text-blue-600 underline">Main</a>.</p>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">👥 Teman</h1>
      <p className="text-slate-600 text-sm mb-4">
        Bagikan kodemu ke teman: <b className="text-slate-900 text-base">{myCode}</b>
      </p>

      <div className="max-w-sm rounded-xl bg-white shadow p-4 mb-6">
        <h2 className="font-semibold mb-2 text-sm">Tambah teman via kode</h2>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="mis. ABC-123DEF"
            className="flex-1 border rounded-lg px-3 py-2 uppercase"
            maxLength={10}
          />
          <button onClick={tambah} className="bg-slate-900 text-white rounded-lg px-4 font-medium hover:bg-slate-700">
            Tambah
          </button>
        </div>
        {msg && <p className="text-sm mt-2">{msg}</p>}
      </div>

      <h2 className="font-semibold mb-2">Daftar teman ({friends.length})</h2>
      {friends.length === 0 ? (
        <p className="text-slate-500 text-sm">Belum ada teman. Tambahkan lewat kode di atas!</p>
      ) : (
        <div className="grid gap-2 max-w-md">
          {friends.map((f) => (
            <div key={f.id} className="rounded-lg bg-white shadow px-4 py-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{f.username}</p>
                <p className="text-xs text-slate-500">{f.friendCode}</p>
              </div>
              <p className="font-mono font-bold text-emerald-700">{f.bestScore}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
