"use client";

import { useEffect } from "react";

/**
 * TEMPORARY DEBUG — error boundary local a /groups.
 * Captura errores del render del segmento y muestra info completa.
 * TODO: remover una vez identificado el bug.
 */
export default function GroupsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[/groups error]", error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-500/40 bg-red-950/20 p-4 space-y-2 text-sm">
      <div className="text-red-400 font-bold text-base">
        Debug: /groups crash caught
      </div>
      <div className="font-mono text-xs whitespace-pre-wrap break-all bg-black/40 p-3 rounded">
        <strong>Message:</strong>{" "}
        <span className="text-red-200">{error.message || "(empty message)"}</span>
      </div>
      {error.digest && (
        <div className="font-mono text-xs">
          <strong>Digest:</strong> {error.digest}
        </div>
      )}
      {error.stack && (
        <details open>
          <summary className="cursor-pointer text-red-300 text-xs">Stack</summary>
          <pre className="text-[10px] overflow-auto max-h-96 mt-1 bg-black/40 p-2 rounded">
            {error.stack}
          </pre>
        </details>
      )}
      <button
        onClick={reset}
        className="rounded-md bg-red-900/50 hover:bg-red-900/70 border border-red-500/30 px-3 py-1.5 text-xs text-red-200"
      >
        Reintentar
      </button>
    </div>
  );
}
