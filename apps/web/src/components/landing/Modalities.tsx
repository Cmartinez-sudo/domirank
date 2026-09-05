"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { COUNT_RULES, PRESET_ORDER, PRESETS } from "@/lib/modalidades";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

/**
 * Landing "Modalidades" — 2 cards grandes de count_rule con los presets
 * ofrecidos por regla como bullets (Pregunta 13A del refactor).
 */
export function Modalities() {
  const rules = ["rival", "mesa"] as const;

  return (
    <section className="py-16 sm:py-24 bg-bg-2/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Dos formas de contar, tu rating fiel
          </h2>
          <p className="text-text-dim mt-3 max-w-xl mx-auto">
            Cada mano se cierra sumando fichas de una manera distinta.
            DomiRank respeta la regla que juega tu mesa.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((code, i) => {
            const rule = COUNT_RULES[code];
            const presets = PRESET_ORDER.map((id) => PRESETS[id]).filter(
              (p) => p.countRule === code,
            );
            return (
              <motion.div
                key={code}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.08, ease: EASE_OUT }}
                whileHover={{ y: -3 }}
                className="card hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Image
                    src={rule.icon}
                    alt=""
                    width={56}
                    height={56}
                    aria-hidden="true"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-xl">{rule.name}</h3>
                    <p className="text-text-mute text-xs mt-0.5">{rule.subtitle}</p>
                  </div>
                </div>
                <p className="text-text-dim text-sm mt-3 leading-relaxed">
                  {rule.blurb}
                </p>
                {presets.length > 0 && (
                  <ul className="mt-4 space-y-1.5 text-xs text-text-mute font-mono">
                    {presets.map((p) => (
                      <li key={p.id} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                        <span>
                          {p.title} · {p.set === "d9" ? "Doble-9" : "Doble-6"} ·{" "}
                          {p.target} pts · Capicúa +{p.capicua}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
