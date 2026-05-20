"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const faqs: { q: string; a: string }[] = [
  {
    q: "¿DomiRank es gratis?",
    a: "Sí. Crear cuenta, registrar partidas, ver tu rating y armar torneos privados con amigos es completamente gratis. Próximamente lanzaremos un plan Pro opcional con estadísticas avanzadas, pero el producto base seguirá siendo gratis para siempre.",
  },
  {
    q: "¿Necesito que todos mis amigos tengan cuenta?",
    a: "Sí, todos los jugadores de una partida deben tener cuenta. Es la única forma de que el rating refleje resultados reales.",
  },
  {
    q: "¿Puedo jugar diferentes modalidades?",
    a: "Por supuesto. Cada partida elige su modalidad al iniciarla y los ratings se calculan por separado por formato de juego.",
  },
  {
    q: "¿Qué pasa si registramos mal una partida?",
    a: "Cuando termina una partida, los 4 jugadores deben confirmar el resultado. Si alguien lo disputa, el creador puede corregirla antes de aplicar el rating.",
  },
  {
    q: "¿Puedo crear torneos con personas que no son mis amigos?",
    a: "Los participantes de torneos privados son tus amigos. Para torneos públicos cualquier usuario registrado puede unirse.",
  },
  {
    q: "¿Funciona en iPhone y Android?",
    a: "Sí, es una app web que se ve y funciona como nativa en cualquier teléfono. Puedes agregarla a tu pantalla de inicio desde el navegador.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="py-16 sm:py-24" id="faq">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Preguntas frecuentes</h2>
        </motion.div>

        <div className="space-y-2">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className={`rounded-2xl border transition-colors overflow-hidden ${
                  isOpen ? "border-primary/40 bg-surface" : "border-border bg-surface-2"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
                  aria-expanded={isOpen}
                >
                  <span className="font-medium">{f.q}</span>
                  <span
                    className={`shrink-0 text-text-mute transition-transform duration-300 ${
                      isOpen ? "rotate-45 text-primary" : ""
                    }`}
                    aria-hidden
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 text-text-dim text-sm leading-relaxed">
                        {f.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
