"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { COUNTRIES, MODALIDADES, type ModalityCode, type CountryCode } from "@domirank/shared/matches";
import { updateProfile, uploadAvatar, removeAvatar, signOut } from "@/lib/settings";
import { PushSubscriptionToggle } from "@/components/notifications/PushSubscriptionToggle";
import { ModalityPreferencesSection } from "./ModalityPreferencesSection";
import { AppearanceSection } from "./AppearanceSection";
import { RecalibrateSkillDialog } from "./RecalibrateSkillDialog";
import { analytics } from "@/lib/analytics";
import type { UserPreferences } from "@/types/user-preferences";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: CountryCode | null;
  default_modality: ModalityCode;
  email_notifications: boolean;
  date_of_birth: string | null;
  initial_skill_points: number | null;
};

export function SettingsForm({
  email,
  profile,
  initialPreferences,
}: {
  email: string;
  profile: Profile;
  initialPreferences?: UserPreferences | null;
}) {
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(profile.display_name ?? "");
  const [country, setCountry] = useState<CountryCode | null>(profile.country);
  const [modality, setModality] = useState<ModalityCode>(profile.default_modality);
  const [emailNotif, setEmailNotif] = useState<boolean>(profile.email_notifications);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [dob, setDob] = useState<string>(profile.date_of_birth ?? "");
  const [confirmDobOpen, setConfirmDobOpen] = useState(false);
  const [recalibrateOpen, setRecalibrateOpen] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const maxDob = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 13);
    return d.toISOString().slice(0, 10);
  })();

  async function saveDob() {
    setMsg(null);
    setPending(true);
    try {
      const r = await updateProfile({ date_of_birth: dob });
      if (r.ok) {
        setMsg({ kind: "ok", text: "Fecha actualizada" });
        analytics.track("dob_edited", { age_before: null, age_after: null });
      } else {
        setMsg({ kind: "error", text: r.error });
      }
    } finally {
      setPending(false);
      setConfirmDobOpen(false);
    }
  }

  async function save() {
    setMsg(null);
    setPending(true);
    try {
      const r = await updateProfile({
        display_name: name.trim() || undefined,
        country: country ?? undefined,
        default_modality: modality,
        email_notifications: emailNotif,
      });
      if (r.ok) setMsg({ kind: "ok", text: "Cambios guardados" });
      else setMsg({ kind: "error", text: r.error });
    } finally {
      setPending(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.set("file", f);
    setMsg(null);
    setPending(true);
    try {
      const r = await uploadAvatar(fd);
      if (r.ok) {
        setAvatarUrl(r.url);
        setMsg({ kind: "ok", text: "Foto actualizada" });
      } else {
        setMsg({ kind: "error", text: r.error });
      }
    } finally {
      setPending(false);
    }
  }

  async function removeAvatarClick() {
    setPending(true);
    try {
      const r = await removeAvatar();
      if (r.ok) setAvatarUrl(null);
      else setMsg({ kind: "error", text: r.error });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="card">
        <div className="flex items-center gap-4">
          <Avatar player={{ username: profile.username, display_name: name, avatar_url: avatarUrl }} size={72} />
          <div className="flex-1">
            <div className="font-medium">{name || profile.username}</div>
            <div className="text-text-mute text-sm">@{profile.username}</div>
            <div className="text-text-mute text-xs">{email}</div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          <button type="button" className="btn-ghost text-sm" disabled={pending} onClick={() => fileRef.current?.click()}>
            Subir foto
          </button>
          {avatarUrl && (
            <button type="button" className="btn-ghost text-sm text-danger" disabled={pending} onClick={removeAvatarClick}>
              Quitar foto
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
      </section>

      <section className="card space-y-3">
        <div>
          <label className="label">Nombre mostrado</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </div>
        <div>
          <label className="label">País</label>
          <select className="input" value={country ?? ""} onChange={(e) => setCountry((e.target.value || null) as CountryCode | null)}>
            <option value="">— Sin país —</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Modalidad por defecto</label>
          <select className="input" value={modality} onChange={(e) => setModality(e.target.value as ModalityCode)}>
            {Object.values(MODALIDADES).map((m) => (
              <option key={m.code} value={m.code}>{m.flag} {m.name} · {m.desc}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="card">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div className="flex-1">
            <div className="font-medium">Notificaciones por correo</div>
            <div className="text-text-mute text-xs mt-0.5">
              Solicitudes de amistad y confirmaciones de partidas.
            </div>
          </div>
          <input
            type="checkbox"
            checked={emailNotif}
            onChange={(e) => setEmailNotif(e.target.checked)}
            className="w-5 h-5 accent-primary"
          />
        </label>
      </section>

      {/* ── Push notifications ──────────────────────────────────────────── */}
      <section className="card space-y-1">
        <h2 className="font-semibold text-sm mb-3">Notificaciones push</h2>
        <PushSubscriptionToggle />
      </section>

      {/* ── Preferencias de partida ─────────────────────────────────────── */}
      <ModalityPreferencesSection initialPreferences={initialPreferences} />

      {/* ── Fecha de nacimiento (S2) ────────────────────────────────────── */}
      <section className="card space-y-2">
        <label className="label">Fecha de nacimiento</label>
        <input
          type="date"
          className="input"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          max={maxDob}
        />
        <p className="text-text-mute text-xs">
          Solo cambia si te equivocaste al registrarte. Debes tener al menos 13 años.
        </p>
        <button
          type="button"
          className="btn-ghost text-sm"
          disabled={pending || !dob || dob === (profile.date_of_birth ?? "")}
          onClick={() => setConfirmDobOpen(true)}
        >
          Guardar fecha
        </button>
      </section>

      {/* ── Recalibrar nivel (S1) ───────────────────────────────────────── */}
      <section className="card space-y-2">
        <h2 className="font-semibold text-sm">Recalibrar mi nivel</h2>
        <p className="text-text-mute text-xs">
          Vuelve a responder las 4 preguntas del onboarding. Si aún no tienes
          rating real, esto actualiza tu DomiRank inicial estimado.
        </p>
        {profile.initial_skill_points != null && (
          <p className="text-text-mute text-xs">Skill actual: {profile.initial_skill_points} pts</p>
        )}
        <button
          type="button"
          className="btn-ghost text-sm"
          onClick={() => setRecalibrateOpen(true)}
        >
          Volver a hacer el assessment
        </button>
      </section>

      {/* ── Apariencia ──────────────────────────────────────────────────── */}
      <AppearanceSection />

      <RecalibrateSkillDialog open={recalibrateOpen} onClose={() => setRecalibrateOpen(false)} />

      {confirmDobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmDobOpen(false)}>
          <div
            className="bg-surface-1 rounded-2xl border border-border max-w-sm w-full p-6 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold">¿Cambiar tu fecha de nacimiento?</h2>
            <p className="text-text-mute text-sm">
              Solo cambia si te equivocaste al registrarte. Usamos esta fecha para
              verificar la edad mínima (13+).
            </p>
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-ghost flex-1" onClick={() => setConfirmDobOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary flex-1" onClick={saveDob} disabled={pending}>
                {pending ? "Guardando…" : "Sí, cambiar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && (
        <div className={`p-3 rounded-md text-sm ${msg.kind === "ok" ? "bg-primary/10 border border-primary/30 text-primary" : "bg-danger/10 border border-danger/30 text-danger"}`}>
          {msg.text}
        </div>
      )}

      <button className="btn-primary w-full" disabled={pending} onClick={save}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>

      <Link href="/onboarding" className="btn-ghost w-full block text-center">
        Rehacer onboarding (país + modalidad)
      </Link>

      <form action={signOut as any}>
        <button type="submit" className="btn-ghost w-full text-danger">Cerrar sesión</button>
      </form>
    </div>
  );
}
