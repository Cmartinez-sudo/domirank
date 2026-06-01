"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export function Topnav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all ${
        scrolled
          ? "bg-bg/85 backdrop-blur-xl border-b border-border"
          : "bg-transparent border-b border-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center" aria-label="DomiRank — Inicio">
          <Image
            src="/branding/logo-horizontal-tagline.svg"
            alt="DomiRank · Tu app de dominó"
            width={150}
            height={36}
            priority
            className="h-9 w-auto"
          />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-text-dim hover:text-text px-3 py-2 rounded-lg transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold text-black px-3.5 sm:px-4 py-2 rounded-lg transition-transform active:scale-95"
            style={{
              background: "linear-gradient(135deg,#10b981,#059669)",
              boxShadow: "0 2px 12px rgba(16,185,129,.35)",
            }}
          >
            Crear cuenta
          </Link>
        </nav>
      </div>
    </header>
  );
}
