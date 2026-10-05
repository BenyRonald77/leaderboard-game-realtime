/** Counter versi leaderboard (satu proses). Naik tiap ada submit valid → pemicu SSE. */
let leaderboardVersion = 0;
export function bumpLeaderboardVersion() {
  leaderboardVersion++;
}
export function getLeaderboardVersion() {
  return leaderboardVersion;
}
