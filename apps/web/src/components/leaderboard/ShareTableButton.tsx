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

      // Cargar imagen del leaderboard
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((res) => { img.onload = () => res(); });

      // Cargar logo PNG (V4 horizontal con tagline) para footer del PNG.
      // El raster es más confiable que SVG con canvas.drawImage (algunos browsers
      // tienen issues renderizando SVG inline a canvas).
      const logo = new Image();
      logo.crossOrigin = "anonymous";
      logo.src = "/branding/logo-horizontal-tagline.png";
      await new Promise<void>((res, rej) => {
        logo.onload = () => res();
        logo.onerror = () => rej(new Error("logo load"));
      }).catch(() => {
        // Si el logo no carga, seguimos sin él (footer text-only fallback)
      });

      const canvas = document.createElement("canvas");
      const footerH = 56;
      canvas.width = img.width;
      canvas.height = img.height + footerH * 2;
      const ctx = canvas.getContext("2d")!;

      // Fondo igual al card (#131c30)
      ctx.fillStyle = "#131c30";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Línea separadora sutil
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, img.height + footerH * 0.6);
      ctx.lineTo(canvas.width - 24, img.height + footerH * 0.6);
      ctx.stroke();

      // Footer: logo a la izquierda + URL a la derecha
      const footerY = img.height + footerH * 1.1;
      if (logo.complete && logo.naturalWidth > 0) {
        // Logo escalado a ~32px de alto preservando aspecto
        const targetH = 32;
        const logoAspect = logo.naturalWidth / logo.naturalHeight;
        const logoW = targetH * logoAspect;
        ctx.drawImage(logo, 24, footerY - targetH * 0.7, logoW, targetH);
      } else {
        // Fallback: solo text
        ctx.fillStyle = "rgba(255,255,255,.5)";
        ctx.font = `${footerH * 0.45}px Inter, -apple-system, sans-serif`;
        ctx.textAlign = "left";
        ctx.fillText("DomiRank", 24, footerY);
      }
      ctx.fillStyle = "rgba(255,255,255,.4)";
      ctx.font = `${footerH * 0.32}px Inter, -apple-system, sans-serif`;
      ctx.textAlign = "right";
      ctx.fillText("domirank.app", canvas.width - 24, footerY);

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
