import { requireOnboardedUser } from "@/lib/auth";
import { WizardEntry } from "./WizardEntry";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Punto de entrada del wizard de torneo.
 * Si hay draft en localStorage → modal "¿Continuar borrador?".
 * Si no → redirect inmediato al step-1 (manejado por WizardEntry en cliente).
 */
export default async function NewTournamentPage() {
  const user = await requireOnboardedUser();
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, country, default_modality")
    .eq("id", user.id)
    .single();

  return (
    <WizardEntry
      userId={user.id}
      defaultModality={(profile as any)?.default_modality ?? "dom"}
    />
  );
}
