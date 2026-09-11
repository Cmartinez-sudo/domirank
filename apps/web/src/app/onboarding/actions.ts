"use server";

import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { initialRatingFromAssessment } from "@domirank/shared/rating";
import {
  PRESETS,
  countRuleFromLegacyModality,
  type PresetId,
} from "@domirank/shared/matches";
import { analytics } from "@/lib/analytics"; // solo tipos

const PRESET_IDS = ["rapido", "clasico", "doble9", "mesa-completa", "personalizado"] as const;

// ============================================================
// SCHEMAS
// ============================================================

const Schema = z.object({
  country:      z.enum(["VE","DO","CU","PR","CO","MX","PA","ES","US","AR","CL","PE","OT"]),
  /** @deprecated Se acepta por compat, pero el schema nuevo prefiere `preset`. */
  modality:     z.enum(["ven","dom","cub","pri","custom"]).optional(),
  preset:       z.enum(PRESET_IDS).optional(),
  skill_points: z.coerce.number().int().min(0).max(12).optional(),
  /** Sprint 1b: fecha nac se pide en onboarding si aún es null (signup OAuth). */
  date_of_birth: z.string().optional(),
  /** Sprint 1b: avatar_url (upload o initials fallback). */
  avatar_url:   z.string().url().optional().or(z.literal("")),
});

const ProgressSchema = z.object({
  step: z.string().min(1).max(30),
  answers: z.record(z.union([z.number().int(), z.string(), z.boolean()])).optional(),
});

// ============================================================
// completeOnboarding (V2)
// ============================================================

export async function saveOnboarding(formData: FormData) {
  const parsed = Schema.safeParse({
    country:       formData.get("country"),
    modality:      formData.get("modality") || undefined,
    preset:        formData.get("preset") || undefined,
    skill_points:  formData.get("skill_points"),
    date_of_birth: formData.get("date_of_birth") || undefined,
    avatar_url:    formData.get("avatar_url") || undefined,
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

  const presetId: PresetId =
    parsed.data.preset ??
    (parsed.data.modality === "ven"    ? "rapido"
     : parsed.data.modality === "dom"  ? "clasico"
     : parsed.data.modality === "cub"  ? "clasico"
     : parsed.data.modality === "pri"  ? "mesa-completa"
     : "rapido");

  const preset = PRESETS[presetId];
  const legacyModality = parsed.data.modality ?? "custom";

  const profileUpdate: Record<string, unknown> = {
    country:              parsed.data.country,
    default_modality:     legacyModality,
    default_count_rule:   preset.countRule,
    onboarded:            true,
    // Sprint 1b: telemetría de completion.
    onboarding_version:      2,
    onboarding_completed_at: new Date().toISOString(),
    onboarding_skipped:      false,
    onboarding_step:         "celebration",
  };

  if (useAssessment) {
    profileUpdate.initial_skill_points = skillPoints;
    profileUpdate.doubles_elo    = elo;
    profileUpdate.d9_doubles_elo = elo;
    profileUpdate.global_elo     = elo;
  }

  if (parsed.data.date_of_birth) {
    profileUpdate.date_of_birth = parsed.data.date_of_birth;
  }

  if (parsed.data.avatar_url && parsed.data.avatar_url.length > 0) {
    profileUpdate.avatar_url = parsed.data.avatar_url;
  }

  const { error: profileErr } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", user.id);

  if (profileErr) return { ok: false, error: profileErr.message } as const;

  const { error: prefErr } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: user.id,
        default_count_rule:    preset.countRule,
        default_set_size:      preset.set,
        default_target_points: preset.target,
        default_capicua_bonus: preset.capicua,
        default_match_modality:
          legacyModality === "custom" || legacyModality == null
            ? null
            : legacyModality,
      },
      { onConflict: "user_id" },
    );

  if (prefErr) {
    console.warn("[saveOnboarding] user_preferences upsert falló:", prefErr.message);
  }

  // Cleanup: onboarding_progress ya no es necesario para este user.
  await supabase.from("onboarding_progress").delete().eq("user_id", user.id);

  void countRuleFromLegacyModality;
  void analytics; // silence unused
  return { ok: true as const, next: "/" };
}

// ============================================================
// saveOnboardingProgress (Regla 8: guardar incrementalmente)
// ============================================================

export async function saveOnboardingProgress(input: {
  step: string;
  answers?: Record<string, number | string | boolean>;
}) {
  const parsed = ProgressSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" } as const;

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" } as const;

  const svc = supabaseService();

  // Merge answers si vienen (para no perder respuestas previas de otros steps).
  if (parsed.data.answers) {
    const { data: existing } = await svc
      .from("onboarding_progress")
      .select("answers")
      .eq("user_id", user.id)
      .maybeSingle();
    const prev = (existing?.answers as Record<string, unknown> | undefined) ?? {};
    const merged = { ...prev, ...parsed.data.answers };

    const { error } = await svc
      .from("onboarding_progress")
      .upsert(
        {
          user_id: user.id,
          answers: merged,
          current_step: parsed.data.step,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id" },
      );
    if (error) return { ok: false, error: error.message } as const;
  } else {
    const { error } = await svc
      .from("onboarding_progress")
      .upsert(
        {
          user_id: user.id,
          current_step: parsed.data.step,
          updated_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id" },
      );
    if (error) return { ok: false, error: error.message } as const;
  }

  await svc.from("profiles").update({ onboarding_step: parsed.data.step } as never).eq("id", user.id);
  return { ok: true as const };
}

// ============================================================
// loadOnboardingProgress
// ============================================================

export async function loadOnboardingProgress() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" } as const;

  const { data } = await supabase
    .from("onboarding_progress")
    .select("answers, current_step")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    ok: true as const,
    answers: (data?.answers as Record<string, number | string | boolean> | undefined) ?? {},
    currentStep: (data?.current_step as string | null | undefined) ?? null,
  };
}

// ============================================================
// skipOnboardingGlobal (Paso 0)
// ============================================================

const SkipSchema = z.object({
  country: z.enum(["VE","DO","CU","PR","CO","MX","PA","ES","US","AR","CL","PE","OT"]).nullable().optional(),
});

/**
 * Skip global desde Paso 0: crea perfil con defaults y marca completado.
 * País por IP-geo si viene desde el cliente (o "OT" fallback).
 * Modalidad = "clasico" (default global). Skill = 10 (medio).
 */
export async function skipOnboardingGlobal(input?: { country?: string | null }) {
  const parsed = SkipSchema.safeParse(input ?? {});
  const country = parsed.success && parsed.data.country ? parsed.data.country : "OT";

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" } as const;

  const defaultPreset = PRESETS.clasico;

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({
      country,
      default_modality:        "dom",
      default_count_rule:      defaultPreset.countRule,
      initial_skill_points:    6, // "medio" — user puede recalibrar en /settings
      onboarded:               true,
      onboarding_version:      2,
      onboarding_completed_at: new Date().toISOString(),
      onboarding_skipped:      true,
      onboarding_step:         "skipped",
    })
    .eq("id", user.id);

  if (profileErr) return { ok: false, error: profileErr.message } as const;

  await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      default_count_rule:    defaultPreset.countRule,
      default_set_size:      defaultPreset.set,
      default_target_points: defaultPreset.target,
      default_capicua_bonus: defaultPreset.capicua,
      default_match_modality: "dom",
    },
    { onConflict: "user_id" },
  );

  await supabase.from("onboarding_progress").delete().eq("user_id", user.id);

  return { ok: true as const, next: "/" };
}

// ============================================================
// dismissP1
// ============================================================

/**
 * Sprint 1b: usuario tap "Solo explorar por ahora" en P1.
 * Incrementa p1_dismissed_count; una vez ≥3 el dashboard ya no muestra P1
 * como pantalla dedicada, solo como card sticky.
 */
export async function dismissP1() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" } as const;

  // Increment atómico: usa SQL raw update para evitar race.
  const { error } = await supabase.rpc("increment_p1_dismissed", { p_user_id: user.id } as never);
  if (error) {
    // Fallback: read + update no-atómico.
    const { data: profile } = await supabase
      .from("profiles")
      .select("p1_dismissed_count")
      .eq("id", user.id)
      .maybeSingle();
    const current = (profile?.p1_dismissed_count as number | undefined) ?? 0;
    await supabase
      .from("profiles")
      .update({ p1_dismissed_count: current + 1 })
      .eq("id", user.id);
  }

  return { ok: true as const };
}
