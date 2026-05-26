import Link from "next/link";
import { DOMIRANK_MIN_GAMES } from "@/lib/rating";

export const metadata = {
  title: "Cómo funciona DomiRank · OpenSkill",
  description: "Cómo se calcula tu rating en DomiRank: distribución gaussiana, μ y σ, Plackett-Luce, Weng-Lin.",
};

export default function ComoFuncionaPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="text-center py-8">
        <span className="badge bg-info/15 text-info">Cómo funciona DomiRank</span>
        <h1 className="text-4xl font-extrabold tracking-tight mt-3 mb-2">
          El rating que <span className="text-primary">no es un número</span>
        </h1>
        <p className="text-text-dim max-w-xl mx-auto">
          Tu nivel en DomiRank no es un número solo (tipo Elo) sino una <strong>distribución de probabilidad</strong>.
          Mientras conectamos la versión interactiva, mira el preview que ya tiene los widgets en vivo.
        </p>
        <div className="mt-4">
          <a href="/preview.html#/como-funciona" className="btn-primary">Abrir preview interactivo</a>
        </div>
      </header>

      <Section n={1} title="Tu rating tiene dos números: μ y σ">
        <p>OpenSkill modela cada jugador con una gaussiana centrada en <code>μ</code> (mu) con anchura <code>σ</code> (sigma).</p>
        <ul className="list-disc pl-6 mt-2 space-y-1">
          <li><strong className="text-primary">μ</strong> = tu skill estimado más probable.</li>
          <li><strong className="text-info">σ</strong> = qué tan inseguro está el sistema. Empieza alto y baja con cada partida.</li>
          <li>Rating mostrado = <code>μ − 3σ</code> (el peor caso al 99.7%, conservador a propósito).</li>
        </ul>
      </Section>

      <Section n={2} title="¿Por qué no Elo?">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-mute text-xs uppercase tracking-wide">
              <th className="text-left py-2">Capacidad</th>
              <th className="text-left py-2">Elo</th>
              <th className="text-left py-2">OpenSkill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <Row k="1v1" elo="✓" os="✓" />
            <Row k="Equipos (2v2, 3v3…)" elo="✗ con parches" os="✓ nativo" />
            <Row k="Free-for-all (4 jugadores, ranking 1-4)" elo="✗" os="✓" />
            <Row k="Modela incertidumbre del rating" elo="✗" os="✓ con σ" />
            <Row k="Distingue novato (5 partidas) de veterano (500)" elo="✗" os="✓" />
            <Row k="Base bayesiana formal" elo="✗" os="✓" />
          </tbody>
        </table>
      </Section>

      <Section n={3} title="Cómo cambia tu rating tras una partida">
        <p>
          Dado N equipos con sus jugadores y su rank final, OpenSkill recalcula μ y σ para cada uno usando las
          aproximaciones analíticas de Weng-Lin sobre el modelo Plackett-Luce. Cuanto más sorprendente el resultado
          (upset), mayor el ajuste. Cuanta más certeza tenía el sistema (σ baja), menor el ajuste.
        </p>
        <p className="mt-2 text-text-dim">
          Pulsa el botón de arriba para verlo en vivo en el preview: dos jugadores empiezan iguales, clic en quién gana
          y las gaussianas se mueven con animación.
        </p>
      </Section>

      <Section n={4} title="Singles y parejas, ratings separados">
        <p>
          DomiRank guarda dos pares (μ, σ) por jugador:
          <code className="ml-1">singles_*</code> y <code>doubles_*</code>. Las habilidades para 1v1 y para parejas
          (comunicación con compañero, lectura del juego en conjunto) no son la misma cosa, y se miden por separado.
        </p>
      </Section>

      <Section n={5} title="DomiRank Global: el número único">
        <p>
          Aunque singles y parejas se miden por separado, queremos un <strong>número único</strong> que responda
          "¿quién es el mejor?". Para eso combinamos las dos distribuciones con la fusión bayesiana correcta:
          ponderar por <strong>precisión</strong> (1/σ²). Más certeza pesa más.
        </p>
        <div className="bg-surface-2 p-4 rounded font-mono text-sm text-center my-3 leading-relaxed">
          <div><span className="text-primary">μ_global</span> = (μ_s · 1/σ²_s + μ_d · 1/σ²_d) / (1/σ²_s + 1/σ²_d)</div>
          <div><span className="text-info">σ_global</span> = √(1 / (1/σ²_s + 1/σ²_d))</div>
          <div className="text-text-dim">DomiRank rating = μ_global − 3·σ_global</div>
        </div>
        <p>
          Si nunca jugaste un formato, su σ alta lo hace contribuir muy poco al global. Si juegas ambos, ambos pesan.
          Mínimo {DOMIRANK_MIN_GAMES} partidas totales para entrar al ranking global.
          Mira el preview interactivo para sliders en vivo.
        </p>
      </Section>

      <Section n={6} title="Auditable">
        <p>
          Cada fila de <code>match_players</code> guarda μ y σ antes y después de la partida. Eso permite reconstruir
          cualquier rating histórico exactamente, mostrar "ganaste +1.84 μ por esta partida" y re-calcular con otro
          modelo en el futuro sin perder la historia.
        </p>
      </Section>

      <Section n={7} title="Para nerdear">
        <p>
          · Weng & Lin (2011). <em>A Bayesian approximation method for online ranking</em>.{" "}
          <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" href="https://jmlr.org/papers/v12/weng11a.html">JMLR</a>.
          <br />· OpenSkill: <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" href="https://openskill.me/">openskill.me</a>.
          <br />· Plackett-Luce (1975): modelo probabilístico de permutaciones.
        </p>
      </Section>

      <div className="text-center pt-4">
        <Link href="/" className="text-text-dim hover:text-text">← Volver al inicio</Link>
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
      <div className="text-text-dim leading-relaxed">{children}</div>
    </section>
  );
}

function Row({ k, elo, os }: { k: string; elo: string; os: string }) {
  const cls = (v: string) => v.startsWith("✓") ? "text-primary" : "text-danger";
  return (
    <tr>
      <td className="py-2">{k}</td>
      <td className={`py-2 ${cls(elo)}`}>{elo}</td>
      <td className={`py-2 ${cls(os)}`}>{os}</td>
    </tr>
  );
}
