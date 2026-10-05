import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomToken, randomFriendCode } from "@/lib/crypto";

/** POST /api/players { username } → buat pemain baru + token + kode teman */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim();
  if (!/^[A-Za-z0-9_ ]{3,20}$/.test(username)) {
    return NextResponse.json(
      { error: "Username harus 3-20 karakter (huruf, angka, spasi, underscore)" },
      { status: 400 }
    );
  }
  const exists = await prisma.player.findUnique({ where: { username } });
  if (exists) {
    return NextResponse.json({ error: "Username sudah dipakai" }, { status: 409 });
  }
  // Kode teman unik — coba ulang bila tabrakan.
  let friendCode = "";
  for (let i = 0; i < 10; i++) {
    friendCode = randomFriendCode();
    if (!(await prisma.player.findUnique({ where: { friendCode } }))) break;
  }
  const player = await prisma.player.create({
    data: { username, friendCode, token: randomToken() },
    select: { id: true, username: true, friendCode: true, token: true, bestScore: true },
  });
  return NextResponse.json(player, { status: 201 });
}
