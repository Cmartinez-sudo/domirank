"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[page-error]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-4">
      <div className="text-5xl select-none">⚠️</div>
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="text-text-dim max-w-sm text-sm">
        {error.message || "Ocurrió un error inesperado. Por favor intenta de nuevo."}
      </p>
      <div className="flex gap-3 mt-2">
        <button onClick={reset} className="btn-primary">Reintentar</button>
        <Link href="/dashboard" className="btn-ghost">Ir al inicio</Link>
      </div>

      <details className="mt-6 w-full max-w-md text-left">
        <summary className="cursor-pointer text-text-mute text-xs">
          Detalles técnicos
        </summary>
        <div className="mt-2 p-3 bg-surface-2 rounded-lg border border-border text-xs font-mono space-y-2 text-text-dim break-words">
          {error.digest && <div><strong>Ref:</strong> {error.digest}</div>}
          <div><strong>Mensaje:</strong> {error.message || "(sin mensaje)"}</div>
          {error.stack && (
            <pre className="whitespace-pre-wrap text-text-mute text-[10px]">
              {error.stack.slice(0, 1200)}
            </pre>
          )}
        </div>
      </details>
    </div>
  );
}
