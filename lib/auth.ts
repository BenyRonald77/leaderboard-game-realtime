import type { NextRequest } from "next/server";
import { prisma } from "./prisma";

/** Ambil pemain dari header x-player-token. Null bila token tidak valid. */
export async function playerFromToken(req: NextRequest) {
  const token = req.headers.get("x-player-token");
  if (!token) return null;
  return prisma.player.findUnique({ where: { token } });
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Token pemain tidak valid (header x-player-token)" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
