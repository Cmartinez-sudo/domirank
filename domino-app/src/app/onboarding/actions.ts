"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
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
  const { mu, sigma } = useAssessment
    ? initialRatingFromAssessment(skillPoints!)
    : { mu: 25, sigma: 25 / 3 };

  const update: Record<string, unknown> = {
    country:          parsed.data.country,
    default_modality: parsed.data.modality,
    onboarded:        true,
  };

  if (useAssessment) {
    update.initial_skill_points = skillPoints;
    // Apply to all 4 buckets
    update.singles_mu      = mu;
    update.singles_sigma   = sigma;
    update.doubles_mu      = mu;
    update.doubles_sigma   = sigma;
    update.d9_singles_mu   = mu;
    update.d9_singles_sigma = sigma;
    update.d9_doubles_mu   = mu;
    update.d9_doubles_sigma = sigma;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message } as const;
  redirect("/dashboard");
}
