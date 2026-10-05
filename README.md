# Leaderboard Game Realtime

Game browser **"Klik Target 30 Detik"** dengan leaderboard realtime, validasi
anti-cheat server-side, board global/mingguan/teman, dan sistem musim.

## Cara Menjalankan

```bash
npm install --ignore-scripts
# salin 2 binary prisma engine (workaround egress proxy, lihat PRD/MEMORY):
cp ~/workspace/ts-convert/prisma-engines/*.node ~/workspace/ts-convert/prisma-engines/schema-engine-* node_modules/@prisma/engines/
cp .env.example .env   # lalu isi CRON_SECRET dengan secret acak
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

## Halaman

- `/` — game klik target 30 detik (HP & desktop)
- `/leaderboard` — tab Global / Mingguan / Teman, update realtime via SSE (+ polling fallback)
- `/profil` — peringkat saya + 5 di atas + 5 di bawah
- `/teman` — daftar teman + tambah via kode
- `/arsip` — arsip musim-musim lama

## API

| Endpoint | Deskripsi |
|---|---|
| `POST /api/players` | daftar pemain |
| `GET /api/players/me` | profil (header `x-player-token`) |
| `POST /api/game/session` | sesi sekali pakai + secret HMAC |
| `POST /api/game/submit` | submit skor (anti-cheat R1–R8) |
| `GET /api/leaderboard?board=` | global / weekly / friends |
| `GET /api/leaderboard/stream` | SSE update realtime |
| `GET /api/rank/me` | peringkat saya ±5 |
| `GET/POST /api/friends` | daftar & tambah teman |
| `GET /api/seasons` | musim + arsip |
| `POST /api/cron/season-reset` | reset musim (header `x-cron-secret`) |

Detail aturan anti-cheat, jadwal cron, dan keterbatasan (mode non-Redis)
ada di [PRD.md](./PRD.md).
