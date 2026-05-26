"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { rl, checkLimit } from "@/lib/ratelimit";
import { getAppUrl } from "@/lib/email";

function getIp(): string {
  // Trustworthy on Vercel: x-real-ip set from the TCP source, immune to client spoofing.
  // x-forwarded-for fallback uses the LAST value (Vercel appends its observed IP),
  // not the first (which the client controls).
  const h = headers();
  const real = h.get("x-real-ip");
  if (real) return real;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }
  // Last-resort fallback: derive from user-agent so a single shared "anon"
  // bucket can't be saturated by one bad actor and block every IP-less caller
  // (e.g. a misconfigured proxy strips the header). User-agents are easily
  // spoofed, but rotating UAs to bypass the limit forces real cost.
  const ua = h.get("user-agent");
  if (ua) return `ua:${ua.slice(0, 100)}`;
  return "anon";
}

const PasswordRules = z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres");

const SignupSchema = z.object({
  full_name: z.string().min(2, "Nombre muy corto").max(80, "Nombre muy largo"),
  email: z.string().email("Correo inválido"),
  password: PasswordRules,
  date_of_birth: z.string().refine((s) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return false;
    const min = new Date();
    min.setFullYear(min.getFullYear() - 13);
    return d <= min;
  }, "Debes tener al menos 13 años"),
  terms_accepted: z.literal("on", { errorMap: () => ({ message: "Debes aceptar los términos" }) }),
});

export async function signUpWithPassword(formData: FormData) {
  const limit = await checkLimit(rl.auth, `signup:${getIp()}`);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  const parsed = SignupSchema.safeParse({
    full_name:      formData.get("full_name"),
    email:          formData.get("email"),
    password:       formData.get("password"),
    date_of_birth:  formData.get("date_of_birth"),
    terms_accepted: formData.get("terms_accepted"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { full_name, email, password, date_of_birth } = parsed.data;

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name,
        date_of_birth,
        signup_method: "email_password",
        terms_accepted: true,
      },
      emailRedirectTo: `${getOrigin()}/auth/callback`,
    },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, requiresConfirmation: true };
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signInWithPassword(formData: FormData) {
  const limit = await checkLimit(rl.auth, `signin:${getIp()}`);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false as const, error: "Correo o contraseña inválidos" };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Anti-enumeration: nunca distinguir "email no existe" vs "contraseña incorrecta"
    // ni "email no confirmado". Log real server-side, mensaje genérico al cliente.
    console.error("signInWithPassword failed:", error.message);
    return { ok: false as const, error: "Correo o contraseña inválidos" };
  }

  // Devolvemos el destino al cliente para que haga full-reload (más confiable
  // que redirect() desde Server Action — Next 14.2 puede perder cookies recién
  // seteadas en algunos casos). El cliente hace window.location.assign(next),
  // garantizando que el middleware refresque el estado de sesión.
  const { data: { user } } = await supabase.auth.getUser();
  let next: string = "/dashboard";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", user.id)
      .single();
    if (profile && profile.onboarded === false) next = "/onboarding";
  }
  return { ok: true as const, next };
}

const MagicSchema = z.object({ email: z.string().email() });

export async function signInWithMagicLink(formData: FormData) {
  const limit = await checkLimit(rl.auth, `magic:${getIp()}`);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  const parsed = MagicSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false as const, error: "Correo inválido" };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${getOrigin()}/auth/callback`,
      shouldCreateUser: true,
      data: { signup_method: "magic_link", terms_accepted: true },
    },
  });
  if (error) {
    // Anti-enumeration: respuesta uniforme tanto si Supabase rechaza por
    // rate limit, email inválido en su lado, o problema transitorio.
    // Log server-side para investigación.
    console.error("signInWithMagicLink failed:", error.message);
  }
  return { ok: true as const };
}

export async function signInWithOAuth(provider: "google" | "apple") {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${getOrigin()}/auth/callback`,
    },
  });
  if (error) {
    console.error("signInWithOAuth failed:", error.message);
    return { ok: false as const, error: `No se pudo iniciar sesión con ${provider}. Intenta de nuevo o usa correo.` };
  }
  if (!data?.url) {
    return { ok: false as const, error: "Respuesta inválida del proveedor de auth" };
  }
  // Devolvemos la URL en vez de hacer redirect() server-side. El cliente hace
  // window.location.assign(url) — más confiable y mejor UX (no se ven flashes
  // de navegación intermedia).
  return { ok: true as const, url: data.url };
}

const ResetReqSchema = z.object({ email: z.string().email() });
export async function requestPasswordReset(formData: FormData) {
  const limit = await checkLimit(rl.auth, `reset:${getIp()}`);
  if (!limit.allowed) return { ok: false as const, error: limit.error };

  const parsed = ResetReqSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false as const, error: "Correo inválido" };

  const supabase = await supabaseServer();
  // El email lleva ?code=... que debe canjearse por sesión en /auth/callback
  // antes de mostrar el formulario de cambio de contraseña. El parámetro `next`
  // indica al callback a dónde llevar al usuario después del exchange.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error) {
    // Anti-enumeration: igual que magic link, no diferenciar entre
    // "email no existe", rate limit del proveedor, o error transitorio.
    console.error("requestPasswordReset failed:", error.message);
  }
  return { ok: true as const };
}

const UpdatePwSchema = z.object({ password: PasswordRules });
export async function updatePassword(formData: FormData) {
  const parsed = UpdatePwSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Contraseña inválida" };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, next: "/dashboard" };
}

const getOrigin = getAppUrl;
