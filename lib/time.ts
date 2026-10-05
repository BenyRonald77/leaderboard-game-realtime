const jakartaFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Kunci minggu ISO (Senin–Minggu) dalam zona Asia/Jakarta, mis. "2026-W41".
 *  Board mingguan "reset Senin 00:00 WIB" secara alami karena weekKey berganti. */
export function weekKey(d: Date = new Date()): string {
  const [y, m, day] = jakartaFmt.format(d).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  const dayNum = (date.getUTCDay() + 6) % 7; // Senin = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // geser ke Kamis minggu itu
  const year = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const fDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNum + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604800000);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Label tanggal Jakarta YYYY-MM-DD (untuk arsip/label musim). */
export function jakartaDate(d: Date = new Date()): string {
  return jakartaFmt.format(d);
}
