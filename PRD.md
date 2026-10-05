# PRD — Leaderboard Game Realtime

## Ringkasan
Game browser sederhana **"Klik Target 30 Detik"**: pemain mengklik target yang
berpindah posisi acak selama 30 detik. Skor = jumlah klik. Skor disubmit ke
server dengan validasi anti-cheat server-side yang nyata, disimpan dalam
sorted-set leaderboard (global, mingguan, antar-teman), dan leaderboard
ter-update realtime via SSE.

## Status Keterbatasan (jujur)
- **Mode non-Redis.** Redis TIDAK tersedia di lingkungan ini
  (`redis-cli`/`redis-server` tidak ditemukan). Sorted set diimplementasikan
  sebagai abstraksi di atas SQLite (`lib/sortedset.ts`) dengan semantik
  ZADD / ZREVRANGE / ZRANK. Tradeoff: throughput tulis terbatas (single-writer
  SQLite), tidak ada pub/sub antar-proses — update realtime SSE hanya
  dalam satu proses Node. Untuk produksi, ganti backend `lib/sortedset.ts`
  dengan Redis sorted set (ioredis) tanpa mengubah API.
- WebSocket tidak bisa di-upgrade di Next.js route handler → realtime memakai
  **SSE** (+ polling fallback di klien).

## Stack
Next.js 14 + TypeScript + Prisma 5.22 + SQLite + Tailwind. Bahasa UI: Indonesia.

## Model Data
- `Player` — id, username (unik), friendCode (unik, mis. `RKT-4F8K2Q`),
  token (auth submit), bestScore, createdAt.
- `GameSession` — token sesi (sekali pakai), secret HMAC, playerId,
  startedAt (server), expiresAt (+90 dtk), used.
- `ScoreEntry` — (playerId, board, weekKey, seasonId) unik; score = skor
  terbaik pemain di board itu (semantik ZADD: hanya naik).
  board ∈ {global, weekly}; weekKey mis. `2026-W41` (mingguan, reset Senin
  00:00 WIB); seasonId menunjuk musim aktif.
- `Season` — label, startsAt, endsAt, active.
- `SeasonArchive` — snapshot peringkat akhir musim (seasonId, board, playerId,
  username, score, rank).
- `Friendship` — pasangan (playerId, friendId) unik; pertemanan dua arah
  (dibuat dua baris).
- `SubmitLog` — timestamp tiap submit per pemain (untuk rate limit).

## Aturan Anti-Cheat (server-side, diuji via curl)
| # | Rule | Respons |
|---|------|---------|
| R1 | Skor harus integer > 0 | 400 |
| R2 | Skor ≤ 8 × durasi(detik). Batas manusiawi: maks 8 klik/detik → maks 240 untuk 30 dtk | 400 |
| R3 | Durasi klien (end−start) harus 27–34 dtk; start klien vs start server ≤ 10 dtk | 400 |
| R4 | `clicks[]`: panjang == skor, monoton naik, gap antar klik ≥ 60 ms, semua dalam [start, end] | 400 |
| R5 | Sesi sekali pakai & kedaluwarsa 90 dtk setelah dibuat | 403/410 |
| R6 | Rate limit: 1 submit / pemain / 30 dtk | 429 |
| R7 | Lonjakan tak wajar: skor > 2× best sebelumnya (saat best ≥ 40) | 400 |
| R8 | Signature HMAC-SHA256(secret sesi, `playerId.score.durationMs.sessionToken`) wajib valid (timing-safe compare) | 403 |

Skor yang lolos → ZADD ke board `global` + `weekly` musim aktif, bestScore
pemain diperbarui atomik (conditional updateMany, bukan interactive
transaction), leaderboardVersion naik → pendengar SSE diberi tahu.

## API
- `POST /api/players` {username} → {id, username, friendCode, token}
- `GET /api/players/me` (header `x-player-token`)
- `POST /api/game/session` (x-player-token) → {sessionToken, secret, serverStart, durationMs}
- `POST /api/game/submit` {playerId, sessionToken, score, startMs, endMs, clicks[], signature} → validasi R1–R8 → {score, rankGlobal, rankWeekly, newBest}
- `GET /api/leaderboard?board=global|weekly|friends&limit=&offset=` (+ x-player-token utk friends)
- `GET /api/leaderboard/stream` — SSE, event `update` tiap ada submit valid
- `GET /api/rank/me?window=5` — peringkat saya + 5 di atas + 5 di bawah (board global musim aktif; handle rank 1 & rank terbawah)
- `POST /api/friends` {friendCode} → tambah teman dua arah (409 jika sudah/kode sendiri/tidak ada)
- `GET /api/friends` — daftar teman
- `GET /api/seasons` — daftar musim + arsip
- `POST /api/cron/season-reset` (header `x-cron-secret: CRON_SECRET`) → arsipkan musim aktif (peringkat global+weekly → SeasonArchive), kosongkan ScoreEntry musim itu, buat musim baru. **Jadwal yang disarankan:** cron eksternal (crontab / GitHub Actions schedule) tiap tanggal 1 pukul 00:05 WIB memanggil endpoint ini.

## Halaman UI
- `/` — game klik target 30 detik (playable, HP & desktop)
- `/leaderboard` — 3 tab: Global, Mingguan, Teman (auto-refresh via SSE, fallback polling 5 dtk)
- `/profil` — peringkat saya + 5 atas/bawah
- `/teman` — daftar teman + tambah via kode
- `/arsip` — arsip musim-musim lama

## Seed
8 pemain bot (Budi, Siti, Andi, Dewi, Rina, Agus, Maya, Joko) dengan skor
beragam + beberapa pertemanan, agar leaderboard terlihat hidup.

## Kriteria Selesai
`npm run build` lolos; semua endpoint kunci diuji via curl (sukses + error);
SSE teruji via curl; push terverifikasi bersih via GitHub API.
