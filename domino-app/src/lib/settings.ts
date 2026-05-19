"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const ProfileSchema = z.object({
  display_name: z.string().min(1).max(80).optional(),
  country: z.string().length(2).optional(),
  default_modality: z.enum(["ven", "dom", "cub", "pri", "custom"]).optional(),
});

export async function updateProfile(input: z.infer<typeof ProfileSchema>) {
  const parsed = ProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Datos inválidos" };
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true as const };
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false as const, error: "Sin archivo" };
  if (file.size > 2 * 1024 * 1024) return { ok: false as const, error: "Imagen muy grande (máx 2MB)" };
  if (!file.type.startsWith("image/")) return { ok: false as const, error: "Tiene que ser una imagen" };

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (upErr) return { ok: false as const, error: upErr.message };

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = pub.publicUrl;

  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true as const, url };
}

export async function removeAvatar() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "No autenticado" };
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
