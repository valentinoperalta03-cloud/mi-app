"use client";

import { addDays, format, getDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Suspense } from "react";
import { buildSlotsForDay, type GeneratedSlot, type ScheduleInput } from "@/lib/court-slots";
import { DB_TABLES } from "@/lib/db-tables";
import { playerShareWithMarketplaceFee } from "@/lib/offline-payments";
import { PLAYER_PRIMARY_BUTTON } from "@/lib/player-ui";
import { createClient } from "@/utils/supabase/client";
import { createReservation, type CreateReservationResult } from "./actions";

function clockToMinutes(clock: string): number {
  const t = clock.trim().slice(0, 5);
  const [h, m] = t.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

function overlapsSlot(
  slotStartMin: number,
  slotDur: number,
  otherStartMin: number,
  otherDur: number
): boolean {
  const slotEnd = slotStartMin + slotDur;
  const otherEnd = otherStartMin + otherDur;
  return slotStartMin < otherEnd && otherStartMin < slotEnd;
}

function normalizeDbTime(t: string | null | undefined): string {
  if (!t) return "";
  return String(t).trim().slice(0, 5);
}

type MatchRow = {
  scheduled_time: string | null;
  duration_minutes: number | null;
  match_type: string | null;
  payment_status: string | null;
  match_status: string | null;
};

type BlockRow = {
  start_time: string | null;
};
type ClubPayLoad = {
  accepts_mp: boolean;
  accepts_cash: boolean;
  accepts_transfer: boolean;
  bank_alias: string | null;
  bank_cbu: string | null;
};
type BlockRowModern = {
  blocked_time: string | null;
};

type SlotView = GeneratedSlot & {
  available: boolean;
  reason?: string;
};

function fmtAr(numero: number) {
  return new Intl.NumberFormat("es-AR").format(numero);
}

function NuevaReservaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const courtId = searchParams.get("court_id") ?? "";
  const clubName = searchParams.get("club_name") ?? "";
  const courtName = searchParams.get("court_name") ?? "";
  const priceRaw = searchParams.get("price") ?? "0";
  /** Precio total del turno (90 min) desde la cancha. */
  const precioTurno = Number.parseInt(priceRaw, 10) || 0;

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<GeneratedSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState<SlotView[]>([]);
  const [pendingConfirm, startConfirm] = useTransition();
  const [clubPay, setClubPay] = useState<ClubPayLoad | null>(null);
  const [payMethod, setPayMethod] = useState<"mercadopago" | "cash" | "transfer">("mercadopago");

  /** Total mostrado al jugador; coincide con el monto cobrado en el flujo de pago. */
  const totalPagar = useMemo(() => {
    const { total } = playerShareWithMarketplaceFee(precioTurno);
    return total;
  }, [precioTurno]);

  const dateChips = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 14 }, (_, i) => {
      const d = addDays(start, i);
      return {
        key: format(d, "yyyy-MM-dd"),
        labelTop: format(d, "EEE", { locale: es }),
        labelBottom: format(d, "d", { locale: es }),
        full: d,
      };
    });
  }, []);

  const loadSlots = useCallback(async () => {
    if (!courtId || !selectedDate) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const dayDate = parseISO(`${selectedDate}T12:00:00`);
      const dow = getDay(dayDate);

      const [
        { data: schedRows, error: schedErr },
        { data: matchRows, error: matchErr },
        { data: blockRowsModern, error: blockErrModern },
        { data: blockRowsLegacy, error: blockErrLegacy },
      ] = await Promise.all([
        supabase
          .from(DB_TABLES.courtSchedules)
          .select("court_id,day_of_week,open_time,close_time")
          .eq("court_id", courtId)
          .not("day_of_week", "is", null),
        supabase
          .from(DB_TABLES.matches)
          .select("scheduled_time,duration_minutes,match_type,payment_status,match_status")
          .eq("court_id", courtId)
          .eq("scheduled_date", selectedDate)
          .neq("match_status", "cancelled"),
        supabase
          .from(DB_TABLES.courtBlocks)
          .select("blocked_time")
          .eq("court_id", courtId)
          .eq("blocked_date", selectedDate),
        supabase
          .from(DB_TABLES.courtBlocks)
          .select("start_time")
          .eq("court_id", courtId)
          .eq("date", selectedDate),
      ]);

      if (schedErr || matchErr || blockErrModern || blockErrLegacy) {
        setError(
          schedErr?.message ??
            matchErr?.message ??
            blockErrModern?.message ??
            blockErrLegacy?.message ??
            "Error al cargar horarios."
        );
        setSlots([]);
        return;
      }

      const schedules: ScheduleInput[] = (schedRows ?? []).filter(
        (r) => Number((r as ScheduleInput).day_of_week) === dow
      ) as ScheduleInput[];
      const built = buildSlotsForDay([courtId], dayDate, schedules);

      const matches = (matchRows ?? []) as MatchRow[];
      const blocksModern = (blockRowsModern ?? []) as BlockRowModern[];
      const blocksLegacy = (blockRowsLegacy ?? []) as BlockRow[];
      const blockStarts = new Set(
        [
          ...blocksModern.map((b) => normalizeDbTime((b as { blocked_time: string | null }).blocked_time)),
          ...blocksLegacy.map((b) => normalizeDbTime((b as { start_time: string | null }).start_time)),
        ].filter(Boolean)
      );

      const resolvedSlots = built.map((slot) => {
        const slotStart = clockToMinutes(slot.time);
        const slotDur = slot.duration;

        if (blockStarts.has(normalizeDbTime(slot.time))) {
          return { ...slot, available: false, reason: "Bloqueado por el club" } satisfies SlotView;
        }

        for (const m of matches) {
          const isReservation = String(m.match_type ?? "").toLowerCase() === "reservation";
          const paymentStatus = String(m.payment_status ?? "").toLowerCase();
          const matchStatus = String(m.match_status ?? "").toLowerCase();
          const shouldBlockSlot =
            matchStatus !== "cancelled" &&
            (!isReservation ||
              paymentStatus === "paid" ||
              paymentStatus === "pending" ||
              paymentStatus === "cash_pending" ||
              paymentStatus === "transfer_pending");
          if (!shouldBlockSlot) continue;
          const mStart = clockToMinutes(normalizeDbTime(m.scheduled_time));
          const mDur = m.duration_minutes && m.duration_minutes > 0 ? m.duration_minutes : 90;
          if (overlapsSlot(slotStart, slotDur, mStart, mDur)) {
            return { ...slot, available: false, reason: "Ya reservado" } satisfies SlotView;
          }
        }
        return { ...slot, available: true } satisfies SlotView;
      });

      setSlots(resolvedSlots);
    } finally {
      setLoading(false);
    }
  }, [courtId, selectedDate]);

  useEffect(() => {
    if (step !== 3 || !courtId) return;
    let cancelled = false;
    void (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from(DB_TABLES.courts)
        .select("clubs(accepts_cash, accepts_transfer, bank_alias, bank_cbu, mp_access_token)")
        .eq("id", courtId)
        .maybeSingle();
      if (cancelled) return;
      if (err || !data) {
        setClubPay({
          accepts_mp: false,
          accepts_cash: false,
          accepts_transfer: false,
          bank_alias: null,
          bank_cbu: null,
        });
        return;
      }
      const row = data as {
        clubs?:
          | {
              accepts_cash?: boolean | null;
              accepts_transfer?: boolean | null;
              bank_alias?: string | null;
              bank_cbu?: string | null;
              mp_access_token?: string | null;
            }
          | Array<{
              accepts_cash?: boolean | null;
              accepts_transfer?: boolean | null;
              bank_alias?: string | null;
              bank_cbu?: string | null;
              mp_access_token?: string | null;
            }>
          | null;
      };
      const c = Array.isArray(row.clubs) ? row.clubs[0] ?? null : row.clubs;
      const accepts_mp = Boolean(c?.mp_access_token);
      const next: ClubPayLoad = {
        accepts_mp,
        accepts_cash: Boolean(c?.accepts_cash),
        accepts_transfer: Boolean(c?.accepts_transfer),
        bank_alias: c?.bank_alias?.trim() ? c.bank_alias.trim() : null,
        bank_cbu: c?.bank_cbu?.trim() ? c.bank_cbu.trim() : null,
      };
      setClubPay(next);
      if (accepts_mp) setPayMethod("mercadopago");
      else if (next.accepts_cash) setPayMethod("cash");
      else if (next.accepts_transfer) setPayMethod("transfer");
    })();
    return () => {
      cancelled = true;
    };
  }, [step, courtId]);

  useEffect(() => {
    if (step === 2 && selectedDate) {
      void loadSlots();
    }
  }, [step, selectedDate, loadSlots]);

  useEffect(() => {
    if (!courtId) {
      router.replace("/reservas");
    }
  }, [courtId, router]);

  const selectedDateLabel =
    selectedDate != null
      ? format(parseISO(`${selectedDate}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es })
      : "";

  function StepIndicator({ active }: { active: 1 | 2 | 3 }) {
    return (
      <div className="mb-6 flex justify-center gap-3">
        {([1, 2, 3] as const).map((n) => (
          <span
            key={n}
            className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
              active === n ? "bg-[#0585FC] text-white dark:bg-sky-500" : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      {step === 1 ? (
        <>
          <StepIndicator active={1} />
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 dark:text-slate-100">¿Cuándo querés jugar?</h1>
          <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {dateChips.map((chip) => {
              const selected = selectedDate === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    setSelectedDate(chip.key);
                    setSelectedSlot(null);
                    setError(null);
                    setStep(2);
                  }}
                  className={`flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-2xl border px-4 py-3 text-center text-sm font-semibold transition-all ${
                    selected
                      ? "border-[#0585FC]/20 bg-[#0585FC] text-white shadow-md dark:bg-sky-500"
                      : "border-slate-200 bg-white text-slate-700 hover:border-[#0585FC]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase leading-tight opacity-90">
                    {chip.labelTop}
                  </span>
                  <span className="text-lg leading-tight">{chip.labelBottom}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <StepIndicator active={2} />
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 dark:text-slate-100">Elegí un horario</h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{selectedDateLabel}</p>

          {loading ? (
            <p className="text-sm text-slate-500">Cargando horarios…</p>
          ) : slots.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Esta cancha no tiene horarios cargados para este día.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {slots.map((slot) => {
                const key = `${slot.time}-${slot.duration}`;
                const selected =
                  selectedSlot?.time === slot.time && selectedSlot?.duration === slot.duration;
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => {
                      if (!slot.available) return;
                      setSelectedSlot(slot);
                      setError(null);
                      setStep(3);
                    }}
                    className={`flex min-h-[4.5rem] flex-col items-center justify-center rounded-2xl border px-2 py-3 text-center text-xs font-semibold transition-all ${
                      !slot.available
                        ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                        : selected
                          ? "border-[#0585FC]/20 bg-[#0585FC] text-white shadow-md dark:bg-sky-500"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[#0585FC]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    }`}
                  >
                    <span>{slot.time}</span>
                    <span className="mt-0.5 opacity-90">{slot.duration} min</span>
                    {!slot.available ? <span className="mt-1 text-[10px] font-medium">{slot.reason ?? "No disponible"}</span> : null}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setStep(1);
              setSelectedSlot(null);
            }}
            className="w-full rounded-2xl py-3 text-sm font-semibold text-[#0585FC] transition hover:bg-[#0585FC]/5"
          >
            Cambiar fecha
          </button>
        </>
      ) : null}

      {step === 3 && selectedDate && selectedSlot ? (
        <>
          <StepIndicator active={3} />
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-950 dark:text-slate-100">Confirmá tu reserva</h1>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <dl className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex justify-between gap-2">
                <dt className="font-medium text-slate-500 dark:text-slate-400">Club</dt>
                <dd className="min-w-0 break-words text-right font-semibold text-slate-900 dark:text-slate-100">{clubName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-medium text-slate-500 dark:text-slate-400">Cancha</dt>
                <dd className="min-w-0 break-words text-right font-semibold text-slate-900 dark:text-slate-100">{courtName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-medium text-slate-500 dark:text-slate-400">Fecha</dt>
                <dd className="text-right font-semibold text-slate-900 dark:text-slate-100">{selectedDateLabel}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-medium text-slate-500 dark:text-slate-400">Hora</dt>
                <dd className="text-right font-semibold text-slate-900 dark:text-slate-100">{selectedSlot.time}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="font-medium text-slate-500 dark:text-slate-400">Duración</dt>
                <dd className="text-right font-semibold text-slate-900 dark:text-slate-100">{selectedSlot.duration} min</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700">
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">
              Total a pagar:{" "}
              <span className="text-lg font-bold text-[#0585FC] dark:text-sky-400">${fmtAr(totalPagar)}</span>
            </p>
          </div>

          {clubPay === null ? (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">Cargando medios de pago…</p>
          ) : null}
          {clubPay && !clubPay.accepts_mp && !clubPay.accepts_cash && !clubPay.accepts_transfer ? (
            <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
              Este club no tiene medios de pago habilitados. Contactá al administrador.
            </p>
          ) : null}
          {clubPay && (clubPay.accepts_mp || clubPay.accepts_cash || clubPay.accepts_transfer) ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Medio de pago</p>
              <div className="grid gap-2.5">
                {clubPay.accepts_mp ? (
                  <button
                    key="mp"
                    type="button"
                    onClick={() => setPayMethod("mercadopago")}
                    className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                      payMethod === "mercadopago"
                        ? "border-[#0585FC] bg-[#0585FC]/8 ring-2 ring-[#0585FC]/20 dark:border-sky-500 dark:bg-sky-500/10 dark:ring-sky-500/25"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      💳
                    </span>
                    <span className="ml-2 font-bold text-slate-900 dark:text-slate-100">Mercado Pago</span>
                    <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Pago instantáneo</span>
                  </button>
                ) : null}
                {clubPay.accepts_cash ? (
                  <button
                    key="cash"
                    type="button"
                    onClick={() => setPayMethod("cash")}
                    className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                      payMethod === "cash"
                        ? "border-[#0585FC] bg-[#0585FC]/8 ring-2 ring-[#0585FC]/20 dark:border-sky-500 dark:bg-sky-500/10 dark:ring-sky-500/25"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      💵
                    </span>
                    <span className="ml-2 font-bold text-slate-900 dark:text-slate-100">Efectivo en el club</span>
                    <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Pagás cuando llegás</span>
                  </button>
                ) : null}
                {clubPay.accepts_transfer ? (
                  <button
                    key="tr"
                    type="button"
                    onClick={() => setPayMethod("transfer")}
                    className={`rounded-2xl border px-4 py-3.5 text-left transition ${
                      payMethod === "transfer"
                        ? "border-[#0585FC] bg-[#0585FC]/8 ring-2 ring-[#0585FC]/20 dark:border-sky-500 dark:bg-sky-500/10 dark:ring-sky-500/25"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      🏦
                    </span>
                    <span className="ml-2 font-bold text-slate-900 dark:text-slate-100">Transferencia</span>
                    <span className="mt-0.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      CBU: {clubPay.bank_alias ?? "—"}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {payMethod === "transfer" && clubPay?.bank_alias ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
              <p className="font-semibold text-slate-900 dark:text-slate-100">Datos para transferir</p>
              <p className="text-slate-700 dark:text-slate-200">
                <span className="font-medium text-slate-500 dark:text-slate-400">Alias: </span>
                {clubPay.bank_alias}
              </p>
              {clubPay.bank_cbu ? (
                <p className="text-slate-700 dark:text-slate-200">
                  <span className="font-medium text-slate-500 dark:text-slate-400">CBU: </span>
                  {clubPay.bank_cbu}
                </p>
              ) : null}
              <p className="text-slate-700 dark:text-slate-200">
                <span className="font-medium text-slate-500 dark:text-slate-400">Monto exacto: </span>${fmtAr(totalPagar)}
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Enviá el comprobante al club.</p>
            </div>
          ) : null}

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              const formData = new FormData(event.currentTarget);
              startConfirm(async () => {
                try {
                  const result = (await createReservation(formData)) as CreateReservationResult;
                  if (result && "error" in result) {
                    setError(result.error);
                  }
                } catch {
                  /* redirect() de la server action */
                }
              });
            }}
          >
            <input type="hidden" name="court_id" value={courtId} />
            <input type="hidden" name="scheduled_date" value={selectedDate} />
            <input type="hidden" name="scheduled_time" value={selectedSlot.time} />
            <input type="hidden" name="duration_minutes" value={String(selectedSlot.duration)} />
            <input type="hidden" name="club_name" value={clubName} />
            <input type="hidden" name="court_name" value={courtName} />
            <input type="hidden" name="payment_method" value={payMethod} />

            <button
              type="submit"
              disabled={
                pendingConfirm ||
                !clubPay ||
                (!clubPay.accepts_mp && !clubPay.accepts_cash && !clubPay.accepts_transfer) ||
                (payMethod === "transfer" && !clubPay.bank_alias)
              }
              className={`w-full ${PLAYER_PRIMARY_BUTTON} py-3.5 text-base disabled:opacity-60`}
            >
              {pendingConfirm
                ? "Reservando…"
                : payMethod === "mercadopago"
                  ? "Pagar con Mercado Pago"
                  : "Confirmar reserva"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full rounded-2xl py-3 text-sm font-semibold text-[#0585FC] transition hover:bg-[#0585FC]/5"
          >
            Cambiar horario
          </button>
        </>
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function NuevaReservaPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-6">
          <p className="text-sm text-slate-500">Cargando...</p>
        </div>
      }
    >
      <NuevaReservaContent />
    </Suspense>
  );
}
