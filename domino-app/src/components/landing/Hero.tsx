"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PhoneMockup } from "./PhoneMockup";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient gradients */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 10%, rgba(16,185,129,.10), transparent 70%), radial-gradient(60% 50% at 90% 30%, rgba(59,130,246,.08), transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid md:grid-cols-[1.05fr_.95fr] gap-10 md:gap-12 items-center">
          {/* TEXT COLUMN */}
          <div className="text-center md:text-left">
            <motion.h1
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
              className="font-extrabold tracking-tight leading-[1.05]"
              style={{ fontSize: "clamp(2.4rem, 5.5vw, 3.6rem)" }}
            >
              <span>DomiRank — </span>
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                tu nivel real de dominó
              </span>
              <span>, oficial.</span>
            </motion.h1>

            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15, ease: EASE_OUT }}
              className="text-text-dim mt-5 text-base sm:text-lg max-w-xl mx-auto md:mx-0"
            >
              Lleva el marcador de cada partida, sigue tu rating contra rivales reales y arma torneos con tus amigos. La primera plataforma con rankings respetando las modalidades de cada país: Venezolano, Dominicano, Cubano y Puertorriqueño.
            </motion.p>

            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }}
              className="mt-7 flex flex-col sm:flex-row gap-3 justify-center md:justify-start"
            >
              <Link
                href="/signup"
                className="inline-flex items-center justify-center font-semibold text-black px-6 py-3.5 rounded-xl transition-transform active:scale-95"
                style={{
                  background: "linear-gradient(135deg,#10b981,#059669)",
                  boxShadow: "0 4px 24px rgba(16,185,129,.4)",
                }}
              >
                Crear cuenta gratis
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center font-semibold px-6 py-3.5 rounded-xl border border-border hover:border-border-strong text-text-dim hover:text-text transition-colors"
              >
                Iniciar sesión
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="text-text-mute text-xs mt-5"
            >
              Sin tarjeta de crédito · Acceso completo gratuito
            </motion.p>
          </div>

          {/* PHONE MOCKUP */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE_OUT }}
            className="relative"
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
