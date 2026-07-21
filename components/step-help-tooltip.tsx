"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type StepHelpTooltipProps = {
  title: string;
  children: React.ReactNode;
  label?: string;
};

export function StepHelpTooltip({ title, children, label }: StepHelpTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label ?? "Ayuda de este paso"}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0585FC]/10 text-[11px] font-bold text-[#0585FC] ring-1 ring-[#0585FC]/25 transition active:scale-90"
      >
        ?
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.3)] dark:bg-[var(--bg-card)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">{title}</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{children}</div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
