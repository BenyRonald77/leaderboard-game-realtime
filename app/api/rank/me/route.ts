import { NextRequest, NextResponse } from "next/server";
import { playerFromToken, unauthorized } from "@/lib/auth";
import { getActiveSeason } from "@/lib/season";
import { weekKey } from "@/lib/time";
import { zrankWindow } from "@/lib/sortedset";

/**
 * GET /api/rank/me?window=5&board=global|weekly
 * Posisi saya + `window` pemain di atas dan di bawah.
 * Menangani edge case: rank 1 (tidak ada di atas) dan rank terbawah.
 */
export async function GET(req: NextRequest) {
  const me = await playerFromToken(req);
  if (!me) return unauthorized();
  const board = req.nextUrl.searchParams.get("board") ?? "global";
  if (!["global", "weekly"].includes(board)) {
    return NextResponse.json({ error: "board harus: global | weekly" }, { status: 400 });
  }
  const window = Math.min(20, Math.max(1, Number(req.nextUrl.searchParams.get("window") ?? 5) || 5));

  const season = await getActiveSeason();
  const wk = board === "weekly" ? weekKey() : "";

  const result = await zrankWindow(me.id, board, wk, season.id, window, window);
  if (!result) {
    return NextResponse.json({
      rank: null,
      total: 0,
      entries: [],
      message: "Kamu belum punya skor di board ini — main dulu!",
    });
  }
  return NextResponse.json({
    board,
    season: season.label,
    me: { id: me.id, username: me.username },
    ...result,
  });
}
