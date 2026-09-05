import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Preguntas frecuentes",
  description:
    "Qué es DomiRank, cómo funciona el ranking, qué son los Grupos, privacidad de los datos y cómo eliminar tu cuenta. Todas las respuestas en un solo lugar.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Preguntas frecuentes · DomiRank",
    description:
      "Qué es DomiRank, cómo funciona el ranking, qué son los Grupos y cómo cuidamos tu privacidad.",
    url: "/faq",
    type: "website",
  },
};

type FaqItem = { q: string; a: React.ReactNode; plainA: string };

const faqs: FaqItem[] = [
  {
    q: "¿Qué es DomiRank?",
    a: (
      <>
        DomiRank es una plataforma de ranking de dominó que respeta la regla
        de conteo con la que juegas —Cuenta rival o Cuenta de mesa— y guarda
        tus partidas para calcular tu nivel real con un motor de rating tipo
        Elo. Es una PWA: se instala en tu teléfono y funciona como una app
        nativa.
      </>
    ),
    plainA:
      "DomiRank es una plataforma de ranking de dominó que respeta la regla de conteo con la que juegas (Cuenta rival o Cuenta de mesa). Registras tus partidas reales con amigos y el sistema calcula tu nivel con un motor de rating tipo Elo. Es una PWA que se instala en tu teléfono.",
  },
  {
    q: "¿Cómo se juega en DomiRank?",
    a: (
      <>
        No jugamos dominó dentro de la app: DomiRank es un tracker. Tú juegas
        tu partida en la mesa como siempre y al terminar la registras en la
        app (parejas o individual, según la modalidad). Los 4 jugadores
        confirman el resultado y el rating se actualiza.
      </>
    ),
    plainA:
      "DomiRank no es un juego dentro de la app: es un tracker. Juegas la partida en la mesa como siempre y al terminar la registras. Los 4 jugadores confirman el resultado y se actualiza el rating.",
  },
  {
    q: "¿Cómo funciona el ranking y el Elo?",
    a: (
      <>
        Usamos un motor de rating tipo Elo (OpenSkill — Plackett-Luce /
        Weng-Lin) que asigna a cada jugador dos valores: μ (habilidad
        estimada) y σ (incertidumbre). Cada partida ajusta ambos según el
        resultado y la fortaleza de los rivales. Al principio tu σ es
        grande y tu rating se mueve rápido; con más partidas se estabiliza.
        Ver{" "}
        <Link href="/como-funciona" className="text-primary underline">
          Cómo funciona
        </Link>{" "}
        para el detalle técnico.
      </>
    ),
    plainA:
      "Usamos un motor tipo Elo (OpenSkill / Weng-Lin) que asigna a cada jugador un μ (habilidad) y σ (incertidumbre). Cada partida ajusta ambos según el resultado y la fortaleza de los rivales.",
  },
  {
    q: "¿Qué son los Grupos?",
    a: (
      <>
        Los Grupos son comunidades cerradas de jugadores que compiten
        entre sí — por ejemplo, el grupo de tu casa, tu club o tu oficina.
        Dentro de un Grupo ves un ranking privado, historial de partidas y
        estadísticas del grupo. Un usuario puede pertenecer a varios grupos.
      </>
    ),
    plainA:
      "Los Grupos son comunidades cerradas de jugadores (tu casa, tu club, tu oficina). Dentro de un Grupo ves un ranking privado, historial de partidas y estadísticas. Un usuario puede pertenecer a varios grupos.",
  },
  {
    q: "¿Cómo creo o me uno a un grupo?",
    a: (
      <>
        Desde tu dashboard, entra a "Grupos" y elige "Crear grupo" (te vuelves
        admin) o pega el enlace de invitación que te compartió otro miembro.
        Los admins aprueban las solicitudes de entrada.
      </>
    ),
    plainA:
      "Desde tu dashboard, entra a 'Grupos' y elige 'Crear grupo' o pega el enlace de invitación que te compartió otro miembro. Los admins aprueban solicitudes.",
  },
  {
    q: "¿DomiRank es gratis?",
    a: (
      <>
        Sí. Crear cuenta, registrar partidas, ver tu rating y armar torneos
        privados con amigos es gratis. Próximamente habrá un plan Pro
        opcional con estadísticas avanzadas; el producto base seguirá
        siendo gratis.
      </>
    ),
    plainA:
      "Sí. Crear cuenta, registrar partidas, ver tu rating y armar torneos privados con amigos es gratis. El producto base seguirá siendo gratis.",
  },
  {
    q: "¿Funciona en iPhone y Android?",
    a: (
      <>
        Sí. Es una PWA (Progressive Web App) que se ve y funciona como app
        nativa en cualquier teléfono. Ábrela en Safari (iOS) o Chrome
        (Android) y elige "Agregar a la pantalla de inicio".
      </>
    ),
    plainA:
      "Sí. Es una PWA que se ve y funciona como app nativa en cualquier teléfono. Ábrela en Safari (iOS) o Chrome (Android) y elige 'Agregar a la pantalla de inicio'.",
  },
  {
    q: "¿Qué datos guardan y cómo cuidan mi privacidad?",
    a: (
      <>
        Guardamos tu correo, nombre, fecha de nacimiento, país, avatar y el
        historial de partidas. Tu username, avatar y rating son públicos
        dentro de DomiRank; tu correo y fecha de nacimiento son privados.
        No vendemos tu información a terceros. Ver{" "}
        <Link href="/privacy" className="text-primary underline">
          Política de privacidad
        </Link>{" "}
        para el detalle completo.
      </>
    ),
    plainA:
      "Guardamos tu correo, nombre, fecha de nacimiento, país, avatar e historial de partidas. Tu username, avatar y rating son públicos; tu correo y fecha de nacimiento son privados. No vendemos tu información a terceros.",
  },
  {
    q: "¿Cómo elimino mi cuenta?",
    a: (
      <>
        Escríbenos a{" "}
        <a href="mailto:hola@domirank.app" className="text-primary underline">
          hola@domirank.app
        </a>{" "}
        desde el correo asociado a la cuenta. Procesamos la solicitud en
        hasta 30 días (según el RGPD y ley de protección de datos local) y
        eliminamos tu perfil, historial y datos personales.
      </>
    ),
    plainA:
      "Escríbenos a hola@domirank.app desde el correo asociado a la cuenta. Procesamos la solicitud en hasta 30 días (RGPD y ley local) y eliminamos tu perfil, historial y datos personales.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.plainA,
      },
    })),
  };

  return (
    <article className="max-w-2xl mx-auto py-6 space-y-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header>
        <h1 className="text-3xl font-bold tracking-tight">Preguntas frecuentes</h1>
        <p className="text-text-mute text-sm mt-1">
          Todo lo que necesitas saber sobre DomiRank.
        </p>
      </header>

      <div className="space-y-3">
        {faqs.map((f, i) => (
          <details
            key={i}
            className="group rounded-2xl border border-border bg-surface-2 open:bg-surface open:border-primary/40 transition-colors"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 px-5 py-4 font-medium select-none">
              <span>{f.q}</span>
              <svg
                aria-hidden="true"
                className="shrink-0 text-text-mute group-open:rotate-45 group-open:text-primary transition-transform duration-200"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </summary>
            <div className="px-5 pb-5 text-text-dim text-sm leading-relaxed">
              {f.a}
            </div>
          </details>
        ))}
      </div>

      <footer className="pt-4 mt-4 border-t border-border text-sm text-text-mute">
        ¿No encontraste tu respuesta? Escríbenos a{" "}
        <a href="mailto:hola@domirank.app" className="text-primary underline">
          hola@domirank.app
        </a>
        .
      </footer>
    </article>
  );
}
