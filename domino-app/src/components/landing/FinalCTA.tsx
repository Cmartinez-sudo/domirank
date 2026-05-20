"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export function FinalCTA() {
  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: EASE_OUT }}
          className="relative rounded-3xl text-center overflow-hidden"
          style={{
            background:
              "radial-gradient(80% 120% at 50% 0%, rgba(16,185,129,.18), transparent 60%), linear-gradient(135deg, rgba(16,185,129,.06), rgba(59,130,246,.04))",
            border: "1px solid rgba(16,185,129,.25)",
            padding: "3rem 1.5rem",
          }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">¿Listo para conocer tu nivel real?</h2>
          <p className="text-text-dim mt-3">Crea tu cuenta gratis en menos de un minuto.</p>
          <div className="mt-7">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center font-semibold text-black px-7 py-4 rounded-xl transition-transform active:scale-95"
              style={{
                background: "linear-gradient(135deg,#10b981,#059669)",
                boxShadow: "0 6px 28px rgba(16,185,129,.45)",
              }}
            >
              Empezar ahora <span className="ml-2">→</span>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
