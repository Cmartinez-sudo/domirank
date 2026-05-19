"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

const Schema = z.object({
  country: z.enum(["VE","DO","CU","PR","CO","MX","PA","ES","US","AR","CL","PE","OT"]),
  modality: z.enum(["ven","dom","cub","pri","custom"]),
});

export async function saveOnboarding(formData: FormData) {
  const parsed = Schema.safeParse({
    country:  formData.get("country"),
    modality: formData.get("modality"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" } as const;
  }
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" } as const;

  const { error } = await supabase
    .from("profiles")
    .update({
      country: parsed.data.country,
      default_modality: parsed.data.modality,
      onboarded: true,
    })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message } as const;
  redirect("/dashboard");
}
