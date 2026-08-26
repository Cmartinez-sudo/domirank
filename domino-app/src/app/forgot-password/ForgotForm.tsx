"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/lib/auth-actions";

export function ForgotForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const r = await requestPasswordReset(fd);
      if (r.ok) setSent(String(fd.get("email") ?? ""));
      else setError(r.error);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="card text-center">
        <div className="text-4xl mb-3">📬</div>
        <h2 className="text-lg font-semibold mb-2">Revisa tu correo</h2>
        <p className="text-text-dim text-sm">
          Si <strong className="text-text">{sent}</strong> tiene una cuenta, te enviamos un enlace para
          restablecer la contraseña.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 card">
      <div>
        <label className="label" htmlFor="email">Correo</label>
        <input id="email" name="email" type="email" required className="input" placeholder="tu@correo.com" />
      </div>
      {error && <div role="alert" aria-live="assertive" className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">{error}</div>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar enlace de recuperación"}
      </button>
    </form>
  );
}
