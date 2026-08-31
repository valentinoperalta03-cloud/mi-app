"use client";

import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { adminButtonSecondary } from "@/components/admin/admin-premium";
import type { AvailabilitySlot } from "../../(club)/[slug]/actions";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { crearReservaDesdeAdmin, getAdminClubAvailability } from "./actions";
import type { ReservasCourtOption } from "./reservas-tabs";

type FinancialStatus = "unpaid" | "partially_paid" | "fully_paid";
type PaymentMethod = "cash" | "transfer";

const FINANCIAL_OPTIONS: { value: FinancialStatus; label: string }[] = [
  { value: "unpaid", label: "Pendiente" },
  { value: "partially_paid", label: "Seña abonada" },
  { value: "fully_paid", label: "Pago completo" },
];

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
];

type DayChip = { ymd: string; label: string };

function buildDayChips(): DayChip[] {
  const todayYmd = getTodayYmdInArgentina();
  const todayDate = new Date(`${todayYmd}T12:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(todayDate, i);
    const ymd = format(d, "yyyy-MM-dd");
    let label: string;
    if (i === 0) label = "Hoy";
    else if (i === 1) label = "Mañana";
    else {
      const weekday = format(d, "EEE", { locale: es });
      label = `${weekday.charAt(0).toUpperCase()}${weekday.slice(1, 3)} ${format(d, "d")}`;
    }
    return { ymd, label };
  });
}

export default function NewReservationModal({
  clubId,
  clubName,
  courts,
  onClose,
}: {
  clubId: string;
  clubName: string;
  courts: ReservasCourtOption[];
  onClose: () => void;
}) {
  const dayChips = useMemo(() => buildDayChips(), []);
  const courtsById = useMemo(() => new Map(courts.map((c) => [c.id, c])), [courts]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState(dayChips[0].ymd);
  const [availability, setAvailability] = useState<{ slots: AvailabilitySlot[]; prices: Record<string, number> }>({
    slots: [],
    prices: {},
  });
  const [isLoadingSlots, startLoadingSlots] = useTransition();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [financialStatus, setFinancialStatus] = useState<FinancialStatus>("unpaid");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amount, setAmount] = useState("");
  const [isCreating, startCreating] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Mismo patrón que RegistrarPagoModal en app/admin/cobros/cobros-client.tsx
  // (commit dd132f9): portal a document.body + bloqueo de scroll del body
  // mientras el modal está abierto. Sin portal, un modal fixed inset-0
  // renderizado dentro de AdminRouteTransition (motion.div con layoutId)
  // queda posicionado relativo a ese ancestor transformado en vez del
  // viewport real — se ve recortado o mal ubicado, sobre todo en mobile.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    startLoadingSlots(async () => {
      const result = await getAdminClubAvailability(clubId, selectedDate);
      setAvailability(result);
    });
  }, [clubId, selectedDate]);

  function handleSelectDate(ymd: string) {
    setSelectedTime(null);
    setSelectedCourtId(null);
    setSelectedDate(ymd);
  }

  const availableCourtIds = selectedTime
    ? availability.slots.find((s) => s.time === selectedTime)?.courtIds ?? []
    : [];
  const selectedCourt = selectedCourtId ? courtsById.get(selectedCourtId) : null;

  function handleCreate() {
    if (!selectedCourtId || !selectedTime) return;
    if (!reference.trim()) {
      setError("Completá un nombre o referencia.");
      return;
    }
    const amountNum = Number(amount);
    if (financialStatus !== "unpaid" && (!Number.isFinite(amountNum) || amountNum <= 0)) {
      setError("Ingresá un monto válido.");
      return;
    }
    setError(null);
    startCreating(async () => {
      const result = await crearReservaDesdeAdmin({
        courtId: selectedCourtId,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        reference: reference.trim(),
        financialStatus,
        paymentMethod: financialStatus !== "unpaid" ? paymentMethod : undefined,
        amount: financialStatus !== "unpaid" ? amountNum : undefined,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{
        background: "rgba(0,0,0,0.60)",
        backdropFilter: "blur(4px)",
        paddingTop: "max(1rem, var(--cap-safe-top, env(safe-area-inset-top, 0px)))",
      }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto" style={{ borderRadius: 16, background: "var(--bg-card)" }}>
        <div
          style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)", borderRadius: "16px 16px 0 0", padding: "20px 24px" }}
        >
          <h2 className="font-admin-display text-lg font-bold text-white">Nueva reserva</h2>
          <p className="mt-1 text-sm text-white/80">Paso {step} de 3</p>
        </div>

        <div style={{ padding: 24 }} className="space-y-5">
          {step === 1 ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Cuándo</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dayChips.map((d) => {
                  const active = d.ymd === selectedDate;
                  return (
                    <button
                      key={d.ymd}
                      type="button"
                      onClick={() => handleSelectDate(d.ymd)}
                      className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                        active
                          ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]"
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              {isLoadingSlots ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[52px] animate-pulse rounded-xl bg-[var(--bg-subtle)]" />
                  ))}
                </div>
              ) : availability.slots.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
                  Sin turnos disponibles ese día.
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availability.slots.map((slot) => {
                    const active = slot.time === selectedTime;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => {
                          setSelectedTime(slot.time);
                          setSelectedCourtId(null);
                        }}
                        className={`rounded-xl border px-3 py-3 text-center text-sm font-bold transition-colors ${
                          active
                            ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0085FC]"
                            : "border-[var(--border-subtle)] text-[var(--text-primary)]"
                        }`}
                      >
                        {slot.time}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className={`flex-1 ${adminButtonSecondary}`}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedTime}
                  onClick={() => setStep(2)}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-105 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)" }}
                >
                  Continuar
                </button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                ← Cambiar horario
              </button>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Cancha</p>
              {availableCourtIds.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-6 text-center text-sm text-[var(--text-tertiary)]">
                  Ninguna cancha libre a esa hora.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {availableCourtIds.map((courtId) => {
                    const court = courtsById.get(courtId);
                    if (!court) return null;
                    const active = courtId === selectedCourtId;
                    return (
                      <button
                        key={courtId}
                        type="button"
                        onClick={() => setSelectedCourtId(courtId)}
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          active
                            ? "border-[#0085FC] bg-[#0085FC]/5"
                            : "border-[var(--border-subtle)] bg-transparent"
                        }`}
                      >
                        <p className="text-sm font-bold text-[var(--text-primary)]">{court.name}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className={`flex-1 ${adminButtonSecondary}`}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!selectedCourtId}
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-105 disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)" }}
                >
                  Continuar
                </button>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm font-medium text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                ← Cambiar cancha
              </button>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)]/50 p-3 text-sm text-[var(--text-secondary)]">
                <p className="font-bold text-[var(--text-primary)]">{clubName}</p>
                <p className="mt-0.5">
                  {selectedCourt?.name ?? "Cancha"} · {selectedDate} · {selectedTime}hs
                </p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Nombre o referencia</span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ej: Reserva de Marcos por teléfono"
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-transparent px-4 py-3 text-sm placeholder:text-[var(--text-tertiary)] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </label>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Estado de pago</span>
                <div className="grid grid-cols-3 gap-2">
                  {FINANCIAL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFinancialStatus(opt.value)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        financialStatus === opt.value
                          ? "bg-[#0085FC] text-white"
                          : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/70"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {financialStatus !== "unpaid" ? (
                <>
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Método de pago</span>
                    <div className="grid grid-cols-2 gap-2">
                      {METHOD_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPaymentMethod(opt.value)}
                          className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                            paymentMethod === opt.value
                              ? "bg-[#0085FC] text-white"
                              : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/70"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]">Monto</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]">
                        $
                      </span>
                      <input
                        type="number"
                        min={1}
                        step="1"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-transparent px-4 py-3 pl-7 text-sm placeholder:text-[var(--text-tertiary)] focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </label>
                </>
              ) : null}

              {error ? <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p> : null}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onClose} className={`flex-1 ${adminButtonSecondary}`}>
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handleCreate}
                  className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-105 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #0085FC, #0461C4)" }}
                >
                  {isCreating ? "Creando…" : "Crear reserva"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
