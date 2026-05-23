"use client";

import { useEffect, useState, useTransition } from "react";
import { Capacitor } from "@capacitor/core";
import { FaApple } from "react-icons/fa";
import {
  EXISTING_ACCOUNT_LOGIN_MESSAGE,
  resendOtpCode,
  signInWithEmail,
  signUpWithEmail,
  verifyOtpCode,
} from "./actions";

const inputClass =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-white px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-[#0585FC] focus:bg-white focus:shadow-[0_0_0_3px_rgba(56,189,248,0.22)] dark:border-[var(--border-subtle)] dark:bg-[#1c1c1e] dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-[#1c1c1e]";

const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400";

const oauthButtonClass =
  "flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white py-3.5 text-sm font-semibold text-slate-800 shadow-[var(--shadow-card)] transition-all duration-200 hover:bg-slate-50 active:scale-[0.99] dark:border-[var(--border-subtle)] dark:bg-[#1c1c1e] dark:text-slate-100 dark:hover:bg-[#2c2c2e]";

export function GoogleAuthForm() {
  return (
    <div className="space-y-2">
      <a href="/auth/google" className={oauthButtonClass}>
        Continuar con Google
      </a>
      {Capacitor.isNativePlatform() ? (
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          Si Google falla en la app, usá email y contraseña.
        </p>
      ) : null}
    </div>
  );
}

function useShowAppleSignIn() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      setShow(true);
      return;
    }
    setShow(Capacitor.getPlatform() === "ios");
  }, []);

  return show;
}

export function AppleAuthForm() {
  const show = useShowAppleSignIn();

  if (!show) return null;

  return (
    <a
      href="/auth/apple"
      className={`${oauthButtonClass} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100`}
    >
      <FaApple className="h-5 w-5 shrink-0" aria-hidden />
      Continuar con Apple
    </a>
  );
}

function LoginForm({
  onOtpRequired,
  notice,
  defaultEmail = "",
}: {
  onOtpRequired: (email: string) => void;
  notice?: string | null;
  defaultEmail?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await signInWithEmail(formData);
          if (!result.ok) {
            setError(result.message);
            if (result.needsEmailVerification && result.email) {
              onOtpRequired(result.email);
            }
          }
        });
      }}
    >
      {notice ? (
        <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-sm font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {notice}
        </p>
      ) : null}

      <div>
        <label htmlFor="login-email" className={labelClass}>
          Correo electrónico
        </label>
        <input
          id="login-email"
          key={defaultEmail || "login-email-empty"}
          type="email"
          name="email"
          defaultValue={defaultEmail}
          placeholder="tu@email.com"
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="login-password" className={labelClass}>
          Contraseña
        </label>
        <input
          id="login-password"
          type="password"
          name="password"
          placeholder="Mínimo 6 caracteres"
          required
          minLength={6}
          autoComplete="current-password"
          className={inputClass}
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-gradient-to-b from-[#0585FC] to-[#0461C4] py-4 text-[15px] font-semibold text-white shadow-[0_4px_16px_-4px_rgba(2,132,199,0.45)] transition-all duration-200 hover:from-[#0585FC] hover:to-[#0461C4] hover:shadow-[0_6px_22px_-4px_rgba(2,132,199,0.5)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {pending ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function RegisterForm({
  onOtpRequired,
  onExistingAccount,
}: {
  onOtpRequired: (email: string) => void;
  onExistingAccount: (email: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        setError(null);
        startTransition(async () => {
          const result = await signUpWithEmail(formData);
          if (result.step === "otp") {
            onOtpRequired(result.email);
            return;
          }
          if (result.needsLogin) {
            const email = String(formData.get("email") ?? "").trim().toLowerCase();
            if (email) onExistingAccount(email);
            return;
          }
          setError(result.message);
        });
      }}
    >
      <div>
        <label htmlFor="login-full-name" className={labelClass}>
          Nombre
        </label>
        <input
          id="login-full-name"
          type="text"
          name="full_name"
          placeholder="Tu nombre"
          required
          autoComplete="name"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="register-email" className={labelClass}>
          Correo electrónico
        </label>
        <input
          id="register-email"
          type="email"
          name="email"
          placeholder="tu@email.com"
          required
          autoComplete="email"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="register-password" className={labelClass}>
          Contraseña
        </label>
        <input
          id="register-password"
          type="password"
          name="password"
          placeholder="Mínimo 6 caracteres"
          required
          minLength={6}
          autoComplete="new-password"
          className={inputClass}
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-2xl bg-gradient-to-b from-[#0585FC] to-[#0461C4] py-4 text-[15px] font-semibold text-white shadow-[0_4px_16px_-4px_rgba(2,132,199,0.45)] transition-all duration-200 hover:from-[#0585FC] hover:to-[#0461C4] hover:shadow-[0_6px_22px_-4px_rgba(2,132,199,0.5)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {pending ? "Creando cuenta..." : "Crear mi cuenta"}
        </button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function OtpForm({
  email,
  onBack,
}: {
  email: string;
  onBack: () => void;
}) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(30);
  const [verifyPending, startVerifyTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSuccessMessage(null);
        startVerifyTransition(async () => {
          const formData = new FormData();
          formData.set("email", email);
          formData.set("token", token);
          const result = await verifyOtpCode(formData);
          if (!result.success) {
            setError(result.message);
          }
        });
      }}
    >
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Revisá tu email</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Te enviamos un código de 6 dígitos a {email}. Si no llega, revisá spam o reenviá.
        </p>
      </div>

      <div>
        <label htmlFor="otp-token" className={labelClass}>
          Código
        </label>
        <input
          id="otp-token"
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

      <div className="pt-2">
        <button
          type="submit"
          disabled={verifyPending}
          className="w-full rounded-2xl bg-gradient-to-b from-[#0585FC] to-[#0461C4] py-4 text-[15px] font-semibold text-white shadow-[0_4px_16px_-4px_rgba(2,132,199,0.45)] transition-all duration-200 hover:from-[#0585FC] hover:to-[#0461C4] hover:shadow-[0_6px_22px_-4px_rgba(2,132,199,0.5)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {verifyPending ? "Verificando..." : "Verificar código"}
        </button>
      </div>

      <button
        type="button"
        disabled={cooldown > 0 || resendPending}
        onClick={() => {
          setError(null);
          setSuccessMessage(null);
          startResendTransition(async () => {
            const formData = new FormData();
            formData.set("email", email);
            const result = await resendOtpCode(formData);
            if (!result.success) {
              setError(result.message);
              return;
            }
            setSuccessMessage(result.message);
            setCooldown(30);
          });
        }}
        className="mt-1 w-full rounded-2xl py-4 text-[15px] font-semibold text-[#0585FC] transition-all duration-200 hover:bg-[#0585FC]/5 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55 dark:text-sky-400 dark:hover:bg-slate-800"
      >
        {cooldown > 0 ? `Reenviar en ${cooldown}s...` : resendPending ? "Reenviando..." : "Reenviar código"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="mt-1 w-full rounded-2xl py-4 text-[15px] font-semibold text-[#0585FC] transition-all duration-200 hover:bg-[#0585FC]/5 active:scale-[0.99] dark:text-sky-400 dark:hover:bg-slate-800"
      >
        Volver
      </button>

      {error ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          {successMessage}
        </p>
      ) : null}
    </form>
  );
}

export function EmailAuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const [loginEmailPrefill, setLoginEmailPrefill] = useState("");
  const [otpState, setOtpState] = useState<{ active: boolean; email: string }>({
    active: false,
    email: "",
  });

  return (
    <div className="space-y-3">
      {otpState.active ? (
        <OtpForm
          email={otpState.email}
          onBack={() => setOtpState({ active: false, email: "" })}
        />
      ) : isLogin ? (
        <LoginForm
          notice={loginNotice}
          defaultEmail={loginEmailPrefill}
          onOtpRequired={(email) => {
            setLoginNotice(null);
            setOtpState({ active: true, email });
          }}
        />
      ) : (
        <RegisterForm
          onOtpRequired={(email) => setOtpState({ active: true, email })}
          onExistingAccount={(email) => {
            setIsLogin(true);
            setLoginEmailPrefill(email);
            setLoginNotice(EXISTING_ACCOUNT_LOGIN_MESSAGE);
          }}
        />
      )}

      {!otpState.active ? (
        <button
          type="button"
          onClick={() => {
            setIsLogin((prev) => !prev);
            setLoginNotice(null);
            setLoginEmailPrefill("");
          }}
          className="w-full rounded-2xl py-4 text-[15px] font-semibold text-[#0585FC] transition-all duration-200 hover:bg-[#0585FC]/5 active:scale-[0.99] dark:text-sky-400 dark:hover:bg-slate-800"
        >
          {isLogin ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Iniciá sesión"}
        </button>
      ) : null}
    </div>
  );
}
