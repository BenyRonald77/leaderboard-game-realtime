import { NextRequest } from "next/server";
import { getActiveSeason } from "@/lib/season";
import { weekKey } from "@/lib/time";
import { zrevrange } from "@/lib/sortedset";
import { getLeaderboardVersion } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard/stream — Server-Sent Events.
 * Mengirim event `update` (top 10 global + mingguan) setiap ada submit valid,
 * plus heartbeat tiap 20 detik agar koneksi tetap hidup.
 * Klien memakai ini dengan fallback polling bila SSE gagal.
 */
export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder();
  let lastVersion = getLeaderboardVersion();
  let alive = true;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (!alive) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const tick = async () => {
        if (!alive) return;
        try {
          const v = getLeaderboardVersion();
          if (v !== lastVersion) {
            lastVersion = v;
            const season = await getActiveSeason();
            const wk = weekKey();
            const [topGlobal, topWeekly] = await Promise.all([
              zrevrange("global", "", season.id, 0, 9),
              zrevrange("weekly", wk, season.id, 0, 9),
            ]);
            send("update", { version: v, topGlobal, topWeekly, at: new Date().toISOString() });
          }
        } catch {
          /* abaikan — loop tetap jalan */
        }
        if (alive) setTimeout(tick, 1000);
      };
      const heartbeat = () => {
        if (!alive) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          /* koneksi putus */
        }
        if (alive) setTimeout(heartbeat, 20000);
      };
      send("connected", { version: lastVersion });
      tick();
      heartbeat();
    },
    cancel() {
      alive = false;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
