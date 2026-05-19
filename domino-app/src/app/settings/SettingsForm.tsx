"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { COUNTRIES, MODALIDADES, type ModalityCode, type CountryCode } from "@/lib/modalidades";
import { updateProfile, uploadAvatar, removeAvatar, signOut } from "@/lib/settings";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: CountryCode | null;
  default_modality: ModalityCode;
};

export function SettingsForm({ email, profile }: { email: string; profile: Profile }) {
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(profile.display_name ?? "");
  const [country, setCountry] = useState<CountryCode | null>(profile.country);
  const [modality, setModality] = useState<ModalityCode>(profile.default_modality);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    setMsg(null);
    setPending(true);
    try {
      const r = await updateProfile({
        display_name: name.trim() || undefined,
        country: country ?? undefined,
        default_modality: modality,
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
