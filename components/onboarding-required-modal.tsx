"use client";

import { X } from "lucide-react";
import Link from "next/link";

export function OnboardingRequiredModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.3)] dark:bg-[var(--bg-card)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Completá tu perfil primero</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          Para unirte o crear un partido necesitás completar tu perfil. Solo toma un minuto.
        </p>
        <div className="mt-5 space-y-2">
          <Link
            href="/onboarding"
            className="block w-full rounded-2xl bg-[#0585FC] py-3.5 text-center text-sm font-semibold text-white transition active:scale-[0.98]"
          >
            Completar perfil
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="block w-full rounded-2xl py-3 text-center text-sm font-semibold text-slate-500"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
