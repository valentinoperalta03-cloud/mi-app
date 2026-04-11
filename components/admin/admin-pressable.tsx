"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Subtle scale on tap for list rows and blocks (client-only). */
export function AdminPressableSurface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 520, damping: 32 }}
    >
      {children}
    </motion.div>
  );
}
