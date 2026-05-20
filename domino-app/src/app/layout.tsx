import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getCurrentUser, getCurrentProfile } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "DomiRank · Ranking oficial de dominó",
  description: "DomiRank — ranking de dominó con OpenSkill (Plackett-Luce / Weng-Lin). Singles, parejas y pollas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DomiRank" },
};

export const viewport: Viewport = {
  themeColor: "#0a1020",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const profile = user ? (await getCurrentProfile() as any) : null;

  return (
    <html lang="es" className={inter.className}>
      <body>
        <AppShell user={user ? { id: user.id } : null} profile={profile}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
