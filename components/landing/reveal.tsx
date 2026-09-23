"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
};

/** Wrapper de fade-in + slide-up al entrar en viewport. Respeta prefers-reduced-motion. */
export default function Reveal({ delay = 0, y = 20, children, ...props }: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.5, delay: reduceMotion ? 0 : delay, ease: "easeOut" }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
