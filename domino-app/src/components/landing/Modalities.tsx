"use client";

import { motion } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const modalities = [
  {
    flag: "🇻🇪",
    name: "Venezolano",
    spec: "Doble-seis · 100 puntos · capicúa +30",
    body: "El estilo más rápido y limpio. Ideal para mesas con tiempo limitado.",
  },
  {
    flag: "🇩🇴",
    name: "Dominicano",
    spec: "Doble-seis · 200 puntos · capicúa +30",
    body: "Más estratégico, partidas largas. El estándar en NY, Miami y la isla.",
  },
  {
    flag: "🇨🇺",
    name: "Cubano",
    spec: "Doble-nueve · 150 puntos · capicúa +30",
    body: "Set extendido de 55 fichas. Más memoria, más profundidad.",
  },
  {
    flag: "🇵🇷",
    name: "Puertorriqueño",
    spec: "Doble-seis · 200 puntos · capicúa +50",
    body: "Bonus de capicúa más generoso. Ritmo intenso.",
  },
];

export function Modalities() {
  return (
    <section className="py-16 sm:py-24 bg-bg-2/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Tu modalidad favorita, respetada</h2>
          <p className="text-text-dim mt-3 max-w-xl mx-auto">
            Cada país juega distinto. DomiRank lleva ratings separados por modalidad para que tu nivel sea fiel a cómo realmente juegas.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modalities.map((m, i) => (
            <motion.div
              key={m.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.06, ease: EASE_OUT }}
              whileHover={{ y: -3 }}
              className="card hover:border-primary/40 transition-colors"
            >
              <div className="text-4xl mb-3 select-none" aria-hidden>{m.flag}</div>
              <h3 className="font-semibold text-lg">{m.name}</h3>
              <p className="text-text-mute text-xs mt-1 font-mono">{m.spec}</p>
              <p className="text-text-dim text-sm mt-3 leading-relaxed">{m.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
