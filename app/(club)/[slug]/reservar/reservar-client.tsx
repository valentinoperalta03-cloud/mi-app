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

const GUIDE_STEPS = [
  {
    label: "Paso 1",
    title: "Elegí el día",
    description: "Seleccioná entre los próximos 7 días disponibles para tu reserva",
  },
  {
    label: "Paso 2",
    title: "Elegí el horario",
    description: "Tocá el horario que más te convenga. Solo aparecen los turnos libres",
  },
  {
    label: "Paso 3",
    title: "Reservá y pagá la seña",
    description: "Elegí la cancha y pagá la seña online por Mercado Pago. La cancha es tuya",
  },
];

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

function WhatsappIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a9 9 0 0 0-7.75 13.55L3 21l4.6-1.2A9 9 0 1 0 12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8.7 8.4c.2-.45.4-.46.6-.47.16-.01.34-.01.5.01.16.02.38-.06.6.45.24.55.79 1.9.86 2.04.07.14.11.3.02.48-.09.18-.14.3-.28.46-.14.16-.29.35-.42.47-.14.12-.28.26-.12.5.16.24.71 1.16 1.52 1.88 1.05.93 1.93 1.22 2.18 1.36.25.14.4.12.55-.07.15-.19.63-.73.8-.98.17-.25.34-.2.57-.12.24.08 1.5.71 1.75.84.25.13.42.19.48.3.06.11.06.62-.15 1.22-.21.6-1.22 1.15-1.7 1.22-.44.07-.98.1-1.58-.1-.36-.12-.83-.28-1.42-.55-2.5-1.08-4.13-3.6-4.26-3.77-.13-.17-1.03-1.37-1.03-2.61 0-1.24.65-1.85.88-2.11Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.6 10.8c1.2 2.4 3.2 4.4 5.6 5.6l1.9-1.9c.24-.24.6-.32.9-.2 1 .34 2.07.52 3.16.52.5 0 .9.4.9.9v3.14c0 .5-.4.9-.9.9C9.4 19.76 4.24 14.6 4.24 6.9c0-.5.4-.9.9-.9H8.28c.5 0 .9.4.9.9 0 1.09.18 2.16.52 3.16.11.3.04.66-.2.9L6.6 10.8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
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
    <main className={`min-h-dvh ${spaceGrotesk.className}`} style={{ backgroundColor: "#0A1628" }}>
      <Header club={club} />
      <div className="mx-auto flex w-full max-w-[480px] flex-col items-center gap-2 px-4 pt-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] text-3xl">📵</div>
        <p className="mt-2 text-[20px] font-bold text-white">Este club no acepta reservas online por el momento</p>
        <p className="text-sm leading-relaxed text-white/55">Para reservar contactate directamente:</p>
        <div className="mt-4 flex w-full flex-col gap-2">
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] py-3.5 text-sm font-bold text-white"
            >
              <WhatsappIcon />
              WhatsApp
            </a>
          ) : null}
          {phoneHref ? (
            <a
              href={phoneHref}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#1A3050] bg-white/[0.06] py-3.5 text-sm font-semibold text-white"
            >
              <PhoneIcon />
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
    <main className={`min-h-dvh ${spaceGrotesk.className}`} style={{ backgroundColor: "#0A1628" }}>
      <Header club={club} />

      <div className="mx-auto flex w-full max-w-[480px] flex-col px-4 pb-24 pt-2">
        <div className="flex flex-col gap-2 mb-5">
          {GUIDE_STEPS.map((step) => (
            <div key={step.label} className="rounded-2xl border border-[#1A3050] bg-white/[0.04] px-4 py-4">
              <p className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#CCFF00]/60">
                {step.label}
              </p>
              <p className="text-[15px] font-bold text-white">{step.title}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-white/50">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="border-t border-[#1A3050] pt-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {dayChips.map((d) => {
              const active = d.ymd === selectedDate;
              const parts = d.label.split(" ");
              const top = parts.length > 1 ? parts[0] : d.label;
              const bottom = parts.length > 1 ? parts[1] : null;
              return (
                <button
                  key={d.ymd}
                  type="button"
                  onClick={() => handleSelectDate(d.ymd)}
                  className="shrink-0 rounded-xl border px-5 py-2.5 text-center"
                  style={
                    active
                      ? { backgroundColor: "#CCFF00", color: "#0A1628", borderColor: "#CCFF00" }
                      : { borderColor: "#1A3050" }
                  }
                >
                  {bottom ? (
                    <span className="flex flex-col gap-0.5">
                      <span className={`text-xs ${active ? "font-bold" : "text-white/40"}`}>{top}</span>
                      <span className={`text-sm font-bold ${active ? "" : "text-white/70"}`}>{bottom}</span>
                    </span>
                  ) : (
                    <span className={`text-sm font-semibold ${active ? "" : "text-white/70"}`}>{top}</span>
                  )}
                </button>
              );
            })}
          </div>

          {isLoadingSlots ? (
            <div className="mt-5">
              <p className="animate-pulse font-mono text-[10px] uppercase tracking-[0.15em] text-white/25">
                Cargando horarios...
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[52px] animate-pulse rounded-xl bg-white/[0.06]" />
                ))}
              </div>
            </div>
          ) : availability.slots.length === 0 ? (
            <div className="mt-5 rounded-xl border border-[#1A3050] bg-white/[0.03] px-4 py-6 text-center">
              <p className="text-2xl">😴</p>
              <p className="mt-1 text-sm font-semibold text-white/60">Sin turnos disponibles</p>
              <p className="mt-1 text-xs text-white/35">Probá con otro día</p>
            </div>
          ) : (
            <>
              <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                Horarios disponibles ·{" "}
                <span className="text-white/55">
                  {format(selectedDayChip.dateObj, "d 'de' MMMM", { locale: es })}
                </span>
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {availability.slots.map((slot) => {
                  const active = slot.time === expandedTime;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setExpandedTime(active ? null : slot.time)}
                      className="flex flex-col items-center gap-0.5 rounded-xl border px-3 py-3 text-center"
                      style={
                        active
                          ? { borderColor: "#CCFF00", borderWidth: 1.5, backgroundColor: "rgba(204,255,0,0.08)" }
                          : { borderColor: "#1A3050", backgroundColor: "rgba(255,255,255,0.06)" }
                      }
                    >
                      <span className="text-[15px] font-bold text-white">{slot.time}</span>
                      <span className="mt-0.5 font-mono text-[10px] text-white/45">
                        {slot.courtIds.length} {slot.courtIds.length === 1 ? "cancha" : "canchas"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <AnimatePresence>
            {expandedTime ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-2 pt-3">
                  {availability.slots
                    .find((s) => s.time === expandedTime)
                    ?.courtIds.map((courtId) => {
                      const court = courtsById.get(courtId);
                      if (!court) return null;
                      const price = priceForCourt(courtId, expandedTime);
                      const deposit =
                        price != null
                          ? resolveDepositCharge(price, club.deposit_type, club.deposit_value ?? 0)
                          : null;
                      const remaining = price != null && deposit != null ? Math.max(price - deposit, 0) : null;
                      return (
                        <div
                          key={courtId}
                          className="rounded-2xl border border-[#1A3050] bg-white/[0.04] p-4"
                        >
                          <p className="text-base font-bold text-white">{court.name ?? "Cancha"}</p>
                          <p className="mt-0.5 text-xs text-white/45">
                            {formatSurface(court.surface)} · {court.indoor ? "🏠 Techada" : "☀️ Descubierta"}
                          </p>

                          <div className="my-3 border-t border-[#1A3050]" />

                          {price != null ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <p className="font-mono text-[10px] uppercase tracking-wider text-white/35">
                                  Precio total
                                </p>
                                <p className="mt-0.5 text-[17px] font-bold text-[#0085FC]">{formatPrice(price)}</p>
                              </div>
                              {deposit != null ? (
                                <div>
                                  <p className="font-mono text-[10px] uppercase tracking-wider text-white/35">
                                    Seña ahora
                                  </p>
                                  <p className="mt-0.5 text-[17px] font-bold text-white">{formatPrice(deposit)}</p>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-xs text-white/45">Precio a confirmar</p>
                          )}

                          {remaining != null && remaining > 0 ? (
                            <p className="mt-2 text-xs text-white/40">
                              Saldo restante en el club: {formatPrice(remaining)}
                            </p>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => {
                              setBookingError(null);
                              setConfirmTarget({ courtId, time: expandedTime });
                            }}
                            className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-sm font-bold text-white"
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
            <div className="flex flex-col items-center text-center">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
                style={{ backgroundColor: "rgba(0,133,252,0.2)" }}
              >
                🎾
              </div>
              <h3 className="mt-3 text-lg font-bold text-white">¿Confirmás la reserva?</h3>
            </div>
            <div className="mt-4 flex flex-col text-sm">
              <div className="flex justify-between border-t border-white/[0.08] py-2.5">
                <span className="text-white/55">Club</span>
                <span className="font-semibold text-white">{club.name}</span>
              </div>
              <div className="flex justify-between border-t border-white/[0.08] py-2.5">
                <span className="text-white/55">Cancha</span>
                <span className="font-semibold text-white">{confirmCourt?.name ?? "Cancha"}</span>
              </div>
              <div className="flex justify-between border-t border-white/[0.08] py-2.5">
                <span className="text-white/55">Fecha</span>
                <span className="font-semibold text-white">
                  {format(selectedDayChip.dateObj, "EEEE d 'de' MMMM", { locale: es }).replace(/^./, (c) =>
                    c.toUpperCase()
                  )}{" "}
                  · {confirmTarget.time} hs
                </span>
              </div>
              {confirmPrice != null ? (
                <div className="flex justify-between border-t border-white/[0.08] py-2.5">
                  <span className="text-white/55">Precio total</span>
                  <span className="font-bold text-[#0085FC]">{formatPrice(confirmPrice)}</span>
                </div>
              ) : null}
              {confirmDeposit != null ? (
                <div className="flex justify-between border-t border-white/[0.08] py-2.5">
                  <span className="text-white/55">Seña a pagar ahora</span>
                  <span className="font-bold text-white">{formatPrice(confirmDeposit)}</span>
                </div>
              ) : null}
              {confirmRemaining != null && confirmRemaining > 0 ? (
                <div className="flex flex-col gap-0.5 border-t border-white/[0.08] py-2.5">
                  <div className="flex justify-between">
                    <span className="text-white/55">Saldo restante</span>
                    <span className="text-white/55">{formatPrice(confirmRemaining)}</span>
                  </div>
                  <span className="text-[10px] text-white/35">(lo pagás en el club el día del turno)</span>
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
                {isBooking
                  ? "Procesando..."
                  : confirmDeposit != null
                    ? `Pagar seña · ${formatPrice(confirmDeposit)}`
                    : "Confirmar y pagar seña"}
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
