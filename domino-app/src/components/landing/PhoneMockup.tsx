"use client";

import { useEffect, useState } from "react";

/**
 * Mockup inline de un teléfono mostrando el dashboard. Sin assets externos.
 * El número grande de rating hace un tick-up sutil cada 4s para simular
 * actualización en vivo.
 */
export function PhoneMockup() {
  const [rating, setRating] = useState(12.4);

  useEffect(() => {
    const ticks = [12.4, 12.6, 12.5, 12.7];
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % ticks.length;
      setRating(ticks[i]);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto" style={{ width: 280, maxWidth: "100%" }}>
      {/* glow */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 blur-3xl opacity-50"
        style={{
          background: "radial-gradient(60% 60% at 50% 40%, rgba(16,185,129,.45), transparent 70%)",
        }}
      />

      {/* phone shell */}
      <div
        className="relative rounded-[44px] p-2.5 shadow-2xl"
        style={{
          background: "linear-gradient(180deg, #1e293b, #0f172a)",
          boxShadow: "0 30px 60px -20px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.06)",
        }}
      >
        <div className="relative rounded-[36px] bg-bg overflow-hidden" style={{ aspectRatio: "9 / 19.5" }}>
          {/* dynamic island */}
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 top-2 w-[78px] h-[24px] rounded-full bg-black z-10"
          />

          {/* header */}
          <div className="pt-10 px-4 pb-3 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full"
              style={{ background: "linear-gradient(135deg,#3b82f6,#8b5cf6)" }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold leading-tight">Carlos M.</div>
              <div className="text-text-mute text-[10px]">@carlos</div>
            </div>
            <div className="text-[10px] text-text-mute font-mono">2:41 pm</div>
          </div>

          {/* rating card */}
          <div className="mx-3 mb-3 rounded-2xl border border-primary/30 p-4"
            style={{
              background: "linear-gradient(135deg, rgba(16,185,129,.10), rgba(59,130,246,.06))",
            }}
          >
            <div className="text-text-mute text-[9px] uppercase tracking-wider mb-1">DomiRank Global</div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="font-mono font-extrabold"
                style={{
                  fontSize: "2.4rem",
                  lineHeight: 1,
                  backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  transition: "transform .5s ease",
                }}
                key={rating}
              >
                {rating.toFixed(1)}
              </span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(139,92,246,.18)", color: "#a78bfa", border: "1px solid rgba(139,92,246,.35)" }}
              >
                Veterano
              </span>
            </div>
            <div className="text-text-mute text-[10px] mt-2">38 partidas · 22V · 16D</div>
          </div>

          {/* recent matches */}
          <div className="px-3 space-y-2">
            <div className="text-[10px] font-semibold text-text-dim uppercase tracking-wider px-1">Recientes</div>
            {[
              { who: "vs @rafa", result: "G", delta: "+0.4", win: true },
              { who: "con @lucia", result: "G", delta: "+0.2", win: true },
              { who: "vs @miguel", result: "P", delta: "−0.3", win: false },
            ].map((m, i) => (
              <div key={i} className="flex items-center justify-between bg-surface-2 rounded-xl px-3 py-2.5 border border-border/50">
                <div className="text-[11px]">
                  <div className="font-medium">{m.who}</div>
                  <div className="text-text-mute text-[9px]">Hace {(i + 1) * 2}h</div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.win ? "bg-primary/15 text-primary" : "bg-danger/15 text-danger"}`}
                  >
                    {m.result}
                  </span>
                  <span className={`text-[11px] font-mono font-semibold ${m.win ? "text-primary" : "text-danger"}`}>
                    {m.delta}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* bottom nav hint */}
          <div className="absolute bottom-0 inset-x-0 h-14 bg-bg/95 backdrop-blur-xl border-t border-border flex items-center justify-around px-4">
            {["○", "◇", "+", "◎", "◯"].map((d, i) => (
              <span
                key={i}
                className={i === 0 ? "text-primary text-lg" : "text-text-mute text-base"}
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
