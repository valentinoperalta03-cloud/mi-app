"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/utils/supabase/client";
import { signInWithEmail, signUpWithEmail } from "./actions";

const inputClass =
  "w-full rounded-2xl border border-slate-200/90 bg-white/60 px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-sky-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(56,189,248,0.22)]";

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
    "bg-gradient-to-b from-sky-500 to-sky-600 text-white shadow-[0_4px_16px_-4px_rgba(2,132,199,0.45)] hover:from-sky-400 hover:to-sky-500 hover:shadow-[0_6px_22px_-4px_rgba(2,132,199,0.5)] active:scale-[0.99]";
  const ghost =
    "mt-1 text-sky-600 hover:bg-sky-50/90 active:scale-[0.99]";

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

function RegisterForm() {
  return (
    <form className="space-y-4">
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
        <EmailSubmitButton
          formAction={signUpWithEmail}
          idleLabel="Crear mi cuenta"
          busyLabel="Creando cuenta..."
          variant="primary"
        />
      </div>
    </form>
  );
}

export function EmailAuthForm() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="space-y-3">
      {isLogin ? <LoginForm /> : <RegisterForm />}

      <button
        type="button"
        onClick={() => setIsLogin((prev) => !prev)}
        className="w-full rounded-2xl py-4 text-[15px] font-semibold text-sky-600 transition-all duration-200 hover:bg-sky-50/90 active:scale-[0.99]"
      >
        {isLogin ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Iniciá sesión"}
      </button>
    </div>
  );
}
