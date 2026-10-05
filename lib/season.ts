import { prisma } from "./prisma";

/** Musim aktif; buat "Musim 1" bila belum ada. */
export async function getActiveSeason() {
  let season = await prisma.season.findFirst({ where: { active: true }, orderBy: { id: "desc" } });
  if (!season) {
    season = await prisma.season.create({ data: { label: "Musim 1", active: true } });
  }
  return season;
}
