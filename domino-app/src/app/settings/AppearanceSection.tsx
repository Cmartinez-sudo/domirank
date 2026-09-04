"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppearanceSection() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentLabel = !mounted
    ? " "
    : resolvedTheme === "light"
      ? "Modo claro"
      : "Modo oscuro";

  return (
    <section className="card">
      <h2 className="font-semibold text-sm mb-3">Apariencia</h2>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-medium text-sm">Tema</div>
          <div className="text-text-mute text-xs mt-0.5">
            {currentLabel}. Tu preferencia se guarda en este dispositivo.
          </div>
        </div>
        <ThemeToggle />
      </div>
    </section>
  );
}
