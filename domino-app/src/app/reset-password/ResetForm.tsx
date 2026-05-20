"use client";

import { useState } from "react";
import { updatePassword } from "@/lib/auth-actions";

export function ResetForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const r = await updatePassword(new FormData(e.currentTarget));
      if (r && !r.ok) setError(r.error ?? "Error");
      // Si ok, redirige a /dashboard desde la server action
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 card">
      <div>
        <label className="label" htmlFor="password">Nueva contraseña</label>
        <input id="password" name="password" type="password" required minLength={8} maxLength={72} className="input" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
      </div>
      {error && <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">{error}</div>}
      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "Guardando…" : "Guardar contraseña"}
      </button>
    </form>
  );
}
