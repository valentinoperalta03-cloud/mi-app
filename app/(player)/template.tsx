"use client";

import { Capacitor } from "@capacitor/core";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const fadeTransition = {
  opacity: { duration: 0.18, ease: [0.4, 0, 0.2, 1] as const },
};

const pageVariants = {
  enter: { opacity: 0 },
  center: {
    opacity: 1,
    transitionEnd: { transform: "none" },
  },
  exit: { opacity: 0 },
};

function PlayerRouteContent({ children }: { children: ReactNode }) {
  return (
    <div className="player-route-screen min-h-full w-full bg-[var(--bg-app)]">{children}</div>
  );
}

export default function PlayerTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  const skipMotion = isNative || prefersReducedMotion;

  if (skipMotion) {
    return (
      <div className="player-route-root relative min-h-full overflow-x-hidden bg-[var(--bg-app)]">
        <PlayerRouteContent key={pathname}>{children}</PlayerRouteContent>
      </div>
    );
  }

  return (
    <div className="player-route-root relative min-h-full overflow-x-hidden bg-[var(--bg-app)]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={fadeTransition}
          className="player-route-screen min-h-full w-full bg-[var(--bg-app)]"
          style={{ transform: "none" }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
