import { requireUser } from "@/lib/auth";
import { NewGroupForm } from "./NewGroupForm";

export const dynamic = "force-dynamic";

export default async function NewGroupPage() {
  await requireUser();

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Crear grupo</h1>
        <p className="text-text-mute text-sm mt-1">
          Un grupo es un crew que comparte historial y leaderboard. Las partidas
          donde todos los jugadores sean miembros se atribuyen automáticamente.
        </p>
      </div>
      <NewGroupForm />
    </div>
  );
}
