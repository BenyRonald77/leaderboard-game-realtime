import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/seasons → musim aktif + riwayat musim + arsip peringkat */
export async function GET() {
  const seasons = await prisma.season.findMany({ orderBy: { id: "desc" } });
  const archives = await prisma.seasonArchive.findMany({
    orderBy: [{ seasonId: "desc" }, { board: "asc" }, { rank: "asc" }],
    take: 500,
  });
  const bySeason = new Map<number, typeof archives>();
  for (const a of archives) {
    const list = bySeason.get(a.seasonId) ?? [];
    list.push(a);
    bySeason.set(a.seasonId, list);
  }
  return NextResponse.json({
    active: seasons.find((s) => s.active) ?? null,
    seasons: seasons.map((s) => ({
      id: s.id,
      label: s.label,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      active: s.active,
      archives: (bySeason.get(s.id) ?? []).map((a) => ({
        board: a.board,
        weekKey: a.weekKey,
        rank: a.rank,
        username: a.username,
        score: a.score,
      })),
    })),
  });
}
