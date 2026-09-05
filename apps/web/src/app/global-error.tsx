"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log to console so usuario o developer puede ver detalles en DevTools
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#e5e5e5", margin: 0, padding: "1rem" }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "1rem", maxWidth: "32rem", margin: "0 auto" }}>
          <div style={{ fontSize: "3rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Error crítico</h1>
          <p style={{ color: "#a3a3a3", fontSize: "0.875rem" }}>
            La aplicación encontró un error grave. Por favor recarga la página.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            <button
              onClick={reset}
              style={{ background: "#10b981", color: "#000", border: "none", borderRadius: "0.75rem", padding: "0.625rem 1.25rem", fontWeight: 600, cursor: "pointer" }}
            >
              Reintentar
            </button>
            <a
              href="/"
              style={{ background: "transparent", color: "#a3a3a3", border: "1px solid #333", borderRadius: "0.75rem", padding: "0.625rem 1.25rem", textDecoration: "none", fontWeight: 500 }}
            >
              Ir al inicio
            </a>
          </div>

          {/* Detalles técnicos visibles para debug */}
          <details style={{ marginTop: "2rem", width: "100%", textAlign: "left", background: "#171717", border: "1px solid #333", borderRadius: "0.5rem", padding: "0.75rem" }}>
            <summary style={{ cursor: "pointer", color: "#a3a3a3", fontSize: "0.75rem" }}>
              Detalles técnicos (para reportar el error)
            </summary>
            <div style={{ marginTop: "0.75rem", fontFamily: "monospace", fontSize: "0.7rem", color: "#fbbf24", wordBreak: "break-word" }}>
              <div><strong>Mensaje:</strong> {error.message || "(sin mensaje)"}</div>
              {error.digest && <div style={{ marginTop: "0.5rem" }}><strong>Digest:</strong> {error.digest}</div>}
              {error.stack && (
                <pre style={{ marginTop: "0.5rem", color: "#a3a3a3", whiteSpace: "pre-wrap", fontSize: "0.65rem" }}>
                  {error.stack.slice(0, 1500)}
                </pre>
              )}
            </div>
          </details>
        </div>
      </body>
    </html>
  );
}
