"use client";

import { motion } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const ICON = {
  trophy: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  ),
  flag: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22V4" />
      <path d="M4 4h14l-2 4 2 4H4" />
    </svg>
  ),
  users: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  medal: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 18 2 12 11Z" />
      <circle cx="12" cy="16" r="6" />
      <path d="M12 13v6" />
      <path d="M9.5 16.5h5" />
    </svg>
  ),
};

const features = [
  {
    icon: ICON.trophy,
    title: "Ranking profesional",
    body: "Tu rating sube cuando ganas a rivales fuertes y se ajusta a tu nivel real. Sin trampas, sin inflación, sin estimaciones a ojo.",
  },
  {
    icon: ICON.flag,
    title: "Modalidades de cada país",
    body: "Soporte completo para dominó Venezolano, Dominicano, Cubano y Puertorriqueño. Cada uno con sus reglas, sus puntos y su bonus de capicúa.",
  },
  {
    icon: ICON.users,
    title: "Juega con tu gente",
    body: "Invita a tus amigos, búscalos por usuario, mantén historial conjunto y mira partidas en vivo desde tu teléfono mientras juegan los demás.",
  },
  {
    icon: ICON.medal,
    title: "Torneos a tu medida",
    body: "Crea torneos privados con tu grupo o públicos para tu comunidad. Suizo, eliminación, round robin, liga por puntos — el formato que prefieras.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.45, ease: EASE_OUT } },
};

export function Features() {
  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Más que un marcador</h2>
          <p className="text-text-dim mt-3 max-w-xl mx-auto">
            DomiRank no solo cuenta puntos. Te dice exactamente qué tan bueno eres y contra quién.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={item}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="card group hover:border-primary/40 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl grid place-items-center text-primary mb-4"
                style={{ background: "rgba(16,185,129,.10)", border: "1px solid rgba(16,185,129,.25)" }}
              >
                {f.icon}
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-text-dim text-sm mt-2 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
