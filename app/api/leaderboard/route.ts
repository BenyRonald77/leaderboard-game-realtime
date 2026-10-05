import { NextRequest, NextResponse } from "next/server";
import { playerFromToken, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSeason } from "@/lib/season";
import { weekKey } from "@/lib/time";
import { zrevrange, zcard } from "@/lib/sortedset";

/**
 * GET /api/leaderboard?board=global|weekly|friends&limit=20&offset=0
 * board=friends butuh x-player-token; hanya pemain + temannya yang muncul.
 */
export async function GET(req: NextRequest) {
  const board = req.nextUrl.searchParams.get("board") ?? "global";
  if (!["global", "weekly", "friends"].includes(board)) {
    return NextResponse.json({ error: "board harus: global | weekly | friends" }, { status: 400 });
  }
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20));
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? 0) || 0);

  const season = await getActiveSeason();
  const wk = board === "weekly" ? weekKey() : "";

  let playerIds: number[] | undefined;
  let me: { id: number } | null = null;
  if (board === "friends") {
    me = await playerFromToken(req);
    if (!me) return unauthorized();
    const rows = await prisma.friendship.findMany({
      where: { playerId: me.id },
      select: { friendId: true },
    });
    playerIds = [me.id, ...rows.map((r) => r.friendId)];
  }

  const total = await zcard(board === "friends" ? "global" : board, wk, season.id, playerIds);
  const entries = await zrevrange(
    board === "friends" ? "global" : board,
    wk,
    season.id,
    offset,
    offset + limit - 1,
    playerIds
  );
  return NextResponse.json({
    board,
    season: season.label,
    weekKey: board === "weekly" ? wk : undefined,
    total,
    entries,
    backend: "sqlite-sortedset",
    note: "Mode non-Redis: sorted set di atas SQLite (lihat PRD).",
  });
}
