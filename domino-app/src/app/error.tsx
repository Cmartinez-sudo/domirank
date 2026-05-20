"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
      {error.digest && (
        <p className="text-text-mute text-xs mt-4 font-mono">ref: {error.digest}</p>
      )}
    </div>
  );
}
