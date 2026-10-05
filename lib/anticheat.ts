import { createHmac, timingSafeEqual } from "crypto";

/**
 * ATURAN ANTI-CHEAT (terdokumentasi di PRD, semua diuji via curl).
 * Game: "Klik Target 30 Detik" — klien mengirim skor + daftar timestamp klik.
 */
export const GAME_DURATION_MS = 30_000;
export const MIN_DURATION_MS = 27_000; // R3: toleransi durasi klien
export const MAX_DURATION_MS = 34_000;
export const START_SKEW_MS = 10_000; // R3: selisih start klien vs server
export const MAX_CLICKS_PER_SEC = 8; // R2: batas manusiawi klik/detik
export const MIN_CLICK_GAP_MS = 60; // R4: jarak minimum antar klik
export const SESSION_TTL_MS = 90_000; // R5: sesi kedaluwarsa
export const RATE_LIMIT_MS = 30_000; // R6: 1 submit / pemain / 30 dtk
export const JUMP_BEST_MIN = 40; // R7: lonjakan tak wajar
export const JUMP_FACTOR = 2;

export interface SubmitPayload {
  playerId: number;
  sessionToken: string;
  score: number;
  startMs: number;
  endMs: number;
  clicks: number[];
  signature: string;
}

export interface CheatFailure {
  rule: string;
  message: string;
}

/** R8: signature = HMAC-SHA256(secret, "playerId.score.durationMs.sessionToken") */
export function signPayload(secret: string, playerId: number, score: number, durationMs: number, sessionToken: string): string {
  return createHmac("sha256", secret)
    .update(`${playerId}.${score}.${durationMs}.${sessionToken}`)
    .digest("hex");
}

export function verifySignature(secret: string, p: SubmitPayload): boolean {
  const durationMs = p.endMs - p.startMs;
  const expected = signPayload(secret, p.playerId, p.score, durationMs, p.sessionToken);
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(p.signature ?? ""), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Validasi murni (tanpa DB) untuk R1–R4. Return null bila lolos.
 * R5–R8 butuh DB dan dicek di route handler.
 */
export function validatePayload(p: SubmitPayload): CheatFailure | null {
  if (!p || typeof p !== "object") return { rule: "R?", message: "Payload tidak valid" };

  // R1: skor integer positif
  if (!Number.isInteger(p.score) || p.score <= 0) {
    return { rule: "R1", message: "Skor harus bilangan bulat positif" };
  }

  const durationMs = p.endMs - p.startMs;
  // R3: durasi konsisten (game 30 detik, toleransi 27–34 detik)
  if (!Number.isFinite(durationMs) || durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    return {
      rule: "R3",
      message: `Durasi permainan (${durationMs} ms) tidak konsisten dengan durasi resmi 30 detik`,
    };
  }

  // R2: batas klik manusiawi — maks 8 klik/detik
  const maxScore = Math.floor((MAX_CLICKS_PER_SEC * durationMs) / 1000);
  if (p.score > maxScore) {
    return {
      rule: "R2",
      message: `Skor ${p.score} melebihi batas manusiawi ${maxScore} untuk durasi ${durationMs} ms`,
    };
  }

  // R4: integritas daftar timestamp klik
  if (!Array.isArray(p.clicks) || p.clicks.length !== p.score) {
    return { rule: "R4", message: "Jumlah timestamp klik tidak sama dengan skor" };
  }
  let prev = -Infinity;
  for (const t of p.clicks) {
    if (!Number.isFinite(t) || t < p.startMs || t > p.endMs) {
      return { rule: "R4", message: "Timestamp klik di luar rentang permainan" };
    }
    if (t - prev < MIN_CLICK_GAP_MS) {
      return { rule: "R4", message: `Jarak antar klik < ${MIN_CLICK_GAP_MS} ms (tidak manusiawi)` };
    }
    prev = t;
  }
  return null;
}
