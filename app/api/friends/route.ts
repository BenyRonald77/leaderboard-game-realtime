import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { playerFromToken, unauthorized } from "@/lib/auth";

/** GET /api/friends → daftar teman (beserta skor terbaiknya) */
export async function GET(req: NextRequest) {
  const me = await playerFromToken(req);
  if (!me) return unauthorized();
  const rows = await prisma.friendship.findMany({
    where: { playerId: me.id },
    orderBy: { createdAt: "desc" },
  });
  const friends = await prisma.player.findMany({
    where: { id: { in: rows.map((r) => r.friendId) } },
    select: { id: true, username: true, friendCode: true, bestScore: true },
    orderBy: { bestScore: "desc" },
  });
  return NextResponse.json({ friends, myCode: me.friendCode });
}

/** POST /api/friends { friendCode } → tambah teman dua arah */
export async function POST(req: NextRequest) {
  const me = await playerFromToken(req);
  if (!me) return unauthorized();
  const body = await req.json().catch(() => null);
  const code = String(body?.friendCode ?? "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ error: "friendCode wajib diisi" }, { status: 400 });
  }
  const target = await prisma.player.findUnique({ where: { friendCode: code } });
  if (!target) {
    return NextResponse.json({ error: "Kode teman tidak ditemukan" }, { status: 404 });
  }
  if (target.id === me.id) {
    return NextResponse.json({ error: "Tidak bisa berteman dengan diri sendiri" }, { status: 400 });
  }
  const already = await prisma.friendship.findUnique({
    where: { playerId_friendId: { playerId: me.id, friendId: target.id } },
  });
  if (already) {
    return NextResponse.json({ error: "Sudah berteman" }, { status: 409 });
  }
  await prisma.friendship.createMany({
    data: [
      { playerId: me.id, friendId: target.id },
      { playerId: target.id, friendId: me.id },
    ],
  });
  return NextResponse.json(
    { ok: true, friend: { id: target.id, username: target.username, bestScore: target.bestScore } },
    { status: 201 }
  );
}
