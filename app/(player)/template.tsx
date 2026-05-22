"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";

const TAB_ROOT_ORDER: Record<string, number> = {
  "/home": 0,
  "/comunidad": 1,
  "/perfil": 2,
};

function getRouteScore(pathname: string): number {
  if (pathname === "/home" || pathname.startsWith("/home/")) return TAB_ROOT_ORDER["/home"];
  if (pathname.startsWith("/comunidad")) return TAB_ROOT_ORDER["/comunidad"];
  if (pathname.startsWith("/perfil")) return TAB_ROOT_ORDER["/perfil"];
  return pathname.split("/").filter(Boolean).length * 10;
}

function getNavigationDirection(previous: string, next: string): number {
  if (previous === next) return 1;

  const prevScore = getRouteScore(previous);
  const nextScore = getRouteScore(next);

  if (prevScore !== nextScore) {
    return nextScore > prevScore ? 1 : -1;
  }

  const prevDepth = previous.split("/").filter(Boolean).length;
  const nextDepth = next.split("/").filter(Boolean).length;
  return nextDepth >= prevDepth ? 1 : -1;
}

const slideTransition = {
  x: { type: "spring" as const, stiffness: 420, damping: 38, mass: 0.85 },
  opacity: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const },
};

const pageVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-28%",
    opacity: 1,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-28%" : "100%",
    opacity: 1,
  }),
};

export default function PlayerTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);
  const directionRef = useRef(1);

  if (previousPathnameRef.current !== pathname) {
    directionRef.current = getNavigationDirection(previousPathnameRef.current, pathname);
    previousPathnameRef.current = pathname;
  }

  const direction = directionRef.current;

  return (
    <div className="player-route-root relative min-h-full overflow-x-hidden bg-[var(--bg-app)]">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={pathname}
          custom={direction}
          variants={pageVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
          className="player-route-screen min-h-full w-full bg-[var(--bg-app)]"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
