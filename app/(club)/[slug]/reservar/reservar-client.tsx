"use client";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import { useEffect, useMemo, useState, useTransition } from "react";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { resolveDepositCharge } from "@/lib/deposit-utils";
import { nativeOpenUrl } from "@/lib/native-open";
import { getClubAvailability, reservarCancha, type AvailabilitySlot } from "../actions";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] });

export type ReservarClub = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  city: string | null;
  province: string | null;
  business_hours: string | null;
  deposit_type: "percentage" | "fixed" | null;
  deposit_value: number | null;
  open_time: string | null;
  close_time: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
};

export type ReservarCourt = {
  id: string;
  name: string | null;
  surface: string | null;
  indoor: boolean | null;
  price: number | null;
};

type Props = {
  club: ReservarClub;
  courts: ReservarCourt[];
  canReserveOnline: boolean;
};

function formatSurface(raw: string | null | undefined): string {
  if (!raw?.trim()) return "Superficie no definida";
  const s = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    cemento: "Cemento",
    cristal: "Cristal",
    "cesped sintetico": "Césped sintético",
    moqueta: "Moqueta",
  };
  return map[s] ?? raw.trim();
}

function formatPrice(n: number): string {
  return `$${new Intl.NumberFormat("es-AR").format(n)}`;
}

function whatsappHref(num: string | null): string | null {
  const digits = (num ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function telHref(num: string | null): string | null {
  const digits = (num ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

type DayChip = { ymd: string; label: string; dateObj: Date };

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
    return { ymd, label, dateObj: d };
  });
}

function Header({ club }: { club: ReservarClub }) {
  const cityProvince = [club.city, club.province]
    .filter((v): v is string => Boolean(v?.trim()))
    .map((v) => v.trim().toUpperCase())
    .join(", ");

  return (
    <>
      <div className="h-0.5 w-full" style={{ backgroundColor: "#CCFF00" }} />
      <div className="mx-auto flex w-full max-w-[480px] items-center gap-3 px-4 py-4">
        <Link
          href={`/${club.slug}`}
          aria-label="Volver"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.08] text-white"
        >
          ←
        </Link>
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/10" style={{ borderRadius: "50%" }}>
          {club.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={club.logo_url} alt={club.name} className="h-full w-full object-cover" />
          ) : null}
        </div>
        <div>
          <p className="text-[15px] font-bold text-white">{club.name}</p>
          {cityProvince ? <p className="text-[11px] text-white/60">{cityProvince}</p> : null}
        </div>
      </div>
    </>
  );
}

function CannotReserveOnline({ club }: { club: ReservarClub }) {
  const waHref = whatsappHref(club.whatsapp);
  const phoneHref = telHref(club.contact_phone);

  return (
    <main className={`min-h-dvh ${spaceGrotesk.className}`} style={{ backgroundColor: "#0C1829" }}>
      <Header club={club} />
      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-4 pt-10 text-center">
        <p className="text-lg font-bold text-white">Este club no acepta reservas online por el momento.</p>
        <p className="text-sm text-white/60">Para reservar contactate directamente:</p>
        <div className="mt-2 flex flex-col gap-2">
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] py-3.5 text-sm font-bold text-white"
            >
              WhatsApp
            </a>
          ) : null}
          {phoneHref ? (
            <a
              href={phoneHref}
              className="flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] py-3.5 text-sm font-semibold text-white"
            >
              Llamar
            </a>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default function ReservarClient({ club, courts, canReserveOnline }: Props) {
  const dayChips = useMemo(() => buildDayChips(), []);
  const [selectedDate, setSelectedDate] = useState(dayChips[0].ymd);
  const [availability, setAvailability] = useState<{ slots: AvailabilitySlot[]; prices: Record<string, number> }>({
    slots: [],
    prices: {},
  });
  const [isLoadingSlots, startLoadingSlots] = useTransition();
  const [expandedTime, setExpandedTime] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{ courtId: string; time: string } | null>(null);
  const [isBooking, startBooking] = useTransition();
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    if (!canReserveOnline) return;
    startLoadingSlots(async () => {
      const result = await getClubAvailability(club.id, selectedDate);
      setAvailability(result);
    });
  }, [canReserveOnline, club.id, selectedDate]);

  const courtsById = useMemo(() => new Map(courts.map((c) => [c.id, c])), [courts]);

  function priceForCourt(courtId: string, time: string): number | null {
    const override = availability.prices[`${courtId}__${time}`];
    if (override != null) return override;
    const court = courtsById.get(courtId);
    return typeof court?.price === "number" ? court.price : null;
  }

  function handleSelectDate(ymd: string) {
    setExpandedTime(null);
    setSelectedDate(ymd);
  }

  const selectedDayChip = dayChips.find((d) => d.ymd === selectedDate) ?? dayChips[0];
  const confirmCourt = confirmTarget ? courtsById.get(confirmTarget.courtId) : null;
  const confirmPrice = confirmTarget ? priceForCourt(confirmTarget.courtId, confirmTarget.time) : null;
  const confirmDeposit =
    confirmPrice != null ? resolveDepositCharge(confirmPrice, club.deposit_type, club.deposit_value ?? 0) : null;
  const confirmRemaining =
    confirmPrice != null && confirmDeposit != null ? Math.max(confirmPrice - confirmDeposit, 0) : null;

  function handleConfirmBooking() {
    if (!confirmTarget) return;
    setBookingError(null);

    startBooking(async () => {
      try {
        const result = await reservarCancha({
          courtId: confirmTarget.courtId,
          clubId: club.id,
          scheduledDate: selectedDate,
          scheduledTime: confirmTarget.time,
        });
        if ("error" in result) {
          setBookingError(result.error);
        } else {
          await nativeOpenUrl(result.mpUrl);
        }
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setBookingError("Hubo un error de conexión. Intentá de nuevo.");
      }
    });
  }

  if (!canReserveOnline) {
    return <CannotReserveOnline club={club} />;
  }

  return (
    <main className={`min-h-dvh ${spaceGrotesk.className}`} style={{ backgroundColor: "#0C1829" }}>
      <Header club={club} />

      <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4 px-4 pb-24 pt-2">
        <h1 className="text-[18px] font-bold text-white">Elegí día y horario</h1>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {dayChips.map((d) => {
            const active = d.ymd === selectedDate;
            return (
              <button
                key={d.ymd}
                type="button"
                onClick={() => handleSelectDate(d.ymd)}
                className="shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold"
                style={
                  active
                    ? { backgroundColor: "#CCFF00", color: "#0C1829", borderColor: "#CCFF00" }
                    : { borderColor: "rgba(255,255,255,0.10)" }
                }
              >
                <span className={active ? "" : "text-white/60"}>{d.label}</span>
              </button>
            );
          })}
        </div>

        {isLoadingSlots ? (
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl bg-white/[0.06]" />
            ))}
          </div>
        ) : availability.slots.length === 0 ? (
          <p className="text-sm text-white/50">No hay turnos disponibles para este día</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {availability.slots.map((slot) => {
              const active = slot.time === expandedTime;
              return (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setExpandedTime(active ? null : slot.time)}
                  className="flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-center"
                  style={
                    active
                      ? { borderColor: "#CCFF00", backgroundColor: "rgba(204,255,0,0.10)" }
                      : { borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.06)" }
                  }
                >
                  <span className="text-sm font-semibold text-white">{slot.time}</span>
                  <span className="text-[11px] text-white/55">
                    {slot.courtIds.length} {slot.courtIds.length === 1 ? "cancha" : "canchas"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {expandedTime ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2 pt-1">
                {availability.slots
                  .find((s) => s.time === expandedTime)
                  ?.courtIds.map((courtId) => {
                    const court = courtsById.get(courtId);
                    if (!court) return null;
                    const price = priceForCourt(courtId, expandedTime);
                    const deposit =
                      price != null ? resolveDepositCharge(price, club.deposit_type, club.deposit_value ?? 0) : null;
                    return (
                      <div
                        key={courtId}
                        className="flex flex-col gap-3 rounded-xl border border-white/[0.10] bg-white/[0.06] p-4"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{court.name ?? "Cancha"}</p>
                          <p className="text-xs text-white/55">
                            {formatSurface(court.surface)} · {court.indoor ? "Techada" : "Descubierta"}
                          </p>
                        </div>
                        <div className="flex items-center justify-between">
                          {price != null ? (
                            <p className="text-sm font-bold text-[#0085FC]">{formatPrice(price)}</p>
                          ) : (
                            <p className="text-xs text-white/45">Precio a confirmar</p>
                          )}
                          {deposit != null && deposit > 0 ? (
                            <p className="text-xs text-white/50">Seña: {formatPrice(deposit)}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBookingError(null);
                            setConfirmTarget({ courtId, time: expandedTime });
                          }}
                          style={{ minHeight: 48 }}
                          className="w-full rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-sm font-bold text-white"
                        >
                          Reservar esta cancha
                        </button>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {confirmTarget ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => (isBooking ? null : setConfirmTarget(null))}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/10 p-6"
            style={{ backgroundColor: "#0F2038" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white">Confirmá tu reserva</h3>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/55">Club</span>
                <span className="font-semibold text-white">{club.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/55">Cancha</span>
                <span className="font-semibold text-white">{confirmCourt?.name ?? "Cancha"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/55">Fecha</span>
                <span className="font-semibold text-white">
                  {format(selectedDayChip.dateObj, "EEEE d 'de' MMMM", { locale: es }).replace(/^./, (c) =>
                    c.toUpperCase()
                  )}{" "}
                  · {confirmTarget.time} hs
                </span>
              </div>
              {confirmPrice != null ? (
                <div className="flex justify-between">
                  <span className="text-white/55">Precio total</span>
                  <span className="font-bold text-[#0085FC]">{formatPrice(confirmPrice)}</span>
                </div>
              ) : null}
              {confirmDeposit != null ? (
                <div className="flex justify-between">
                  <span className="text-white/55">Seña a pagar ahora</span>
                  <span className="font-bold text-white">{formatPrice(confirmDeposit)}</span>
                </div>
              ) : null}
              {confirmRemaining != null && confirmRemaining > 0 ? (
                <div className="flex justify-between">
                  <span className="text-white/55">Saldo restante (lo pagás en el club)</span>
                  <span className="text-white/55">{formatPrice(confirmRemaining)}</span>
                </div>
              ) : null}
            </div>

            {bookingError ? <p className="mt-3 text-sm text-red-400">{bookingError}</p> : null}

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={isBooking}
                onClick={handleConfirmBooking}
                className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] py-3.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {isBooking ? "Procesando..." : "Confirmar y pagar seña"}
              </button>
              <button
                type="button"
                disabled={isBooking}
                onClick={() => setConfirmTarget(null)}
                className="flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] py-3.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
