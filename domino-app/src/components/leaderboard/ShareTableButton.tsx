"use client";

import { useRef, useState } from "react";

interface ShareTableButtonProps {
  tableRef: React.RefObject<HTMLDivElement | null>;
  tournamentName: string;
}

export function ShareTableButton({ tableRef, tournamentName }: ShareTableButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleShare() {
    if (!tableRef.current || loading) return;
    setLoading(true);

    try {
      // Lazy-load html-to-image solo cuando se usa
      const { toPng } = await import("html-to-image");

      const dataUrl = await toPng(tableRef.current, {
        pixelRatio: 2,
        // Excluye el botón de share y la barra de búsqueda del PNG
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.dataset.exportExclude === "true") return false;
          }
          return true;
        },
        style: {
          // Sin scrollbars, estados de hover limpios
          overflow: "visible",
        },
      });

      // Agregar footer "DomiRank · domirank.app" al canvas
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((res) => { img.onload = () => res(); });

      const canvas = document.createElement("canvas");
      const footerH = 40;
      canvas.width = img.width;
      canvas.height = img.height + footerH * 2; // padding top + footer
      const ctx = canvas.getContext("2d")!;

      // Fondo igual al card (#131c30)
      ctx.fillStyle = "#131c30";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Footer
      ctx.fillStyle = "rgba(255,255,255,.35)";
      ctx.font = `${footerH * 0.5}px Inter, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("DomiRank · domirank.app", canvas.width / 2, img.height + footerH * 1.2);

      const finalUrl = canvas.toDataURL("image/png");
      const blob = await (await fetch(finalUrl)).blob();
      const file = new File([blob], `domirank-${tournamentName.slice(0, 30).replace(/\s+/g, "-")}.png`, { type: "image/png" });

      // Mobile: Web Share API si disponible y soporta archivos
      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: `${tournamentName} · DomiRank`,
          text: "Tabla de posiciones",
          files: [file],
        });
      } else {
        // Desktop: descarga directa
        const a = document.createElement("a");
        a.href = finalUrl;
        a.download = file.name;
        a.click();
      }
    } catch (err) {
      console.error("[ShareTable]", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      data-export-exclude="true"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-surface-2 hover:bg-surface-3 border border-border text-text-dim hover:text-text transition-all duration-150 disabled:opacity-50 min-h-[36px]"
      aria-label="Compartir tabla como imagen"
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-text-mute border-t-primary animate-spin" />
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
      )}
      <span className="hidden sm:inline">{loading ? "Generando…" : "Compartir"}</span>
    </button>
  );
}
