"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resendOtpCode, signUpWithEmail } from "@/app/login/actions";
import { verifyClubOtpAction } from "./actions";

const inputClass =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-[#0085FC] focus:bg-white focus:shadow-[0_0_0_3px_rgba(56,189,248,0.22)] dark:border-[var(--border-subtle)] dark:bg-[#1c1c1e] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-[#1c1c1e]";

const labelClass =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400";

const primaryButtonClass =
  "w-full rounded-2xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] py-4 text-[15px] font-semibold text-white shadow-[0_4px_16px_-4px_rgba(2,132,199,0.45)] transition-all duration-200 hover:shadow-[0_6px_22px_-4px_rgba(2,132,199,0.5)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55";

const errorClass =
  "rounded-2xl border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300";

const successClass =
  "rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300";

type Step = "datos" | "otp" | "confirmando";

export default function RegistroClubForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("datos");
  const [clubName, setClubName] = useState("");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(30);
  const [datosPending, startDatosTransition] = useTransition();
  const [otpPending, startOtpTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();

  useEffect(() => {
    if (step !== "otp" || cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => window.clearInterval(id);
  }, [step, cooldown]);

  useEffect(() => {
    if (step === "confirmando") {
      router.push("/admin/activacion");
    }
  }, [step, router]);

  function handleDatosSubmit(raw: FormData) {
    setError(null);
    const name = String(raw.get("club_name") ?? "").trim();
    const fd = new FormData();
    fd.set("full_name", name);
    fd.set("email", String(raw.get("email") ?? ""));
    fd.set("password", String(raw.get("password") ?? ""));

    startDatosTransition(async () => {
      const result = await signUpWithEmail(fd);
      if (result.step === "otp") {
        setClubName(name);
        setEmail(result.email);
        setCooldown(30);
        setStep("otp");
        return;
      }
      setError(result.message);
    });
  }

  function handleOtpSubmit() {
    setError(null);
    startOtpTransition(async () => {
      const fd = new FormData();
      fd.set("email", email);
      fd.set("token", token);
      fd.set("club_name", clubName);
      const result = await verifyClubOtpAction(fd);
      if (!result.success) {
        setError(result.message);
        return;
      }
      setStep("confirmando");
    });
  }

  if (step === "confirmando") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#0085FC]/20 border-t-[#0085FC]" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Creando tu club...</p>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleOtpSubmit();
        }}
      >
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Revisá tu email
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Te enviamos un código de 6 dígitos a {email}. Si no llega, revisá spam o reenviá.
          </p>
        </div>

        <div>
          <label htmlFor="club-otp-token" className={labelClass}>
            Código
          </label>
          <input
            id="club-otp-token"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={token}
            onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            required
            className={`${inputClass} px-6 py-5 text-center text-3xl tracking-[0.35em]`}
          />
        </div>

        <button type="submit" disabled={otpPending} className={primaryButtonClass}>
          {otpPending ? "Verificando..." : "Verificar código"}
        </button>

        <button
          type="button"
          disabled={cooldown > 0 || resendPending}
          onClick={() => {
            setError(null);
            setSuccessMessage(null);
            startResendTransition(async () => {
              const fd = new FormData();
              fd.set("email", email);
              const result = await resendOtpCode(fd);
              if (!result.success) {
                setError(result.message);
                return;
              }
              setSuccessMessage(result.message);
              setCooldown(30);
            });
          }}
          className="w-full rounded-2xl py-3.5 text-[15px] font-semibold text-[#0085FC] transition-all duration-200 hover:bg-[#0085FC]/5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 dark:text-sky-400 dark:hover:bg-slate-800"
        >
          {cooldown > 0 ? `Reenviar en ${cooldown}s...` : resendPending ? "Reenviando..." : "Reenviá el código"}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep("datos");
          }}
          className="w-full rounded-2xl py-3.5 text-[15px] font-semibold text-[#0085FC] transition-all duration-200 hover:bg-[#0085FC]/5 active:scale-[0.99] dark:text-sky-400 dark:hover:bg-slate-800"
        >
          Volver
        </button>

        {error ? <p className={errorClass}>{error}</p> : null}
        {successMessage ? <p className={successClass}>{successMessage}</p> : null}
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        handleDatosSubmit(new FormData(event.currentTarget));
      }}
    >
      <div>
        <label htmlFor="club-name" className={labelClass}>
          Nombre del club
        </label>
        <input
          id="club-name"
          name="club_name"
          type="text"
          placeholder="Ej. Padel Club Norte"
          required
          autoComplete="organization"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="club-owner-email" className={labelClass}>
          Email del dueño
        </label>
        <input
          id="club-owner-email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="club-owner-password" className={labelClass}>
          Contraseña
        </label>
        <input
          id="club-owner-password"
          name="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          required
          minLength={8}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      <button type="submit" disabled={datosPending} className={primaryButtonClass}>
        {datosPending ? "Creando cuenta..." : "Continuar"}
      </button>

      {error ? <p className={errorClass}>{error}</p> : null}
    </form>
  );
}
