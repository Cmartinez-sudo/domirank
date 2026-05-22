"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Respeta `prefers-reduced-motion` globalmente. Cuando el usuario tiene la
 * preferencia activa (iOS Low Power Mode, accessibility settings de macOS/Android,
 * o Windows reduce motion), framer-motion automáticamente desactiva todas las
 * animaciones de toda la app — sin tocar componente por componente.
 *
 * `reducedMotion="user"` significa: respeta lo que el usuario eligió en su SO.
 */
export function MotionGate({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
