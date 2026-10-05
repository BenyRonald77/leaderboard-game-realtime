import { NextRequest, NextResponse } from "next/server";
import { playerFromToken, unauthorized } from "@/lib/auth";

/** GET /api/players/me → profil pemain dari token */
export async function GET(req: NextRequest) {
  const player = await playerFromToken(req);
  if (!player) return unauthorized();
  return NextResponse.json({
    id: player.id,
    username: player.username,
    friendCode: player.friendCode,
    bestScore: player.bestScore,
    createdAt: player.createdAt,
  });
}
