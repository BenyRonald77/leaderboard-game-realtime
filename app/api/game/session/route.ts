import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { playerFromToken, unauthorized } from "@/lib/auth";
import { randomToken } from "@/lib/crypto";
import { GAME_DURATION_MS, SESSION_TTL_MS } from "@/lib/anticheat";

/**
 * POST /api/game/session → buat sesi sekali pakai untuk satu permainan.
 * Klien WAJIB meminta sesi ini saat permainan dimulai; secret dipakai
 * untuk menandatangani payload submit (HMAC).
 */
export async function POST(req: NextRequest) {
  const player = await playerFromToken(req);
  if (!player) return unauthorized();
  const now = Date.now();
  const session = await prisma.gameSession.create({
    data: {
      token: randomToken(16),
      secret: randomToken(32),
      playerId: player.id,
      expiresAt: new Date(now + SESSION_TTL_MS),
      durationMs: GAME_DURATION_MS,
    },
    select: { token: true, secret: true, startedAt: true, expiresAt: true, durationMs: true },
  });
  return NextResponse.json(
    {
      sessionToken: session.token,
      secret: session.secret,
      serverStart: session.startedAt.getTime(),
      expiresAt: session.expiresAt.getTime(),
      durationMs: session.durationMs,
    },
    { status: 201 }
  );
}
