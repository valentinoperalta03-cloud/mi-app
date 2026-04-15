"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type MotionPageProps = {
  children: ReactNode;
  className?: string;
};

export default function MotionPage({ children, className }: MotionPageProps) {
  return (
    <motion.main
      suppressHydrationWarning
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.main>
  );
}

