"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * layoutId compartido para transición suave entre rutas admin; key=pathname
 * fuerza re-entrada sin AnimatePresence (evita huecos con RSC streaming).
 */
export default function AdminRouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      layoutId="admin-page-content"
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        opacity: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
        y: { type: "spring", stiffness: 460, damping: 38, mass: 0.82 },
        filter: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
        layout: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
      }}
    >
      {children}
    </motion.div>
  );
}
