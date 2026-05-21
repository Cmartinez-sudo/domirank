import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getCurrentUser, getCurrentProfile } from "@/lib/auth";
import { getNotificationCounts } from "@/lib/notifications";
import type { NotificationCounts } from "@/lib/notifications-types";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "DomiRank · Ranking oficial de dominó",
  description: "DomiRank — ranking de dominó con OpenSkill (Plackett-Luce / Weng-Lin). Singles, parejas y torneos.",
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
  // Defensa: que un fallo en CUALQUIERA de estas queries no rompa el layout
  // entero (sino, el usuario ve global-error en cualquier ruta).
  let user: { id: string } | null = null;
  let profile: any = null;
  let counts: NotificationCounts | null = null;

  try {
    const u = await getCurrentUser();
    if (u) {
      user = { id: u.id };
      try { profile = await getCurrentProfile(); } catch (e) { console.error("[layout] profile failed:", e); }
      try { counts = await getNotificationCounts(u.id); } catch (e) { console.error("[layout] counts failed:", e); }
    }
  } catch (e) {
    console.error("[layout] getCurrentUser failed:", e);
  }

  return (
    <html lang="es" className={inter.className}>
      <body>
        <ToastProvider>
          <AppShell user={user} profile={profile} counts={counts}>
            {children}
          </AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
