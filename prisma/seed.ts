import { PrismaClient } from "@prisma/client";
import { randomToken } from "../lib/crypto";
import { weekKey } from "../lib/time";

const prisma = new PrismaClient();

const BOTS: { username: string; code: string; score: number }[] = [
  { username: "Budi", code: "BUD-7K2Q9X", score: 187 },
  { username: "Siti", code: "SIT-3M8P4R", score: 165 },
  { username: "Andi", code: "AND-9Q2W5E", score: 142 },
  { username: "Dewi", code: "DEW-6T4Y7U", score: 128 },
  { username: "Rina", code: "RIN-2A5S8D", score: 110 },
  { username: "Agus", code: "AGU-8F3G6H", score: 95 },
  { username: "Maya", code: "MAY-4J7K1L", score: 76 },
  { username: "Joko", code: "JOK-5Z9X2C", score: 54 },
];

const FRIENDS: [string, string][] = [
  ["Budi", "Siti"],
  ["Budi", "Andi"],
  ["Siti", "Dewi"],
  ["Andi", "Rina"],
  ["Dewi", "Maya"],
];

async function main() {
  const n = await prisma.player.count();
  if (n > 0) {
    console.log("seed dilewati (sudah ada data)");
    return;
  }
  const season = await prisma.season.create({ data: { label: "Musim 1", active: true } });
  const wk = weekKey();

  const ids = new Map<string, number>();
  for (const b of BOTS) {
    const p = await prisma.player.create({
      data: { username: b.username, friendCode: b.code, token: randomToken(), bestScore: b.score },
    });
    ids.set(b.username, p.id);
    await prisma.scoreEntry.create({
      data: { playerId: p.id, board: "global", weekKey: "", seasonId: season.id, score: b.score },
    });
    await prisma.scoreEntry.create({
      data: { playerId: p.id, board: "weekly", weekKey: wk, seasonId: season.id, score: b.score },
    });
  }
  for (const [a, b] of FRIENDS) {
    const ida = ids.get(a)!;
    const idb = ids.get(b)!;
    await prisma.friendship.createMany({
      data: [
        { playerId: ida, friendId: idb },
        { playerId: idb, friendId: ida },
      ],
    });
  }
  console.log(`seed selesai: ${BOTS.length} pemain, musim ${season.label}, minggu ${wk}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
