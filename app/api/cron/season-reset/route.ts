import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveSeason } from "@/lib/season";
import { weekKey } from "@/lib/time";
import { zrevrange, zcard } from "@/lib/sortedset";

/**
 * POST /api/cron/season-reset (header x-cron-secret: CRON_SECRET)
 * Arsipkan musim aktif → SeasonArchive (peringkat global + mingguan),
 * kosongkan ScoreEntry musim itu, buat musim baru.
 *
 * JADWAL YANG DISARANKAN: cron eksternal tiap tanggal 1 pukul 00:05 WIB:
 *   5 0 1 * * curl -X POST -H "x-cron-secret: $CRON_SECRET" https://<host>/api/cron/season-reset
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET tidak valid" }, { status: 403 });
  }

  const season = await getActiveSeason();
  const wk = weekKey();
  const boards: { board: string; weekKey: string }[] = [
    { board: "global", weekKey: "" },
    { board: "weekly", weekKey: wk },
  ];

  let archived = 0;
  for (const b of boards) {
    const total = await zcard(b.board, b.weekKey, season.id);
    if (total === 0) continue;
    const entries = await zrevrange(b.board, b.weekKey, season.id, 0, total - 1);
    await prisma.seasonArchive.createMany({
      data: entries.map((e) => ({
        seasonId: season.id,
        seasonLabel: season.label,
        board: b.board,
        weekKey: b.weekKey,
        playerId: e.playerId,
        username: e.username,
        score: e.score,
        rank: e.rank,
      })),
    });
    archived += entries.length;
  }

  await prisma.scoreEntry.deleteMany({ where: { seasonId: season.id } });
  await prisma.season.update({
    where: { id: season.id },
    data: { active: false, endsAt: new Date() },
  });
  const nextNum = season.id + 1;
  const next = await prisma.season.create({
    data: { label: `Musim ${nextNum}`, active: true },
  });

  return NextResponse.json({
    ok: true,
    archivedSeason: season.label,
    archivedEntries: archived,
    newSeason: next.label,
  });
}
