"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type ProfileMotionSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Anima al montar (útil para la primera sección sobre el pliegue). */
  animateOnMount?: boolean;
};

export function ProfileMotionSection({
  title,
  description,
  children,
  className = "",
  animateOnMount = false,
}: ProfileMotionSectionProps) {
  return (
    <motion.section
      suppressHydrationWarning
      initial={{ opacity: 0, y: 18 }}
      {...(animateOnMount
        ? { animate: { opacity: 1, y: 0 } }
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, margin: "-32px" },
          })}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-[2.5rem] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)] ${className}`}
    >
      <h2 className="text-[0.95rem] font-semibold tracking-tight text-[var(--text-primary)]">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-tertiary)]">{description}</p>
      ) : null}
      <div className={description ? "mt-5" : "mt-4"}>{children}</div>
    </motion.section>
  );
}

type ProfileMotionSurfaceProps = {
  children: ReactNode;
  className?: string;
  animateOnMount?: boolean;
};

/** Tarjeta con la misma estética que las secciones, sin título. */
export function ProfileMotionSurface({
  children,
  className = "",
  animateOnMount = true,
}: ProfileMotionSurfaceProps) {
  return (
    <motion.div
      suppressHydrationWarning
      initial={{ opacity: 0, y: 18 }}
      {...(animateOnMount
        ? { animate: { opacity: 1, y: 0 } }
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, margin: "-32px" },
          })}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-[2.5rem] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </motion.div>
  );
}
