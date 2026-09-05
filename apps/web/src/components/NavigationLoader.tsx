"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

export function NavigationLoader() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setVisible(true);
    setProgress(0);

    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 85) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 85;
        }
        return p + Math.random() * 18;
      });
    }, 80);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    setProgress(100);
    const t = setTimeout(() => setVisible(false), 350);
    return () => clearTimeout(t);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {visible && progress < 100 && (
        <motion.div
          key="nav-loader"
          className="fixed top-0 inset-x-0 z-[100] h-[2px] pointer-events-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
        >
          <motion.div
            className="h-full bg-primary rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ ease: "easeOut", duration: 0.15 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
