import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { playerFromToken, unauthorized } from "@/lib/auth";
import {
  JUMP_BEST_MIN,
  JUMP_FACTOR,
  RATE_LIMIT_MS,
  START_SKEW_MS,
  SubmitPayload,
  validatePayload,
  verifySignature,
} from "@/lib/anticheat";
import { getActiveSeason } from "@/lib/season";
import { weekKey } from "@/lib/time";
import { zadd, zrank } from "@/lib/sortedset";
import { bumpLeaderboardVersion } from "@/lib/realtime";

function bad(rule: string, message: string, status: number) {
  return NextResponse.json({ ok: false, rule, error: message }, { status });
}

/**
 * POST /api/game/submit — terima skor dengan validasi anti-cheat R1–R8.
 * Body: { playerId, sessionToken, score, startMs, endMs, clicks[], signature }
 */
export async function POST(req: NextRequest) {
  const player = await playerFromToken(req);
  if (!player) return unauthorized();
  const p = (await req.json().catch(() => null)) as SubmitPayload | null;

  if (!p || p.playerId !== player.id) {
    return bad("R?", "playerId tidak cocok dengan token", 403);
  }

  // R1–R4: validasi murni payload
  const pure = validatePayload(p);
  if (pure) return bad(pure.rule, pure.message, 400);

  // R5: sesi harus ada, milik pemain, belum dipakai, belum kedaluwarsa
  const session = await prisma.gameSession.findUnique({ where: { token: p.sessionToken } });
  if (!session || session.playerId !== player.id) {
    return bad("R5", "Sesi permainan tidak valid", 403);
  }
  if (session.used) {
    return bad("R5", "Sesi sudah dipakai (satu sesi = satu submit)", 403);
  }
  if (session.expiresAt.getTime() < Date.now()) {
    return bad("R5", "Sesi kedaluwarsa", 410);
  }

  // R3 lanjutan: start klien konsisten dengan start server
  if (Math.abs(p.startMs - session.startedAt.getTime()) > START_SKEW_MS) {
    return bad("R3", "Waktu mulai klien tidak konsisten dengan server", 400);
  }

  // R8: verifikasi HMAC (timing-safe)
  if (!verifySignature(session.secret, p)) {
    return bad("R8", "Signature payload tidak valid", 403);
  }

  // R6: rate limit 1 submit / 30 detik per pemain
  const last = await prisma.submitLog.findFirst({
    where: { playerId: player.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (last && Date.now() - last.createdAt.getTime() < RATE_LIMIT_MS) {
    return bad("R6", "Terlalu cepat — tunggu sebelum submit lagi", 429);
  }

  // R7: tolak lonjakan skor yang tidak mungkin
  if (player.bestScore >= JUMP_BEST_MIN && p.score > JUMP_FACTOR * player.bestScore) {
    return bad(
      "R7",
      `Lonjakan skor tidak wajar (${p.score} vs terbaik ${player.bestScore})`,
      400
    );
  }

  // Tandai sesi terpakai secara atomik (conditional single-statement)
  const marked = await prisma.gameSession.updateMany({
    where: { token: p.sessionToken, used: false },
    data: { used: true },
  });
  if (marked.count === 0) {
    return bad("R5", "Sesi sudah dipakai (race)", 409);
  }

  await prisma.submitLog.create({ data: { playerId: player.id } });

  // Best score atomik: hanya naik
  const bumped = await prisma.player.updateMany({
    where: { id: player.id, bestScore: { lt: p.score } },
    data: { bestScore: p.score },
  });
  const newBest = bumped.count > 0;

  // ZADD ke board global + mingguan musim aktif
  const season = await getActiveSeason();
  const wk = weekKey();
  await zadd(player.id, "global", "", season.id, p.score);
  await zadd(player.id, "weekly", wk, season.id, p.score);

  bumpLeaderboardVersion();

  const rankGlobal = await zrank(player.id, "global", "", season.id);
  const rankWeekly = await zrank(player.id, "weekly", wk, season.id);
  return NextResponse.json({
    ok: true,
    score: p.score,
    newBest,
    rankGlobal,
    rankWeekly,
    weekKey: wk,
    season: season.label,
  });
}
