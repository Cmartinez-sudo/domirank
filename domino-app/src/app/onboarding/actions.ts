"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { initialRatingFromAssessment } from "@/lib/rating";

const Schema = z.object({
  country:      z.enum(["VE","DO","CU","PR","CO","MX","PA","ES","US","AR","CL","PE","OT"]),
  modality:     z.enum(["ven","dom","cub","pri","custom"]),
  skill_points: z.coerce.number().int().min(0).max(12).optional(),
});

export async function saveOnboarding(formData: FormData) {
  const parsed = Schema.safeParse({
    country:      formData.get("country"),
    modality:     formData.get("modality"),
    skill_points: formData.get("skill_points"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Datos inválidos" } as const;
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" } as const;

  const skillPoints = parsed.data.skill_points;
  const useAssessment = skillPoints !== undefined;
  const { elo } = useAssessment
    ? initialRatingFromAssessment(skillPoints!)
    : { elo: 1500 };

  const update: Record<string, unknown> = {
    country:          parsed.data.country,
    default_modality: parsed.data.modality,
    onboarded:        true,
  };

  if (useAssessment) {
    update.initial_skill_points = skillPoints;
    // Aplicar Elo inicial a ambos buckets doubles + global.
    update.doubles_elo    = elo;
    update.d9_doubles_elo = elo;
    update.global_elo     = elo;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message } as const;
  return { ok: true as const, next: "/dashboard" };
}
