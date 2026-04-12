"use client";

import { useEffect } from "react";
import type { LegalSection } from "@/lib/legal-documents";
import {
  legalPrivacySections,
  legalPrivacyTitle,
  legalTermsSections,
  legalTermsTitle,
} from "@/lib/legal-documents";

function SectionBlock({ section }: { section: LegalSection }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight text-slate-700">{section.title}</h3>
      {section.paragraphs.map((p, i) =>
        p ? (
          <p key={i} className="text-sm leading-relaxed text-slate-600">
            {p}
          </p>
        ) : null,
      )}
      {section.bullets?.length ? (
        <ul className="list-disc space-y-2 pl-4 text-sm leading-relaxed text-slate-600">
          {section.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}
      {section.subsections?.map((sub, i) => (
        <div key={i} className="space-y-1.5">
          <h4 className="text-xs font-semibold tracking-wide text-slate-500">{sub.title}</h4>
          <p className="text-sm leading-relaxed text-slate-600">{sub.text}</p>
        </div>
      ))}
    </section>
  );
}

export type LegalDocKind = "terms" | "privacy";

export function LegalDocumentSheet({
  open,
  onClose,
}: {
  open: LegalDocKind | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const title = open === "terms" ? legalTermsTitle : legalPrivacyTitle;
  const sections = open === "terms" ? legalTermsSections : legalPrivacySections;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-sheet-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(88dvh,720px)] w-full max-w-lg flex-col rounded-t-[1.75rem] border border-slate-200/90 bg-slate-50 shadow-[0_-8px_40px_rgba(15,23,42,0.12)] sm:max-h-[min(90vh,720px)] sm:rounded-2xl sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4">
          <h2 id="legal-sheet-title" className="pr-2 text-base font-semibold leading-snug text-slate-700">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
          >
            Cerrar
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="space-y-8">
            {sections.map((s, i) => (
              <SectionBlock key={i} section={s} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
