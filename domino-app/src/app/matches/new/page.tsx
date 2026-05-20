import { requireOnboardedUser, getCurrentProfile } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { NewMatchForm } from "./NewMatchForm";

export const dynamic = "force-dynamic";

export default async function NewMatchPage() {
  const user = await requireOnboardedUser();
  const profile: any = await getCurrentProfile();
  const supabase = await supabaseServer();

  // Cuántos amigos tiene (controla el CTA "necesitas amigos")
  const { count: friendsCount } = await supabase
    .from("friendships")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="text-3xl font-bold">Nueva partida</h1>
      <p className="text-text-dim">
        Elige modalidad y oponentes. Solo puedes jugar con tus amigos.
      </p>
      <NewMatchForm
        currentUser={{
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          country: profile.country,
        }}
        defaultModality={profile?.default_modality ?? "ven"}
        friendsCount={friendsCount ?? 0}
      />
    </div>
  );
}
