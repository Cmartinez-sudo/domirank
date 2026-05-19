"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="card">
        <h1 className="text-2xl font-bold mb-2">Entrar / Crear cuenta</h1>
        <p className="text-text-dim mb-6">
          Te enviamos un enlace mágico a tu correo. Sin contraseñas.
        </p>

        {status === "sent" ? (
          <div className="p-4 bg-primary/10 border border-primary/30 rounded-md text-sm">
            <p className="font-medium text-primary mb-1">Revisa tu correo</p>
            <p className="text-text-dim">
              Te enviamos un enlace a <strong className="text-text">{email}</strong>.
              Ábrelo desde el mismo dispositivo para iniciar sesión.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Correo</label>
              <input
                id="email"
                type="email"
                required
                className="input"
                placeholder="tu@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "sending"}
              />
            </div>
            {error && (
              <p className="text-danger text-sm">{error}</p>
            )}
            <button
              type="submit"
              className="btn-primary w-full"
              disabled={status === "sending" || !email}
            >
              {status === "sending" ? "Enviando..." : "Enviar enlace mágico"}
            </button>
          </form>
        )}
      </div>
      <p className="text-text-mute text-xs text-center mt-4">
        Al continuar aceptas que esto es un MVP. Tus datos viven en Supabase.
      </p>
    </div>
  );
}
