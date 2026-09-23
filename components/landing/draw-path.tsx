"use client";

import { motion, useReducedMotion, type SVGMotionProps } from "framer-motion";

type DrawPathProps = SVGMotionProps<SVGPathElement> & { delay?: number };

/** Línea SVG que se "dibuja" al entrar en viewport. Usada para conectar nodos/etapas. */
export default function DrawPath({ delay = 0, ...props }: DrawPathProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.path
      initial={reduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.9, delay: reduceMotion ? 0 : delay, ease: "easeInOut" }}
      {...props}
    />
  );
}
