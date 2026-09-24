"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import LandingSelect from "@/components/landing/landing-select";
import {
  CLUB_LEAD_PROBLEMS,
  CLUB_NAME_MAX,
  LEAD_COUNTRIES,
  PHONE_INPUT_MAX,
  formatWhatsapp,
  normalizeClubName,
  normalizeWhatsapp,
  validateClubLead,
} from "@/lib/club-leads";

type Field = "clubName" | "phone" | "problem";
type Errors = Partial<Record<Field, string>>;

const COUNTRY_OPTIONS = LEAD_COUNTRIES.map((c) => ({
  value: c.iso,
  label: c.name,
  hint: c.dial ? `+${c.dial}` : undefined,
}));

const inputBase =
  "h-12 w-full rounded-xl border bg-[#F7FAFF] px-4 text-base text-[#0F172A] outline-none transition placeholder:text-[#94A3B8] focus:bg-white";
const inputOk = "border-[#DCEBFF] focus:border-[#0085FC] focus:ring-4 focus:ring-[#0085FC]/15";
const inputBad = "border-[#E11D48] focus:border-[#E11D48] focus:ring-4 focus:ring-[#E11D48]/15";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-semibold text-[#BE123C]">
      <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  );
}

export default function ClubContactForm() {
  const reduceMotion = useReducedMotion();
  const [clubName, setClubName] = useState("");
  const [countryIso, setCountryIso] = useState<string>("AR");
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState("");
  const [website, setWebsite] = useState("");
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [sent, setSent] = useState<{ clubName: string; whatsapp: string } | null>(null);
  const mountedAt = useRef(0);
  const inFlight = useRef(false);
  const clubRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);

  const dial = LEAD_COUNTRIES.find((c) => c.iso === countryIso)?.dial ?? "";
  const phoneCheck = phone.trim() ? normalizeWhatsapp(dial, phone) : null;

  function fieldCheck(field: Field): string | undefined {
    if (field === "clubName") {
      const r = normalizeClubName(clubName);
      return r.ok ? undefined : r.error;
    }
    if (field === "phone") {
      const r = normalizeWhatsapp(dial, phone);
      return r.ok ? undefined : r.error;
    }
    return problem ? undefined : "Elegí qué te gustaría mejorar.";
  }

  // Un campo muestra su error recién cuando la persona salió de él o intentó enviar;
  // desde ahí se re-evalúa en cada tecla con el valor actual.
  const errors: Errors = {
    clubName: touched.clubName ? fieldCheck("clubName") : undefined,
    phone: touched.phone ? fieldCheck("phone") : undefined,
    problem: touched.problem ? fieldCheck("problem") : undefined,
  };

  function touch(field: Field) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current) return;
    setServerError(null);

    const v = validateClubLead({ clubName, dial, phone, problem });
    if (!v.ok) {
      setTouched({ clubName: true, phone: true, problem: true });
      if (v.errors.clubName) clubRef.current?.focus();
      else if (v.errors.phone) phoneRef.current?.focus();
      else document.getElementById("lead-problem")?.focus();
      return;
    }

    inFlight.current = true;
    setStatus("submitting");
    try {
      const res = await fetch("/api/club-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clubName,
          dial,
          phone,
          problem,
          website,
          elapsedMs: Math.round(e.timeStamp - mountedAt.current),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; fieldErrors?: Errors };
      if (!res.ok || !json.ok) {
        setServerError(json.error ?? "No pudimos enviar tu consulta. Intentá de nuevo.");
        setStatus("idle");
        return;
      }
      setSent({ clubName: v.value.clubName, whatsapp: v.value.whatsapp });
      setStatus("success");
    } catch {
      setServerError("No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.");
      setStatus("idle");
    } finally {
      inFlight.current = false;
    }
  }

  const submitting = status === "submitting";

  return (
    <div className="relative">
      <AnimatePresence mode="wait" initial={false}>
        {status === "success" && sent ? (
          <motion.div
            key="success"
            role="status"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-start gap-5 py-2"
          >
            <motion.span
              initial={reduceMotion ? false : { scale: 0.4, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.08 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#CCFF00] text-[#1F2900] shadow-[0_18px_40px_-18px_rgba(140,180,0,0.8)]"
            >
              <Check className="h-7 w-7" strokeWidth={3} aria-hidden />
            </motion.span>
            <div>
              <h4 className="text-2xl font-extrabold tracking-tight text-[#031733]">¡Recibimos tu consulta!</h4>
              <p className="mt-2 text-sm leading-relaxed text-[#475569] sm:text-base">
                Nuestro equipo se pondrá en contacto con vos.
              </p>
            </div>
            <dl className="grid w-full gap-3 rounded-2xl bg-[#F3F8FF] p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-[#64748B]">Club</dt>
                <dd className="mt-0.5 font-bold text-[#031733]">{sent.clubName}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-[#64748B]">Te escribimos al WhatsApp</dt>
                <dd className="mt-0.5 font-bold text-[#031733]">{formatWhatsapp(sent.whatsapp)}</dd>
              </div>
            </dl>
            <p className="text-sm text-[#475569]">
              ¿Querés ir adelantando?{" "}
              <Link href="/registro-club" className="font-bold text-[#0461C4] underline underline-offset-2 hover:text-[#0085FC]">
                Registrá tu club
              </Link>{" "}
              y probalo 15 días gratis.
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            noValidate
            onSubmit={onSubmit}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-5"
            aria-busy={submitting}
          >
            <div>
              <label htmlFor="lead-club" className="mb-1.5 block text-sm font-bold text-[#031733]">
                Nombre de tu club
              </label>
              <input
                ref={clubRef}
                id="lead-club"
                name="clubName"
                type="text"
                autoComplete="organization"
                maxLength={CLUB_NAME_MAX}
                placeholder="Ej.: Pádel Norte"
                value={clubName}
                disabled={submitting}
                onChange={(e) => setClubName(e.target.value)}
                onBlur={() => clubName.trim() && touch("clubName")}
                aria-invalid={Boolean(errors.clubName) || undefined}
                aria-describedby={errors.clubName ? "lead-club-error" : undefined}
                className={`${inputBase} ${errors.clubName ? inputBad : inputOk}`}
              />
              <FieldError id="lead-club-error" message={errors.clubName} />
            </div>

            <div>
              <label id="lead-phone-label" htmlFor="lead-phone" className="mb-1.5 block text-sm font-bold text-[#031733]">
                WhatsApp de contacto
              </label>
              <div
                className={`flex h-12 items-stretch rounded-xl border bg-[#F7FAFF] transition focus-within:bg-white ${
                  errors.phone
                    ? "border-[#E11D48] focus-within:ring-4 focus-within:ring-[#E11D48]/15"
                    : "border-[#DCEBFF] focus-within:border-[#0085FC] focus-within:ring-4 focus-within:ring-[#0085FC]/15"
                }`}
              >
                <span id="lead-country-label" className="sr-only">
                  Código de país
                </span>
                <div className="shrink-0 border-r border-[#DCEBFF]">
                  <LandingSelect
                    id="lead-country"
                    labelId="lead-country-label"
                    options={COUNTRY_OPTIONS}
                    value={countryIso}
                    onChange={setCountryIso}
                    disabled={submitting}
                    renderValue={(o) => (
                      <span className="font-bold text-[#031733]">
                        {o.value === "OTHER" ? "+ Otro" : `${o.value} ${o.hint}`}
                      </span>
                    )}
                    buttonClassName="h-[46px] rounded-l-xl pl-3.5 pr-2.5 text-sm focus-visible:bg-[#EAF3FF]"
                    popupClassName="!w-64 -left-px"
                  />
                </div>
                <input
                  ref={phoneRef}
                  id="lead-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete={dial ? "tel-national" : "tel"}
                  maxLength={PHONE_INPUT_MAX}
                  placeholder={dial === "54" ? "11 2345 6789" : dial ? "Número con código de área" : "+ código de país y número"}
                  value={phone}
                  disabled={submitting}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => phone.trim() && touch("phone")}
                  aria-invalid={Boolean(errors.phone) || undefined}
                  aria-describedby={errors.phone ? "lead-phone-error" : "lead-phone-hint"}
                  className="min-w-0 flex-1 rounded-r-xl bg-transparent px-3.5 text-base text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
                />
              </div>
              {errors.phone ? (
                <FieldError id="lead-phone-error" message={errors.phone} />
              ) : (
                <p id="lead-phone-hint" className="mt-1.5 text-[13px] text-[#64748B]">
                  {phoneCheck?.ok ? (
                    <>
                      Te escribimos al <span className="font-bold text-[#0461C4]">{formatWhatsapp(phoneCheck.value)}</span>
                    </>
                  ) : dial === "54" ? (
                    "Con código de área, sin el 0 ni el 15."
                  ) : dial ? (
                    "Con código de área."
                  ) : (
                    "Escribilo completo, empezando con + y el código de tu país."
                  )}
                </p>
              )}
            </div>

            <div>
              <span id="lead-problem-label" className="mb-1.5 block text-sm font-bold text-[#031733]">
                ¿Qué te gustaría mejorar en tu club?
              </span>
              <LandingSelect
                id="lead-problem"
                labelId="lead-problem-label"
                options={CLUB_LEAD_PROBLEMS}
                value={problem}
                onChange={setProblem}
                placeholder="Elegí una opción"
                describedBy={errors.problem ? "lead-problem-error" : undefined}
                disabled={submitting}
                buttonClassName={`min-h-12 rounded-xl border bg-[#F7FAFF] px-4 py-2.5 text-base leading-snug focus-visible:bg-white ${
                  errors.problem ? inputBad : inputOk
                } aria-expanded:border-[#0085FC] aria-expanded:bg-white aria-expanded:ring-4 aria-expanded:ring-[#0085FC]/15`}
              />
              <FieldError id="lead-problem-error" message={errors.problem} />
            </div>

            {/* Honeypot anti-bots: invisible para personas y lectores de pantalla. */}
            <div aria-hidden className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
              <label htmlFor="lead-website">No completar</label>
              <input
                id="lead-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            {serverError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-[#FECDD3] bg-[#FFF1F2] px-4 py-3 text-sm font-semibold text-[#9F1239]"
              >
                <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            ) : null}

            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#0085FC] px-6 text-base font-bold text-white shadow-[0_16px_36px_-16px_rgba(0,133,252,0.9)] transition hover:-translate-y-0.5 hover:bg-[#0461C4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0085FC]/30 active:scale-[0.99] disabled:translate-y-0 disabled:cursor-wait disabled:bg-[#4FA8F7]"
              >
                {submitting ? (
                  <>
                    <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                    Enviando consulta…
                  </>
                ) : (
                  "Quiero que me contacten"
                )}
              </button>
              <p className="text-xs leading-relaxed text-[#64748B]">
                Usamos estos datos solo para responder tu consulta. No te sumamos a listas de difusión.{" "}
                <Link
                  href="/legal/privacidad"
                  target="_blank"
                  className="font-semibold text-[#0461C4] underline underline-offset-2 hover:text-[#0085FC]"
                >
                  Política de privacidad
                </Link>
              </p>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
