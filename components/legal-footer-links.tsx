"use client";

import { useState } from "react";
import { LegalDocumentSheet, type LegalDocKind } from "@/components/legal-document-sheet";

export function LegalFooterLinks({
  variant,
  className = "",
}: {
  variant: "login" | "profile";
  className?: string;
}) {
  const [open, setOpen] = useState<LegalDocKind | null>(null);

  const wrap =
    variant === "login"
      ? "text-center text-xs leading-relaxed text-slate-400"
      : "text-center text-sm leading-relaxed text-slate-500";

  const link =
    variant === "login"
      ? "text-slate-400 underline decoration-slate-300/60 underline-offset-[3px] transition-colors hover:text-slate-500 hover:decoration-slate-400/80"
      : "text-slate-500 underline decoration-slate-300/70 underline-offset-[3px] transition-colors hover:text-slate-600 hover:decoration-slate-400/80";

  return (
    <>
      <p className={`${wrap} ${className}`.trim()}>
        <span className="font-normal">Legal: </span>
        <button type="button" className={`${link} bg-transparent p-0 font-medium`} onClick={() => setOpen("terms")}>
          Términos de Uso
        </button>
        <span className="font-normal"> y </span>
        <button type="button" className={`${link} bg-transparent p-0 font-medium`} onClick={() => setOpen("privacy")}>
          Política de Privacidad
        </button>
      </p>
      <LegalDocumentSheet open={open} onClose={() => setOpen(null)} />
    </>
  );
}
