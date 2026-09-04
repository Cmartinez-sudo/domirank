"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

const steps = [
  {
    n: 1,
    title: "Crea tu cuenta",
    body: "Regístrate con tu correo, Google o Apple. Te preguntamos qué tan bien juegas para empezar con un rating cercano a tu nivel.",
  },
  {
    n: 2,
    title: "Agrega a tus amigos",
    body: "Búscalos por nombre de usuario y mándales solicitud. Solo puedes jugar partidas con amigos aceptados, así nadie infla rating con cuentas falsas.",
  },
  {
    n: 3,
    title: "Juega y suma puntos",
    body: "Registra cada partida en vivo desde el teléfono. Los 4 jugadores ven el marcador a tiempo real. Al cerrar la partida, los ratings se ajustan automáticamente.",
  },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end center"],
  });
  // The connector line "draws itself" as the section scrolls through view.
  const lineScaleX = useTransform(scrollYProgress, [0.15, 0.85], [0, 1]);

  return (
    <section ref={sectionRef} className="py-16 sm:py-24" id="como-funciona">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Empezar es fácil</h2>
          <p className="text-text-dim mt-3">En 3 minutos estás registrando tu primera partida.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 md:gap-8 relative">
          {/* connecting line — scroll-linked draw across the section */}
          <motion.div
            aria-hidden
            className="hidden md:block absolute top-[44px] left-[16%] right-[16%] h-px origin-left"
            style={{
              scaleX: lineScaleX,
              background: "linear-gradient(90deg, transparent, rgba(16,185,129,.35) 20%, rgba(59,130,246,.35) 80%, transparent)",
            }}
          />

          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: EASE_OUT }}
              className="text-center md:text-left relative"
            >
              <div
                className="font-extrabold mb-4 mx-auto md:mx-0 grid place-items-center w-16 h-16 rounded-2xl bg-bg border border-border"
                style={{
                  fontSize: "1.75rem",
                  backgroundImage: "linear-gradient(135deg, rgba(16,185,129,.10), rgba(59,130,246,.06))",
                }}
              >
                <span
                  style={{
                    backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  {s.n}
                </span>
              </div>
              <h3 className="font-semibold text-xl">{s.title}</h3>
              <p className="text-text-dim text-sm mt-2 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
