import Link from "next/link";
import { FORMAT_LIST } from "@domirank/shared/tournaments";

export const metadata = { title: "Formatos de torneo · DomiRank" };

export default function FormatosPage() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Formatos de torneo</h1>
        <p className="text-text-dim mt-1">Elige el formato según cuántos jugadores tienes y cuánto tiempo quieres jugar.</p>
      </div>

      <div className="space-y-4">
        {FORMAT_LIST.map((f) => (
          <div key={f.code} className="card space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold">{f.name}</h2>
                  {f.autopairing && (
                    <span className="badge bg-primary/15 text-primary text-[10px]">Auto-pareo</span>
                  )}
                </div>
                <p className="text-text-mute text-sm">{f.short}</p>
              </div>
            </div>

            <p className="text-text-dim text-sm leading-relaxed">{f.description}</p>

            {/* Fairness bar */}
            <div className="flex items-center gap-2 text-xs text-text-mute">
              <span>Justicia</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-5 h-1.5 rounded-full ${i < f.fairness ? "bg-primary" : "bg-surface-3"}`}
                  />
                ))}
              </div>
              <span className="text-text-mute">·</span>
              <span>{f.minPlayers}-{f.maxPlayers} jugadores</span>
              <span className="text-text-mute">·</span>
              <span>{f.durationHint}</span>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 space-y-1">
                <div className="font-semibold text-primary text-xs uppercase tracking-wide">Ventajas</div>
                {f.pros.map((p) => (
                  <div key={p} className="text-text-dim flex gap-1.5">
                    <span className="text-primary shrink-0">+</span>{p}
                  </div>
                ))}
              </div>
              <div className="bg-danger/5 border border-danger/15 rounded-xl p-3 space-y-1">
                <div className="font-semibold text-danger text-xs uppercase tracking-wide">Limitaciones</div>
                {f.cons.map((c) => (
                  <div key={c} className="text-text-dim flex gap-1.5">
                    <span className="text-danger shrink-0">−</span>{c}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pt-2">
        <Link href="/tournaments/new" className="btn-primary">
          Crear torneo →
        </Link>
      </div>
    </div>
  );
}
