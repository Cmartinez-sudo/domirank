import { requireOnboardedUser } from "@/lib/auth";
import { Step1Form } from "./Step1Form";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Step1Page() {
  const user = await requireOnboardedUser();
  const supabase = await supabaseServer();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  return <Step1Form userId={profile?.id ?? user.id} />;
}
