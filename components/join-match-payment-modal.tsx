"use client";

import { useState } from "react";
import { ArrowRightLeft, Banknote, CreditCard, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { OnboardingRequiredModal } from "@/components/onboarding-required-modal";
import { nativeOpenUrl } from "@/lib/native-open";

type PaymentMethod = "mercadopago" | "cash" | "transfer";

type Props = {
  matchId: string;
  team: 1 | 2;
  clubName: string;
  matchDate: string;
  courtName: string;
  pricePerPlayer: number;
  clubHasMp: boolean;
  clubAcceptsCash: boolean;
  clubAcceptsTransfer: boolean;
  bankAlias: string | null;
  bankCbu: string | null;
  clubWhatsapp: string | null;
  onboardingComplete: boolean;
};

export function JoinMatchPaymentModal({
  matchId,
  team,
  clubName,
  matchDate,
  courtName,
  pricePerPlayer,
  clubHasMp,
  clubAcceptsCash,
  clubAcceptsTransfer,
  bankAlias,
  bankCbu,
  clubWhatsapp,
  onboardingComplete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    if (!selectedMethod) return;
    setPending(true);

    const formData = new FormData();
    formData.set("match_id", matchId);
    formData.set("team", String(team));
    formData.set("payment_method", selectedMethod);
    formData.set("level_override", "false");

    const res = await fetch(`/api/partidos/${matchId}/join`, {
      method: "POST",
      body: formData,
    });

    const data = (await res.json()) as { redirect?: string; error?: string };

    setPending(false);

    if (data.redirect) {
      if (data.redirect.startsWith("http")) {
        await nativeOpenUrl(data.redirect);
      } else {
        router.push(data.redirect);
        router.refresh();
      }
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
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unirse al Equipo {team}</h3>
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
              <p className="mt-2 text-2xl font-bold text-[#0461C4]">${pricePerPlayer.toLocaleString("es-AR")}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Tu parte (1/4 del total)</p>
            </div>

            <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">¿Cómo querés pagar?</p>
            <div className="space-y-2">
              {clubHasMp ? (
                <button
                  type="button"
                  onClick={() => setSelectedMethod("mercadopago")}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 transition ${
                    selectedMethod === "mercadopago"
                      ? "border-[#0585FC] bg-[#0585FC]/5"
                      : "border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-card)]"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                    <CreditCard size={20} className="text-[#0585FC]" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Mercado Pago</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Pagá online ahora con tarjeta o saldo MP</p>
                  </div>
                  {selectedMethod === "mercadopago" ? <span className="ml-auto text-[#0585FC]">✓</span> : null}
                </button>
              ) : null}

              {clubAcceptsTransfer ? (
                <button
                  type="button"
                  onClick={() => setSelectedMethod("transfer")}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 transition ${
                    selectedMethod === "transfer"
                      ? "border-[#0585FC] bg-[#0585FC]/5"
                      : "border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-card)]"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                    <ArrowRightLeft size={20} className="text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Transferencia</p>
                    <p className="text-xs text-[var(--text-tertiary)]">
                      {bankAlias ? `Alias: ${bankAlias}` : bankCbu ? `CBU: ${bankCbu}` : "Transferí antes de ir al club"}
                    </p>
                    {selectedMethod === "transfer" ? (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        Guardá el comprobante para mostrarlo al ingresar. Si no transferís antes, podés abonar en el
                        mostrador del club.
                        {clubWhatsapp ? " Después vas a poder confirmar la transferencia por WhatsApp." : ""}
                      </p>
                    ) : null}
                  </div>
                  {selectedMethod === "transfer" ? <span className="ml-auto text-[#0585FC]">✓</span> : null}
                </button>
              ) : null}

              {clubAcceptsCash ? (
                <button
                  type="button"
                  onClick={() => setSelectedMethod("cash")}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-4 transition ${
                    selectedMethod === "cash"
                      ? "border-[#0585FC] bg-[#0585FC]/5"
                      : "border-[var(--border-subtle)] bg-white dark:bg-[var(--bg-card)]"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                    <Banknote size={20} className="text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Efectivo</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Pagás en el club el día del partido</p>
                  </div>
                  {selectedMethod === "cash" ? <span className="ml-auto text-[#0585FC]">✓</span> : null}
                </button>
              ) : null}
            </div>

            <button
              type="button"
              disabled={!selectedMethod || pending}
              onClick={() => void handleConfirm()}
              className="mt-5 w-full rounded-2xl bg-[#0585FC] py-3.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {pending ? "Procesando..." : "Confirmar"}
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
