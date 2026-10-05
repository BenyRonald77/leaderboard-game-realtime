import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Leaderboard Game Realtime",
  description: "Game klik target 30 detik dengan leaderboard realtime dan anti-cheat server-side",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen text-slate-900">
        <nav className="bg-slate-900 text-white">
          <div className="max-w-5xl mx-auto px-4 py-3 flex gap-4 text-sm font-medium overflow-x-auto">
            <a href="/" className="hover:text-amber-300 whitespace-nowrap">🎯 Main</a>
            <a href="/leaderboard" className="hover:text-amber-300 whitespace-nowrap">🏆 Leaderboard</a>
            <a href="/profil" className="hover:text-amber-300 whitespace-nowrap">👤 Peringkat Saya</a>
            <a href="/teman" className="hover:text-amber-300 whitespace-nowrap">👥 Teman</a>
            <a href="/arsip" className="hover:text-amber-300 whitespace-nowrap">🗂️ Arsip Musim</a>
          </div>
        </nav>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
