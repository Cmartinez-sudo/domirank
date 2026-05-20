"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

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
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false as const, error: "Correo o contraseña inválidos" };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false as const, error: error.message };
  redirect("/dashboard");
}

const MagicSchema = z.object({ email: z.string().email() });

export async function signInWithMagicLink(formData: FormData) {
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
  if (error) return { ok: false as const, error: error.message };
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
  if (error) return { ok: false as const, error: error.message };
  if (data?.url) redirect(data.url);
  return { ok: true as const };
}

const ResetReqSchema = z.object({ email: z.string().email() });
export async function requestPasswordReset(formData: FormData) {
  const parsed = ResetReqSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false as const, error: "Correo inválido" };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getOrigin()}/reset-password`,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

const UpdatePwSchema = z.object({ password: PasswordRules });
export async function updatePassword(formData: FormData) {
  const parsed = UpdatePwSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false as const, error: error.message };
  redirect("/dashboard");
}

function getOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
