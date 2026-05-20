"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#e5e5e5", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "1rem", padding: "1rem" }}>
          <div style={{ fontSize: "3rem" }}>⚠️</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Error crítico</h1>
          <p style={{ color: "#a3a3a3", maxWidth: "28rem", fontSize: "0.875rem" }}>
            La aplicación encontró un error grave. Por favor recarga la página.
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
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
          {error.digest && (
            <p style={{ color: "#525252", fontSize: "0.75rem", fontFamily: "monospace" }}>ref: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
