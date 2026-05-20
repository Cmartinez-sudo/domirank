import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { PageTransition } from "@/components/Motion";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const user = await getCurrentUser();
  const supabase = await supabaseServer();
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, points_to_win, rounds, continuous, rated, status, visibility, modality, created_at")
    .order("created_at", { ascending: false });

  const active   = (tournaments ?? []).filter(t => t.status === "active");
  const finished = (tournaments ?? []).filter(t => t.status !== "active");

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Torneos</h1>
            <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(251,191,36,.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,.3)" }}>beta</span>
          </div>
          {user && <Link href="/tournaments/new" className="btn-primary">+ Nuevo torneo</Link>}
        </div>

        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20 text-sm text-yellow-200/70">
          <span className="shrink-0 mt-0.5">🧪</span>
          <span>Los torneos están en fase beta. Puede haber cambios en el flujo. Tu feedback es bienvenido.</span>
        </div>

        <Section title="Activas" empty="No hay torneos activos." rows={active} />
        {finished.length > 0 && <Section title="Finalizadas" empty="" rows={finished} />}
      </div>
    </PageTransition>
  );
}

function Section({ title, empty, rows }: { title: string; empty: string; rows: any[] }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      {rows.length === 0
        ? <div className="card text-text-mute text-center py-8">{empty}</div>
        : <div className="space-y-3">{rows.map(t => <TournamentCard key={t.id} t={t} />)}</div>}
    </section>
  );
}

function TournamentCard({ t }: { t: any }) {
  return (
    <Link href={`/tournaments/${t.id}`} className="card block hover:border-primary/40">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">🍻</span>
          <div className="min-w-0">
            <div className="font-semibold">{t.name}</div>
            <div className="text-text-mute text-sm">
              {t.points_to_win} pts {t.continuous ? "· ∞ continua" : t.rounds ? `· meta ${t.rounds}` : ""}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          {t.visibility === "public" && <span className="badge bg-info/15 text-info">🌍</span>}
          {t.visibility === "friends" && <span className="badge bg-warning/15 text-warning">👥</span>}
          {t.visibility === "private" && <span className="badge bg-surface-2 text-text-mute">🔒</span>}
          {t.rated
            ? <span className="badge bg-primary/15 text-primary">Rankeada</span>
            : <span className="badge bg-surface-2 text-text-mute">Casual</span>}
          {t.status === "finished" && <span className="badge bg-surface-2 text-text-mute">Finalizada</span>}
        </div>
      </div>
    </Link>
  );
}
