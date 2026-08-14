"use client";

import { useEffect, useState, useTransition } from "react";
import { Capacitor } from "@capacitor/core";
import { FaApple, FaGoogle } from "react-icons/fa";
import { startNativeAppleOAuth, startNativeGoogleOAuth } from "@/lib/native-oauth";
import { isCapacitorIosIpad } from "@/lib/capacitor-device";
import { EXISTING_ACCOUNT_LOGIN_MESSAGE } from "./constants";
import {
  resendOtpCode,
  signInWithEmail,
  signUpWithEmail,
  verifyOtpCode,
} from "./actions";

const inputClass =
  "h-[52px] w-full rounded-xl border border-white/15 bg-white/[0.08] px-4 text-sm font-medium text-white placeholder:text-white/40 outline-none transition-all duration-200 focus:border-[#0085FC]";

const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50";

const oauthButtonClass =
  "flex h-[52px] w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.08] text-sm font-semibold text-white transition-all duration-200 hover:bg-white/[0.14] active:scale-[0.99]";

const primaryButtonClass =
  "flex h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#0085FC] to-[#0461C4] text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(0,133,252,0.40)] transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55";

const linkButtonClass =
  "w-full rounded-xl py-4 text-[15px] font-semibold text-[#0085FC] transition-all duration-200 hover:bg-[#0085FC]/10 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55";

const noticeClass =
  "rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-xs font-medium leading-relaxed text-amber-200";

const errorClass =
  "rounded-2xl border border-rose-400/30 bg-rose-400/10 px-3 py-2.5 text-sm font-medium text-rose-300";

const successClass =
  "rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-sm font-medium text-emerald-300";

function useCapacitorIosIpad() {
  const [isIpad, setIsIpad] = useState(false);

  useEffect(() => {
    setIsIpad(isCapacitorIosIpad());
  }, []);

  return isIpad;
}

function useCapacitorNativeOAuth() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(
      Capacitor.isNativePlatform() &&
        (Capacitor.getPlatform() === "android" || Capacitor.getPlatform() === "ios")
    );
  }, []);

  return enabled;
}

export function GoogleAuthForm() {
  const isIpadNative = useCapacitorIosIpad();
  const useNativeOAuth = useCapacitorNativeOAuth();
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  async function openGoogleNative() {
    setGooglePending(true);
    setGoogleError(null);

    try {
      const result = await startNativeGoogleOAuth();
      if (!result.ok) {
        setGoogleError(result.message);
      }
    } catch (err) {
      console.error("[GoogleAuth] unexpected error:", err);
      setGoogleError(err instanceof Error ? err.message : "No se pudo abrir Google. Intentá de nuevo.");
    } finally {
      setGooglePending(false);
    }
  }

  return (
    <div className="space-y-2">
      {isIpadNative ? (
        <p className={noticeClass}>
          En iPad, «Continuar con Google» puede abrir Safari para iniciar sesión. Si no volvés a la
          app, usá <strong>Continuar con Apple</strong> o <strong>email y contraseña</strong>.
        </p>
      ) : null}
      {useNativeOAuth ? (
        <button
          type="button"
          onClick={() => void openGoogleNative()}
          disabled={googlePending}
          className={oauthButtonClass}
        >
          <FaGoogle className="h-[18px] w-[18px] shrink-0" aria-hidden />
          {googlePending ? "Abriendo Google..." : "Continuar con Google"}
        </button>
      ) : (
        <a href="/auth/google" className={oauthButtonClass}>
          <FaGoogle className="h-[18px] w-[18px] shrink-0" aria-hidden />
          Continuar con Google
        </a>
      )}
      {googleError ? <p className={errorClass}>{googleError}</p> : null}
      {Capacitor.isNativePlatform() && !isIpadNative ? (
        <p className="text-center text-xs text-white/40">Si Google falla en la app, usá email y contraseña.</p>
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
  const useNativeOAuth = useCapacitorNativeOAuth();
  const [applePending, setApplePending] = useState(false);
  const [appleError, setAppleError] = useState<string | null>(null);

  if (!show) return null;

  async function openAppleNative() {
    setApplePending(true);
    setAppleError(null);

    try {
      const result = await startNativeAppleOAuth();
      if (!result.ok) {
        setAppleError(result.message);
      }
    } catch {
      setAppleError("No se pudo abrir Apple. Intentá de nuevo.");
    } finally {
      setApplePending(false);
    }
  }

  if (useNativeOAuth) {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => void openAppleNative()}
          disabled={applePending}
          className={oauthButtonClass}
        >
          <FaApple className="h-5 w-5 shrink-0" aria-hidden />
          {applePending ? "Abriendo Apple..." : "Continuar con Apple"}
        </button>
        {appleError ? <p className={errorClass}>{appleError}</p> : null}
      </div>
    );
  }

  return (
    <a href="/auth/apple" className={oauthButtonClass}>
      <FaApple className="h-5 w-5 shrink-0" aria-hidden />
      Continuar con Apple
    </a>
  );
}

function LoginForm({
  onOtpRequired,
  notice,
  defaultEmail = "",
  next,
}: {
  onOtpRequired: (email: string) => void;
  notice?: string | null;
  defaultEmail?: string;
  next?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="auth-email-form space-y-4"
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
      {notice ? <p className={noticeClass}>{notice}</p> : null}

      {next ? <input type="hidden" name="next" value={next} /> : null}

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
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Iniciando sesión..." : "Iniciar sesión"}
        </button>
      </div>

      {error ? <p className={errorClass}>{error}</p> : null}
    </form>
  );
}

function RegisterForm({
  onOtpRequired,
  onExistingAccount,
  next,
}: {
  onOtpRequired: (email: string) => void;
  onExistingAccount: (email: string) => void;
  next?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="auth-email-form space-y-4"
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
      {next ? <input type="hidden" name="next" value={next} /> : null}

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
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Creando cuenta..." : "Crear mi cuenta"}
        </button>
      </div>

      {error ? <p className={errorClass}>{error}</p> : null}
    </form>
  );
}

function OtpForm({
  email,
  onBack,
  next,
}: {
  email: string;
  onBack: () => void;
  next?: string;
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
      className="auth-email-form space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        setSuccessMessage(null);
        startVerifyTransition(async () => {
          const formData = new FormData();
          formData.set("email", email);
          formData.set("token", token);
          if (next) formData.set("next", next);
          const result = await verifyOtpCode(formData);
          if (!result.success) {
            setError(result.message);
          }
        });
      }}
    >
      <div className="space-y-1">
        <h3 className="text-xl font-semibold tracking-tight text-white">Revisá tu email</h3>
        <p className="text-sm text-white/60">
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
          className="w-full rounded-xl border border-white/15 bg-white/[0.08] px-6 py-5 text-center text-3xl tracking-[0.35em] text-white placeholder:text-white/30 outline-none focus:border-[#0085FC]"
        />
      </div>

      <div className="pt-2">
        <button type="submit" disabled={verifyPending} className={primaryButtonClass}>
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
        className={linkButtonClass}
      >
        {cooldown > 0 ? `Reenviar en ${cooldown}s...` : resendPending ? "Reenviando..." : "Reenviar código"}
      </button>

      <button type="button" onClick={onBack} className={linkButtonClass}>
        Volver
      </button>

      {error ? <p className={errorClass}>{error}</p> : null}
      {successMessage ? <p className={successClass}>{successMessage}</p> : null}
    </form>
  );
}

export function EmailAuthForm({
  next,
  isLogin,
  onModeChange,
}: {
  next?: string;
  isLogin: boolean;
  onModeChange: (isLogin: boolean) => void;
}) {
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
          next={next}
          onBack={() => setOtpState({ active: false, email: "" })}
        />
      ) : isLogin ? (
        <LoginForm
          notice={loginNotice}
          defaultEmail={loginEmailPrefill}
          next={next}
          onOtpRequired={(email) => {
            setLoginNotice(null);
            setOtpState({ active: true, email });
          }}
        />
      ) : (
        <RegisterForm
          next={next}
          onOtpRequired={(email) => setOtpState({ active: true, email })}
          onExistingAccount={(email) => {
            onModeChange(true);
            setLoginEmailPrefill(email);
            setLoginNotice(EXISTING_ACCOUNT_LOGIN_MESSAGE);
          }}
        />
      )}

      {!otpState.active ? (
        <button
          type="button"
          onClick={() => {
            onModeChange(!isLogin);
            setLoginNotice(null);
            setLoginEmailPrefill("");
          }}
          className={linkButtonClass}
        >
          {isLogin ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Iniciá sesión"}
        </button>
      ) : null}
    </div>
  );
}
