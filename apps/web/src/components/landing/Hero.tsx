"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { PhoneMockup } from "./PhoneMockup";

const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  // Background parallax — moves slower than the page, floats up as we scroll.
  const bgY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  // Phone mockup gets a subtle rotate + parallax down; feels like it's
  // being handed to you before drifting out of view.
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const phoneRotate = useTransform(scrollYProgress, [0, 1], [0, -4]);
  // Copy fades out as user scrolls past — no lingering ghost text on next section.
  const copyOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -40]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      {/* ambient gradients — parallax */}
      <motion.div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          y: bgY,
          background:
            "radial-gradient(60% 50% at 20% 10%, rgba(16,185,129,.10), transparent 70%), radial-gradient(60% 50% at 90% 30%, rgba(59,130,246,.08), transparent 70%)",
        }}
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="grid md:grid-cols-[1.05fr_.95fr] gap-10 md:gap-12 items-center">
          {/* TEXT COLUMN */}
          <motion.div className="text-center md:text-left" style={{ opacity: copyOpacity, y: copyY }}>
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
              className="flex justify-center md:justify-start mb-6"
            >
              <Image
                src="/branding/logo-vertical-tagline.svg"
                alt="DomiRank · Tu app de dominó"
                width={260}
                height={300}
                priority
                className="w-48 md:w-56 h-auto"
              />
            </motion.div>

            <motion.h1
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.55, delay: 0.08, ease: EASE_OUT }}
              className="font-extrabold tracking-tight leading-[1.05]"
              style={{ fontSize: "clamp(2.4rem, 5.5vw, 3.6rem)" }}
            >
              <span
                style={{
                  backgroundImage: "linear-gradient(135deg,#10b981,#3b82f6)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Tu nivel real de dominó
              </span>
              <span>, oficial.</span>
            </motion.h1>

            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.15, ease: EASE_OUT }}
              className="text-text-dim mt-5 text-base sm:text-lg max-w-xl mx-auto md:mx-0"
            >
              Lleva el marcador de cada partida, sigue tu rating contra rivales reales y arma torneos con tus amigos. Rankings respetando la regla de conteo que juega tu mesa: Cuenta rival o Cuenta de mesa.
            </motion.p>

            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3, ease: EASE_OUT }}
              className="mt-7 flex flex-col sm:flex-row gap-3 items-center justify-center md:justify-start"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} transition={{ type: "spring", damping: 18, stiffness: 300 }}>
                <Link
                  href="/signup"
                  className="inline-flex items-center justify-center font-semibold text-white px-7 py-4 rounded-xl text-base sm:text-lg"
                  style={{
                    background: "linear-gradient(135deg,#10b981,#059669)",
                    boxShadow: "0 4px 24px rgba(16,185,129,.4)",
                  }}
                >
                  Instalar la PWA / Empezar a jugar
                </Link>
              </motion.div>
              <Link
                href="/login"
                className="text-text-dim hover:text-text underline underline-offset-4 text-sm px-2 py-2 transition-colors"
              >
                Ya tengo cuenta
              </Link>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55 }}
              className="text-text-mute text-xs mt-5"
            >
              Gratis · Sin tarjeta · Funciona como app en tu teléfono
            </motion.p>
          </motion.div>

          {/* PHONE MOCKUP — parallax down + slight rotate on scroll */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE_OUT }}
            style={{ y: phoneY, rotate: phoneRotate }}
            className="relative"
          >
            <PhoneMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
