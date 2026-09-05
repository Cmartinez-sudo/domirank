"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMotionPreference, type MotionPreference } from "@/hooks/useMotionPreference";

export function AppearanceSection() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [motionPref, setMotionPref] = useMotionPreference();

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentLabel = !mounted
    ? " "
    : resolvedTheme === "light"
      ? "Modo claro"
      : "Modo oscuro";

  return (
    <section className="card space-y-5">
      <h2 className="font-semibold text-sm">Apariencia</h2>

      {/* Tema */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-medium text-sm">Tema</div>
          <div className="text-text-mute text-xs mt-0.5">
            {currentLabel}. Se guarda en este dispositivo.
          </div>
        </div>
        <ThemeToggle />
      </div>

      <hr className="border-border" />

      {/* Animaciones */}
      <div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="font-medium text-sm">Animaciones</div>
            <div className="text-text-mute text-xs mt-0.5">
              Controla las animaciones y celebraciones. Por defecto seguimos la preferencia de tu sistema operativo.
            </div>
          </div>
        </div>
        <div
          role="radiogroup"
          aria-label="Preferencia de animaciones"
          className="mt-3 grid grid-cols-3 gap-2 text-sm"
        >
          {(
            [
              { value: "user", label: "Automático" },
              { value: "always", label: "Activas" },
              { value: "reduced", label: "Reducidas" },
            ] as { value: MotionPreference; label: string }[]
          ).map((opt) => {
            const active = motionPref === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMotionPref(opt.value)}
                className={
                  "rounded-lg px-3 py-2.5 border font-medium transition-colors " +
                  (active
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-surface-2 border-border text-text-dim hover:text-text hover:bg-surface-3")
                }
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
