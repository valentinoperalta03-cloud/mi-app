"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { formatAuthErrorMessage } from "@/lib/auth-errors";
import { createClient } from "@/utils/supabase/client";
import { signInWithEmail, signUpWithEmail } from "./actions";

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
        className="ui-btn-ghost w-full bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Abriendo Google..." : "Continuar con Google"}
      </button>
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
  className,
}: {
  formAction: (formData: FormData) => void;
  idleLabel: string;
  busyLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? busyLabel : idleLabel}
    </button>
  );
}

export function EmailAuthForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-600">Nombre</label>
        <input
          type="text"
          name="full_name"
          placeholder="Tu nombre"
          required
          autoComplete="name"
          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none ring-blue-300 transition-all focus:ring-2"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-600">
          Correo electronico
        </label>
        <input
          type="email"
          name="email"
          placeholder="tu@email.com"
          required
          autoComplete="email"
          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none ring-blue-300 transition-all focus:ring-2"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-600">
          Contrasena
        </label>
        <input
          type="password"
          name="password"
          placeholder="Minimo 6 caracteres"
          required
          minLength={6}
          autoComplete="current-password"
          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none ring-blue-300 transition-all focus:ring-2"
        />
      </div>

      <EmailSubmitButton
        formAction={signUpWithEmail}
        idleLabel="Crear mi cuenta"
        busyLabel="Creando cuenta..."
        className="ui-btn-primary w-full"
      />
      <EmailSubmitButton
        formAction={signInWithEmail}
        idleLabel="Ya tenes cuenta? Inicia sesion"
        busyLabel="Iniciando sesion..."
        className="w-full text-center text-sm font-semibold text-blue-600 transition-all hover:opacity-95 active:scale-95"
      />
    </form>
  );
}
