/**
 * Abstraksi SORTED SET di atas SQLite — dipakai karena Redis TIDAK tersedia
 * di lingkungan ini (redis-cli/redis-server tidak ditemukan).
 *
 * Semantik yang ditiru dari Redis:
 *  - ZADD: skor member hanya diperbarui bila skor baru LEBIH BESAR
 *    (leaderboard menyimpan skor TERBAIK tiap pemain per board).
 *    Implementasi atomik: single-statement conditional updateMany +
 *    cek row terpengaruh, BUKAN interactive transaction.
 *  - ZREVRANGE: anggota terurut skor desc, tie-break updatedAt asc lalu id asc.
 *  - ZRANK: peringkat 1-based (skor lebih tinggi = rank lebih kecil).
 *  - ZCARD: jumlah member.
 *
 * Tradeoff vs Redis (terdokumentasi di PRD & UI): throughput tulis terbatas
 * (single-writer SQLite), tidak ada pub/sub antar-proses.
 * Untuk produksi, ganti file ini dengan ioredis tanpa mengubah pemanggil.
 */
import { prisma } from "./prisma";

export interface RankedEntry {
  playerId: number;
  username: string;
  score: number;
  rank: number;
}

/** ZADD — simpan skor terbaik. Return true bila ini rekor baru pemain. */
export async function zadd(
  playerId: number,
  board: string,
  weekKey: string,
  seasonId: number,
  score: number
): Promise<boolean> {
  const where = { playerId, board, weekKey, seasonId };
  const bumped = await prisma.scoreEntry.updateMany({
    where: { ...where, score: { lt: score } },
    data: { score },
  });
  if (bumped.count > 0) return true;
  try {
    await prisma.scoreEntry.create({ data: { ...where, score } });
    return true;
  } catch {
    // Unique conflict: baris sudah ada dengan skor >= skor baru (atau race).
    return false;
  }
}

async function baseWhere(board: string, weekKey: string, seasonId: number, playerIds?: number[]) {
  return {
    board,
    weekKey,
    seasonId,
    ...(playerIds ? { playerId: { in: playerIds } } : {}),
  };
}

/** ZREVRANGE — ambil peringkat [start, stop] inklusif (0-based). */
export async function zrevrange(
  board: string,
  weekKey: string,
  seasonId: number,
  start: number,
  stop: number,
  playerIds?: number[]
): Promise<RankedEntry[]> {
  const rows = await prisma.scoreEntry.findMany({
    where: await baseWhere(board, weekKey, seasonId, playerIds),
    include: { player: { select: { username: true } } },
    orderBy: [{ score: "desc" }, { updatedAt: "asc" }, { id: "asc" }],
    skip: Math.max(0, start),
    take: Math.max(0, stop - start + 1),
  });
  return rows.map((r, i) => ({
    playerId: r.playerId,
    username: r.player.username,
    score: r.score,
    rank: start + i + 1,
  }));
}

/** ZRANK — peringkat 1-based pemain, null bila belum punya skor di board. */
export async function zrank(
  playerId: number,
  board: string,
  weekKey: string,
  seasonId: number,
  playerIds?: number[]
): Promise<number | null> {
  const mine = await prisma.scoreEntry.findUnique({
    where: { playerId_board_weekKey_seasonId: { playerId, board, weekKey, seasonId } },
  });
  if (!mine) return null;
  const where = await baseWhere(board, weekKey, seasonId, playerIds);
  const better = await prisma.scoreEntry.count({
    where: {
      ...where,
      OR: [
        { score: { gt: mine.score } },
        { score: mine.score, updatedAt: { lt: mine.updatedAt } },
        { score: mine.score, updatedAt: mine.updatedAt, id: { lt: mine.id } },
      ],
    },
  });
  return better + 1;
}

/** ZCARD — jumlah pemain di board. */
export async function zcard(
  board: string,
  weekKey: string,
  seasonId: number,
  playerIds?: number[]
): Promise<number> {
  return prisma.scoreEntry.count({ where: await baseWhere(board, weekKey, seasonId, playerIds) });
}

/** Jendela peringkat di sekitar pemain: `above` di atas + `below` di bawah. */
export async function zrankWindow(
  playerId: number,
  board: string,
  weekKey: string,
  seasonId: number,
  above: number,
  below: number,
  playerIds?: number[]
): Promise<{ rank: number; total: number; entries: RankedEntry[] } | null> {
  const rank = await zrank(playerId, board, weekKey, seasonId, playerIds);
  if (rank === null) return null;
  const total = await zcard(board, weekKey, seasonId, playerIds);
  const start = Math.max(0, rank - 1 - above);
  const stop = Math.min(total - 1, rank - 1 + below);
  const entries = await zrevrange(board, weekKey, seasonId, start, stop, playerIds);
  return { rank, total, entries };
}
