"use client";

import { useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { es } from "date-fns/locale";

type Step = 1 | 2 | 3;
type Slot = { time: string; available: boolean };
type DateChip = { key: string; labelTop: string; labelBottom: string };

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-[#0085FC] focus:shadow-[0_0_0_3px_rgba(56,189,248,0.22)]";

const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500";

export default function AgendaForm() {
  const [step, setStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [clubName, setClubName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [dateChips, setDateChips] = useState<DateChip[]>([]);
  const [loadingDays, setLoadingDays] = useState(true);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingDays(true);
    fetch("/api/meetings/available-days")
      .then((r) => r.json())
      .then((data) => {
        const activeDays = new Set<number>((data.days ?? []) as number[]);
        const start = addDays(new Date(), 1);
        const chips: DateChip[] = Array.from({ length: 14 }, (_, i) => addDays(start, i))
          .filter((d) => activeDays.has(d.getDay()))
          .map((d) => ({
            key: format(d, "yyyy-MM-dd"),
            labelTop: format(d, "EEE", { locale: es }),
            labelBottom: format(d, "d", { locale: es }),
          }));
        setDateChips(chips);
      })
      .catch(() => setDateChips([]))
      .finally(() => setLoadingDays(false));
  }, []);

  useEffect(() => {
    if (!date) return;
    setSelectedTime(null);
    setLoadingSlots(true);
    fetch(`/api/meetings/available-slots?date=${date}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date]);

  function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !clubName.trim() || !email.trim() || !phone.trim()) return;
    setStep(2);
  }

  async function handleConfirm() {
    if (!date || !selectedTime) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/meetings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, clubName, email, phone, date, time: selectedTime }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo agendar la reunión.");
        return;
      }
      setStep(3);
    } catch {
      setError("No se pudo agendar la reunión. Revisá tu conexión e intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 3) {
    return (
      <div className="rounded-3xl bg-white p-8 text-center shadow-2xl">
        <p className="text-4xl">✅</p>
        <h2 className="mt-3 text-xl font-extrabold text-slate-900">¡Reunión confirmada!</h2>
        <p className="mt-2 text-sm text-slate-600">
          Te enviamos todos los detalles a <strong>{email}</strong>. Revisá tu bandeja de entrada.
        </p>
        <p className="mt-1 text-sm text-slate-600">El link de Google Meet también llegará a tu email.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      {step === 1 ? (
        <form onSubmit={handleStep1Submit} className="space-y-4">
          <label className="block">
            <span className={labelClass}>Nombre completo</span>
            <input
              className={inputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              placeholder="Juan Pérez"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Nombre del club</span>
            <input
              className={inputClass}
              value={clubName}
              onChange={(e) => setClubName(e.target.value)}
              required
              placeholder="Club Pádel Rosario"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="juan@club.com"
            />
          </label>
          <label className="block">
            <span className={labelClass}>Teléfono / WhatsApp</span>
            <input
              type="tel"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+54 9 341 ..."
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-xl bg-[#0085FC] py-3.5 text-sm font-bold text-white transition hover:bg-[#0461C4] active:scale-[0.99]"
          >
            Elegir horario →
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div>
            <span className={labelClass}>Elegí un día</span>
            {loadingDays ? (
              <p className="text-sm text-slate-500">Buscando días disponibles...</p>
            ) : dateChips.length === 0 ? (
              <p className="text-sm text-slate-500">No hay días disponibles en las próximas dos semanas.</p>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {dateChips.map((chip) => {
                  const selected = date === chip.key;
                  return (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => setDate(chip.key)}
                      className={`flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-2xl border px-4 py-3 text-center text-sm font-semibold capitalize transition-all ${
                        selected
                          ? "border-[#0085FC]/20 bg-[#0085FC] text-white shadow-md"
                          : "border-slate-200 bg-white text-slate-700 hover:border-[#0085FC]/40"
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
            )}
          </div>

          {date ? (
            <div>
              <span className={labelClass}>Horario disponible</span>
              {loadingSlots ? (
                <p className="text-sm text-slate-500">Buscando horarios...</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-slate-500">No hay horarios configurados para ese día.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      type="button"
                      disabled={!s.available}
                      onClick={() => setSelectedTime(s.time)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                        !s.available
                          ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through"
                          : selectedTime === s.time
                            ? "border-[#0085FC] bg-[#0085FC]/10 text-[#0461C4]"
                            : "border-slate-200 text-slate-700 hover:border-[#0085FC]/40"
                      }`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              ← Volver
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!date || !selectedTime || submitting}
              className="flex-1 rounded-xl bg-[#0085FC] py-3 text-sm font-bold text-white transition hover:bg-[#0461C4] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Confirmando..." : "Confirmar reunión"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
