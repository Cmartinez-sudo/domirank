"use client";

import Link from "next/link";
import { useState } from "react";
import { signUpWithPassword, signInWithOAuth } from "@/lib/auth-actions";

export function SignupForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  // 13 años atrás como fecha máxima permitida
  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().slice(0, 10);
  })();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const fd = new FormData(e.currentTarget);
      const r = await signUpWithPassword(fd);
      if (!r.ok) {
        setError(r.error);
      } else {
        setSentEmail(String(fd.get("email") ?? ""));
        setSent(true);
      }
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
          Te enviamos un enlace de confirmación a <strong className="text-text">{sentEmail}</strong>.
          Ábrelo desde el mismo dispositivo para activar tu cuenta.
        </p>
        <p className="text-text-mute text-xs mt-4">
          ¿No te llegó en unos minutos? Revisa spam, o{" "}
          <button className="text-primary hover:underline" onClick={() => setSent(false)}>
            usa otro correo
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SocialButtons />

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-text-mute text-xs uppercase tracking-wider">o con email</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="label" htmlFor="full_name">Nombre y apellido</label>
          <input id="full_name" name="full_name" type="text" required minLength={2} maxLength={80} className="input" placeholder="Carlos Martínez" autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="date_of_birth">Fecha de nacimiento</label>
          <input id="date_of_birth" name="date_of_birth" type="date" required max={maxDob} className="input" />
          <p className="text-text-mute text-xs mt-1">Debes tener al menos 13 años.</p>
        </div>
        <div>
          <label className="label" htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required className="input" placeholder="tu@correo.com" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" required minLength={8} maxLength={72} className="input" placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
        </div>

        <label className="flex items-start gap-2 text-sm cursor-pointer mt-2">
          <input type="checkbox" name="terms_accepted" required className="mt-1" />
          <span className="text-text-dim">
            Acepto los{" "}
            <Link href="/terms" target="_blank" className="text-primary hover:underline">
              Términos
            </Link>{" "}
            y la{" "}
            <Link href="/privacy" target="_blank" className="text-primary hover:underline">
              Política de privacidad
            </Link>{" "}
            de DomiRank.
          </span>
        </label>

        {error && (
          <div className="p-3 bg-danger/10 border border-danger/30 rounded text-danger text-sm">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="text-text-mute text-xs text-center mt-4">
        Al crear una cuenta también aceptas recibir correos de DomiRank (confirmaciones, magic links).
      </p>
    </div>
  );
}

function SocialButtons() {
  const [busy, setBusy] = useState(false);
  async function go(provider: "google" | "apple") {
    setBusy(true);
    await signInWithOAuth(provider);
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <button type="button" className="btn-ghost w-full justify-center flex items-center gap-2" disabled={busy} onClick={() => go("google")}>
        <GoogleIcon /> Continuar con Google
      </button>
      <button type="button" className="btn-ghost w-full justify-center flex items-center gap-2" disabled={busy} onClick={() => go("apple")}>
        <AppleIcon /> Continuar con Apple
      </button>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.99.66-2.25 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.47 1.18 4.95l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.46 2.13 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}
