"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { OnboardingRequiredModal } from "@/components/onboarding-required-modal";

type Props = {
  matchId: string;
  team: 1 | 2;
  clubName: string;
  matchDate: string;
  courtName: string;
  onboardingComplete: boolean;
};

export function JoinMatchPaymentModal({
  matchId,
  team,
  clubName,
  matchDate,
  courtName,
  onboardingComplete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    setPending(true);

    const formData = new FormData();
    formData.set("match_id", matchId);
    formData.set("team", String(team));

    const res = await fetch(`/api/partidos/${matchId}/join`, {
      method: "POST",
      body: formData,
    });

    const data = (await res.json()) as { redirect?: string };

    setPending(false);

    if (data.redirect) {
      router.push(data.redirect);
      router.refresh();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!onboardingComplete) {
            setShowOnboardingModal(true);
            return;
          }
          setOpen(true);
        }}
        className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#0461C4] shadow-md transition hover:bg-white/95 active:scale-[0.98]"
      >
        Unirse
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-[0_24px_64px_-20px_rgba(15,23,42,0.3)] dark:bg-[var(--bg-card)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Unirse al Equipo {team}</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mb-4 space-y-1 rounded-2xl bg-[var(--bg-subtle)] p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{clubName}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {matchDate} · {courtName}
              </p>
            </div>

            <p className="mb-5 text-sm text-[var(--text-secondary)]">
              El pago lo coordinás directamente con el organizador o el club.
            </p>

            <button
              type="button"
              disabled={pending}
              onClick={() => void handleConfirm()}
              className="w-full rounded-2xl bg-[#0085FC] py-3.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? "Uniéndote..." : "Confirmar y unirme"}
            </button>
          </div>
        </div>
      ) : null}
      {showOnboardingModal ? (
        <OnboardingRequiredModal onClose={() => setShowOnboardingModal(false)} />
      ) : null}
    </>
  );
}
