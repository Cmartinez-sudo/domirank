"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { initialRatingFromAssessment } from "@/lib/rating";
import {
  PRESETS,
  countRuleFromLegacyModality,
  type PresetId,
} from "@/lib/modalidades";

const PRESET_IDS = ["rapido", "clasico", "doble9", "mesa-completa", "personalizado"] as const;

const Schema = z.object({
  country:      z.enum(["VE","DO","CU","PR","CO","MX","PA","ES","US","AR","CL","PE","OT"]),
  /** @deprecated Se acepta por compat, pero el schema nuevo prefiere `preset`. */
  modality:     z.enum(["ven","dom","cub","pri","custom"]).optional(),
  preset:       z.enum(PRESET_IDS).optional(),
  skill_points: z.coerce.number().int().min(0).max(12).optional(),
});

export async function saveOnboarding(formData: FormData) {
  const parsed = Schema.safeParse({
    country:      formData.get("country"),
    modality:     formData.get("modality") || undefined,
    preset:       formData.get("preset") || undefined,
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

  // Resolver preset: prefiere `preset` explícito; si no vino, deriva del legacy `modality`.
  const presetId: PresetId =
    parsed.data.preset ??
    (parsed.data.modality === "ven"    ? "rapido"
     : parsed.data.modality === "dom"  ? "clasico"
     : parsed.data.modality === "cub"  ? "clasico" // Cuba post-refactor → Clásico (d9 fuera de menú)
     : parsed.data.modality === "pri"  ? "mesa-completa"
     : "rapido");

  const preset = PRESETS[presetId];
  const legacyModality = parsed.data.modality ?? "custom";

  // 1. Actualizar profiles (país + legacy default_modality + count_rule).
  const profileUpdate: Record<string, unknown> = {
    country:              parsed.data.country,
    default_modality:     legacyModality,           // legacy, dual-write
    default_count_rule:   preset.countRule,          // nueva identidad
    onboarded:            true,
  };

  if (useAssessment) {
    profileUpdate.initial_skill_points = skillPoints;
    // Aplicar Elo inicial a ambos buckets doubles + global.
    profileUpdate.doubles_elo    = elo;
    profileUpdate.d9_doubles_elo = elo;
    profileUpdate.global_elo     = elo;
  }

  const { error: profileErr } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (profileErr) return { ok: false, error: profileErr.message } as const;

  // 2. Upsert user_preferences con los 4 defaults derivados del preset.
  //    Fuente de verdad del skip flow.
  const { error: prefErr } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        default_count_rule:    preset.countRule,
        default_set_size:      preset.set,
        default_target_points: preset.target,
        default_capicua_bonus: preset.capicua,
        // legacy dual-write por compat mientras existan lectores viejos.
        default_match_modality:
          legacyModality === "custom" || legacyModality == null
            ? null
            : legacyModality,
      },
      { onConflict: "user_id" },
    );

  if (prefErr) {
    console.warn("[saveOnboarding] user_preferences upsert falló:", prefErr.message);
    // No abortamos: el rating y profiles ya se actualizaron. El usuario puede
    // seguir con onboarding; el skip flow simplemente no aplicará.
  }

  // Silence unused import warning — countRuleFromLegacyModality queda disponible
  // para futuros usos si el schema legacy sigue creciendo.
  void countRuleFromLegacyModality;

  return { ok: true as const, next: "/dashboard" };
}
