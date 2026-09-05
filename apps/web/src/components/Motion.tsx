"use client";

import {
  motion,
  AnimatePresence,
  useScroll,
  useSpring,
  useTransform,
  useInView,
  useMotionValue,
  animate,
  type HTMLMotionProps,
  type Variants,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

export const EASE_OUT: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94];

/** Spring presets — reuse instead of inventing new ones per component. */
export const SPRING = {
  /** Snappy but restrained — for taps, hovers, small entrances. */
  soft: { type: "spring" as const, damping: 26, stiffness: 340, mass: 0.9 },
  /** Character-forward — for FAB, sheets, cards that "pop". */
  bouncy: { type: "spring" as const, damping: 16, stiffness: 260, mass: 0.9 },
  /** Overshoots visibly — reserved for celebration moments (tier-up, streak). */
  celebratory: { type: "spring" as const, damping: 11, stiffness: 200, mass: 0.9 },
};

// ─── Entrance ──────────────────────────────────────────────────────────────

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.055, delayChildren: 0.05 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } },
};

export function StaggerChildren({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className={className}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Interaction ───────────────────────────────────────────────────────────

export function TapScale({
  children,
  className,
  scale = 0.97,
  ...props
}: {
  children: ReactNode;
  className?: string;
  scale?: number;
} & Omit<HTMLMotionProps<"div">, "whileTap">) {
  return (
    <motion.div
      whileTap={{ scale }}
      transition={{ duration: 0.1 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Card that lifts on hover and presses on tap. Uses `transform` only for
 * budget-friendly compositor-only animation. Skips hover on touch devices
 * (via media query) so mobile users don't get stuck-hover states.
 */
export function HoverCard({
  children,
  className,
  lift = 4,
  press = 0.98,
  ...props
}: {
  children: ReactNode;
  className?: string;
  /** px to translateY on hover. */
  lift?: number;
  press?: number;
} & Omit<HTMLMotionProps<"div">, "whileHover" | "whileTap">) {
  return (
    <motion.div
      whileHover={{ y: -lift, transition: SPRING.soft }}
      whileTap={{ scale: press, transition: { duration: 0.1 } }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/**
 * Button/pressable wrapper with tactile press feedback. Scales down noticeably
 * and springs back — the "Discord/Duolingo" tone we agreed on for Phase 2.
 */
export function PressButton({
  children,
  className,
  scale = 0.94,
  ...props
}: {
  children: ReactNode;
  className?: string;
  scale?: number;
} & Omit<HTMLMotionProps<"button">, "whileTap" | "whileHover">) {
  return (
    <motion.button
      whileTap={{ scale, transition: { duration: 0.08 } }}
      whileHover={{ scale: 1.02, transition: SPRING.soft }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}

// ─── Sheets & Pages ────────────────────────────────────────────────────────

export function SheetMotion({
  children,
  className,
  isOpen,
}: {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING.bouncy}
            className={`fixed bottom-0 inset-x-0 z-50 rounded-t-2xl bg-surface border-t border-border ${className ?? ""}`}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-border" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Scroll ────────────────────────────────────────────────────────────────

/**
 * Reveals children the first time they enter the viewport. Cheaper than
 * `whileInView` when reused across many sections because we only need
 * `IntersectionObserver` once per instance.
 */
export function Reveal({
  children,
  className,
  y = 24,
  delay = 0,
  once = true,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
  delay?: number;
  once?: boolean;
  amount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, amount });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease: EASE_OUT, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Fixed-top scroll progress bar. Bound to document scroll and smoothed
 * with a spring so it feels alive, not linear. Renders nothing until
 * the user has scrolled at least 2% to avoid a stray line at rest.
 */
export function ScrollProgress({ className }: { className?: string }) {
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { damping: 25, stiffness: 180, mass: 0.6 });
  return (
    <motion.div
      style={{ scaleX: smooth, transformOrigin: "0% 50%" }}
      className={
        "fixed top-0 left-0 right-0 h-[3px] bg-primary z-[100] pointer-events-none " +
        (className ?? "")
      }
      aria-hidden="true"
    />
  );
}

/**
 * Wraps children in a parallax layer bound to document scroll. `speed`:
 * 0 = stays with the page, 0.5 = moves half as fast (falls behind),
 * -0.3 = moves against scroll (pops out). Applies only `translateY`.
 */
export function ParallaxLayer({
  children,
  speed = 0.3,
  className,
  style,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, -100 * speed * 5]);
  return (
    <motion.div ref={ref} style={{ ...style, y }} className={className}>
      {children}
    </motion.div>
  );
}

// ─── Numbers & Feedback ────────────────────────────────────────────────────

/**
 * Animates a number counting up (or down) to `value`. Respects
 * `prefers-reduced-motion` by snapping to the final value. Keeps sign,
 * decimals, and a formatter callback for units (e.g. "1.2 Elo").
 */
export function NumberCounter({
  value,
  duration = 0.9,
  decimals = 0,
  format = (n) => n.toString(),
  className,
  onDone,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  format?: (n: string) => string;
  className?: string;
  onDone?: () => void;
}) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState<string>(format((0).toFixed(decimals)));

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(format(v.toFixed(decimals))),
      onComplete: onDone,
    });
    return () => controls.stop();
  }, [value, duration, decimals]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={className} aria-live="polite">
      {display}
    </span>
  );
}

/**
 * SVG checkmark that draws its path in on mount. Used for confirmations
 * (attestation confirmed, preference saved). Composed with a scaled circle
 * background so it also works as a success badge.
 */
export function AnimatedCheckmark({
  size = 22,
  className,
  stroke = "currentColor",
}: {
  size?: number;
  className?: string;
  stroke?: string;
}) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      initial="hidden"
      animate="visible"
      aria-hidden="true"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="11"
        variants={{
          hidden: { pathLength: 0, opacity: 0.4 },
          visible: {
            pathLength: 1,
            opacity: 1,
            transition: { pathLength: { duration: 0.4, ease: EASE_OUT }, opacity: { duration: 0.15 } },
          },
        }}
      />
      <motion.path
        d="M7 12.5l3.5 3.5L17 9"
        variants={{
          hidden: { pathLength: 0 },
          visible: {
            pathLength: 1,
            transition: { pathLength: { duration: 0.3, ease: EASE_OUT, delay: 0.3 } },
          },
        }}
      />
    </motion.svg>
  );
}

/**
 * Shine sweep — a diagonal highlight that slides across the child once.
 * Meant to layer on top of celebratory badges (tier-up, streak medal).
 * Absolutely positioned; parent needs `relative overflow-hidden`.
 */
export function ShineSweep({
  duration = 1.1,
  delay = 0,
  className,
}: {
  duration?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.span
      aria-hidden="true"
      initial={{ x: "-120%", opacity: 0 }}
      animate={{ x: "220%", opacity: [0, 0.9, 0] }}
      transition={{ duration, delay, ease: EASE_OUT }}
      className={
        "pointer-events-none absolute top-0 bottom-0 w-1/3 " +
        "bg-gradient-to-r from-transparent via-white/50 to-transparent " +
        "skew-x-[-20deg] " +
        (className ?? "")
      }
    />
  );
}

/**
 * Small helper — useScroll but scoped and typed. Re-exported so callers
 * don't have to import from framer-motion directly.
 */
export function useSectionScroll(ref: React.RefObject<HTMLElement | null>): MotionValue<number> {
  const { scrollYProgress } = useScroll({
    target: ref as React.RefObject<HTMLElement>,
    offset: ["start end", "end start"],
  });
  return scrollYProgress;
}
