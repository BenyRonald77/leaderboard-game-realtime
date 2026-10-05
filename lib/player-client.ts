"use client";

export interface StoredPlayer {
  id: number;
  username: string;
  friendCode: string;
  token: string;
}

const KEY = "lgr-player";

export function getStoredPlayer(): StoredPlayer | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredPlayer) : null;
  } catch {
    return null;
  }
}

export function setStoredPlayer(p: StoredPlayer) {
  localStorage.setItem(KEY, JSON.stringify(p));
}

export function clearStoredPlayer() {
  localStorage.removeItem(KEY);
}

export function authHeaders(p: StoredPlayer): HeadersInit {
  return { "x-player-token": p.token, "content-type": "application/json" };
}
