"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/utils/supabase/client";
import { resendOtpCode, signInWithEmail, signUpWithEmail, verifyOtpCode } from "./actions";

const inputClass =
  "w-full rounded-2xl border border-slate-200/90 bg-white/60 px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-[#0585FC] focus:bg-white focus:shadow-[0_0_0_3px_rgba(56,189,248,0.22)]";

const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400";

export function GoogleAuthForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    setPending(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (oauthError) {
      setError(formatAuthErrorMessage(oauthError.message));
      setPending(false);
      return;
    }

    if (data.url) {
      window.location.assign(data.url);
      return;
    }

    setError("No se pudo iniciar sesion con Google.");
    setPending(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void handleGoogleSignIn()}
        disabled={pending}
        className="w-full rounded-2xl border border-slate-200/90 bg-white/80 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {pending ? "Abriendo Google..." : "Continuar con Google"}
      </button>
      {error ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 text-sm font-medium text-rose-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EmailSubmitButton({
  formAction,
  idleLabel,
  busyLabel,
  variant,
}: {
  formAction: (formData: FormData) => void;
  idleLabel: string;
  busyLabel: string;
  variant: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();
  const base =
    "w-full rounded-2xl py-4 text-[15px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55";
  const primary =
    "bg-gradient-to-b from-[#0585FC] to-[#0461C4] text-white shadow-[0_4px_16px_-4px_rgba(2,132,199,0.45)] hover:from-[#0585FC] hover:to-[#0461C4] hover:shadow-[0_6px_22px_-4px_rgba(2,132,199,0.5)] active:scale-[0.99]";
  const ghost =
    "mt-1 text-[#0585FC] hover:bg-[#0585FC]/5/90 active:scale-[0.99]";

  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={`${base} ${variant === "primary" ? primary : ghost}`}
    >
      {pending ? busyLabel : idleLabel}
    </button>
  );
}

function LoginForm() {
  return (
    <form className="space-y-4">
      <div>
        <label htmlFor="login-email" className={labelClass}>
          Correo electrónico
        </label>
        <input
          id="login-email"
          type="email"
          name="email"
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
        <EmailSubmitButton
          formAction={signInWithEmail}
          idleLabel="Iniciar sesión"
          busyLabel="Iniciando sesión..."
          variant="primary"
        />
      </div>
    </form>
  );
}

function RegisterForm({ onOtpRequired }: { onOtpRequired: (email: string) => void }) {
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
        <label htmlFor="login-email" className={labelClass}>
          Correo electrónico
        </label>
        <input
          id="login-email"
          type="email"
          name="email"
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
          {pending ? "Creando cuenta..." : "Crear mi cuenta"}
        </button>
      </div>

      {error ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 text-sm font-medium text-rose-800">
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
        <h3 className="text-xl font-semibold tracking-tight text-slate-900">Revisá tu email</h3>
        <p className="text-sm text-slate-500">Te enviamos un código de 6 dígitos a {email}</p>
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
        className="mt-1 w-full rounded-2xl py-4 text-[15px] font-semibold text-[#0585FC] transition-all duration-200 hover:bg-[#0585FC]/5/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
      >
        {cooldown > 0 ? `Reenviar en ${cooldown}s...` : resendPending ? "Reenviando..." : "Reenviar código"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="mt-1 w-full rounded-2xl py-4 text-[15px] font-semibold text-[#0585FC] transition-all duration-200 hover:bg-[#0585FC]/5/90 active:scale-[0.99]"
      >
        Volver
      </button>

      {error ? (
        <p className="rounded-2xl border border-rose-200/80 bg-rose-50/90 px-3 py-2.5 text-sm font-medium text-rose-800">
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2.5 text-sm font-medium text-emerald-800">
          {successMessage}
        </p>
      ) : null}
    </form>
  );
}

export function EmailAuthForm() {
  const [isLogin, setIsLogin] = useState(true);
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
        <LoginForm />
      ) : (
        <RegisterForm onOtpRequired={(email) => setOtpState({ active: true, email })} />
      )}

      {!otpState.active ? (
        <button
          type="button"
          onClick={() => setIsLogin((prev) => !prev)}
          className="w-full rounded-2xl py-4 text-[15px] font-semibold text-[#0585FC] transition-all duration-200 hover:bg-[#0585FC]/5/90 active:scale-[0.99]"
        >
          {isLogin ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Iniciá sesión"}
        </button>
      ) : null}
    </div>
  );
}
