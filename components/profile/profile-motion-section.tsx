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
      initial={{ opacity: 0, y: 18 }}
      {...(animateOnMount
        ? { animate: { opacity: 1, y: 0 } }
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, margin: "-32px" },
          })}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-[2.5rem] border border-slate-200/60 bg-white p-6 shadow-[0_2px_24px_-8px_rgba(15,23,42,0.06)] ${className}`}
    >
      <h2 className="text-[0.95rem] font-semibold tracking-tight text-slate-900">{title}</h2>
      {description ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
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
      initial={{ opacity: 0, y: 18 }}
      {...(animateOnMount
        ? { animate: { opacity: 1, y: 0 } }
        : {
            whileInView: { opacity: 1, y: 0 },
            viewport: { once: true, margin: "-32px" },
          })}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-[2.5rem] border border-slate-200/60 bg-white p-6 shadow-[0_2px_24px_-8px_rgba(15,23,42,0.06)] ${className}`}
    >
      {children}
    </motion.div>
  );
}
