import Link from "next/link";
import { NR_THRESHOLD, SKILL_TIERS } from "@/lib/rating";

export const metadata = {
  title: "Cómo funciona el rating · DomiRank",
  description:
    "El rating de DomiRank explicado: escala 1-20, motor Elo con MoV, NR antes de 5 partidas, y confiabilidad (0-100%) calculada con volumen + recencia + atestiguado + diversidad.",
  alternates: { canonical: "/como-funciona" },
  openGraph: {
    title: "Cómo funciona el rating · DomiRank",
    description:
      "Tu rating no es solo un número: incluye un score de confiabilidad. Mira cómo se calcula.",
    type: "article",
  },
};

export default function ComoFuncionaPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <header className="text-center">
        <span className="badge bg-info/15 text-info">Cómo funciona</span>
        <h1 className="text-4xl font-extrabold tracking-tight mt-3 mb-3">
          Tu rating con <span className="text-primary">confianza medible</span>
        </h1>
        <p className="text-text-dim max-w-xl mx-auto">
          DomiRank no es solo un número. Te dice qué tan bueno eres <em>y</em> qué tan
          confiable es esa medición. Acá te explicamos cómo.
        </p>
      </header>

      <Section n={1} title="Tu rating: una escala de 1 a 20">
        <p>
          Tu DomiRank se muestra como un número decimal entre <strong>1.0</strong> (recién
          empezando) y <strong>20.0</strong> (leyenda viviente). Internamente usamos Elo
          (motor probado en ajedrez desde 1960), pero traducimos a 1-20 para que sea legible.
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SKILL_TIERS.map((t) => (
            <div
              key={t.name}
              className="rounded-md p-3 text-center"
              style={{ background: `${t.color}15`, border: `1px solid ${t.color}40` }}
            >
              <div className="font-semibold" style={{ color: t.color }}>{t.name}</div>
              <div className="font-mono text-xs text-text-dim mt-0.5">
                {t.min} – {t.max}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n={2} title={`NR: tus primeras ${NR_THRESHOLD} partidas`}>
        <p>
          Antes de tener <strong>{NR_THRESHOLD} partidas confirmadas</strong>, tu perfil
          aparece como <code className="px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-400 font-semibold text-xs">NR</code>{" "}
          (Not Rated). Esto no es un castigo: es honestidad. Con tan pocas partidas no
          podemos darte un rating en el que se pueda confiar.
        </p>
        <p className="mt-2">
          Mientras estés NR, tus partidas <strong>cuentan igual</strong> y tu Elo interno se
          calcula. Pero al mundo le mostramos "NR" en lugar de un número engañoso. Una vez
          alcances {NR_THRESHOLD} partidas, tu rating se "activa" y aparece en el leaderboard.
        </p>
      </Section>

      <Section n={3} title="Confiabilidad: 0-100%">
        <p>
          Más allá de NR, mostramos un <strong>score de confiabilidad</strong> que
          responde: <em>¿qué tan confiable es este rating?</em> No mide skill, mide
          la calidad de la evidencia. Se calcula con 4 factores:
        </p>
        <div className="mt-4 space-y-3">
          <FactorCard
            weight="35%"
            name="Volumen"
            description={`Cuántas partidas confirmadas tienes. Meta: 30. Más partidas = más certeza estadística.`}
          />
          <FactorCard
            weight="25%"
            name="Recencia"
            description="Cuántas partidas jugaste en los últimos 60 días. Meta: 10. Un rating viejo decae."
          />
          <FactorCard
            weight="25%"
            name="Atestiguado"
            description="% de tus partidas que tuvieron consenso (al menos 3 de 4 jugadores confirmaron). Castiga rating self-reported sin verificar."
          />
          <FactorCard
            weight="15%"
            name="Diversidad"
            description="Cuántos oponentes distintos enfrentaste. Meta: 15. Jugar siempre con los mismos infla artificialmente tu rating."
          />
        </div>
        <p className="mt-4 text-text-mute text-sm">
          Fórmula:{" "}
          <code className="bg-surface-2 px-2 py-0.5 rounded">
            score = 35·volumen + 25·recencia + 25·atestiguado + 15·diversidad
          </code>
        </p>
      </Section>

      <Section n={4} title="Los 4 niveles de confianza">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-mute text-xs uppercase tracking-wider border-b border-border">
              <th className="text-left py-2 font-semibold">Score</th>
              <th className="text-left py-2 font-semibold">Etiqueta</th>
              <th className="text-left py-2 font-semibold">Significa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <BucketRow
              range="0–29%"
              label="Calibrando"
              color="text-slate-300"
              meaning="El sistema aún tiene mucha incertidumbre. Sigue jugando."
            />
            <BucketRow
              range="30–59%"
              label="En desarrollo"
              color="text-amber-400"
              meaning="Rating creíble pero todavía podría moverse mucho con cada partida."
            />
            <BucketRow
              range="60–89%"
              label="Confiable"
              color="text-emerald-300"
              meaning="Rating estable. Lo puedes usar para retar oponentes parejos."
            />
            <BucketRow
              range="90–100%"
              label="Muy confiable"
              color="text-emerald-400"
              meaning="Suficiente volumen, recencia, atestiguado y diversidad. Rating de élite."
            />
          </tbody>
        </table>
      </Section>

      <Section n={5} title="DomiRank Global y los 4 ratings por modalidad">
        <p>
          Llevamos un rating <strong>separado</strong> por cada combinación
          (singles/parejas) × (doble-6/doble-9):
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-1 text-text-dim">
          <li>Singles 6-6 — el clásico 1v1 de doble-6</li>
          <li>Parejas 6-6 — el formato más jugado en Caribe</li>
          <li>Singles 9-9 — doble-9 mano a mano</li>
          <li>Parejas 9-9 — doble-9 en equipo</li>
        </ul>
        <p className="mt-3">
          Tu <strong>DomiRank Global</strong> es el promedio ponderado por partidas de los
          formatos que has jugado. Si solo juegas parejas 6-6, tu global = tu rating de
          parejas 6-6. Si juegas dos formatos, ambos pesan.
        </p>
      </Section>

      <Section n={6} title="Cada partida es auditable">
        <p>
          Guardamos tu <strong>Elo antes y después</strong> de cada partida en{" "}
          <code>match_players</code>. Eso permite:
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-1 text-text-dim">
          <li>Reconstruir cualquier rating histórico exactamente.</li>
          <li>Mostrar "ganaste +12 Elo en esta partida".</li>
          <li>Recalcular con otro modelo en el futuro sin perder historia.</li>
        </ul>
      </Section>

      <div className="text-center pt-4 space-y-3">
        <p className="text-text-mute text-sm">
          ¿Preguntas? <Link href="/faq" className="text-primary hover:underline">Preguntas frecuentes</Link> o escríbenos a{" "}
          <a href="mailto:hola@domirank.app" className="text-primary hover:underline">hola@domirank.app</a>.
        </p>
        <Link href="/" className="text-text-dim hover:text-text inline-block">
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
        <span className="inline-grid place-items-center w-8 h-8 rounded bg-primary/15 text-primary text-sm">{n}</span>
        {title}
      </h2>
      <div className="text-text leading-relaxed">{children}</div>
    </section>
  );
}

function FactorCard({ weight, name, description }: { weight: string; name: string; description: string }) {
  return (
    <div className="bg-surface-2 rounded-md p-3 flex gap-3">
      <div className="shrink-0 w-12 text-center">
        <div className="text-primary font-mono font-bold text-sm">{weight}</div>
        <div className="text-text-mute text-[10px] uppercase tracking-wider">peso</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{name}</div>
        <p className="text-text-dim text-sm mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function BucketRow({ range, label, color, meaning }: { range: string; label: string; color: string; meaning: string }) {
  return (
    <tr>
      <td className="py-2 font-mono text-text-dim w-20">{range}</td>
      <td className={`py-2 font-semibold w-32 ${color}`}>{label}</td>
      <td className="py-2 text-text-dim">{meaning}</td>
    </tr>
  );
}
