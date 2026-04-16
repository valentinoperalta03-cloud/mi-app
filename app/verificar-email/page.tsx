"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { resendEmailOtp, verifyEmailOtp } from "./actions";

const inputClass =
  "w-full rounded-2xl border border-slate-200/90 bg-white/60 px-4 py-3.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-200 focus:border-sky-400 focus:bg-white focus:shadow-[0_0_0_3px_rgba(56,189,248,0.22)]";

export default function VerificarEmailPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(30);
  const [verifyPending, startVerifyTransition] = useTransition();
  const [resendPending, startResendTransition] = useTransition();
  const [signOutPending, setSignOutPending] = useState(false);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setEmail(data.user?.email ?? "");
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center bg-slate-50 px-4 py-10">
      <section className="w-full space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <div className="text-5xl leading-none">📧</div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Verificá tu email</h1>
          <p className="text-sm text-slate-500">
            Te enviamos un código de 6 dígitos. Revisá tu bandeja de entrada.
          </p>
          {email ? <p className="text-sm font-medium text-slate-700">{email}</p> : null}
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setSuccessMessage(null);
            startVerifyTransition(async () => {
              const result = await verifyEmailOtp(email, token);
              if (!result.success) {
                setError(result.message);
              }
            });
          }}
        >
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]*"
            value={token}
            onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            required
            className={`${inputClass} px-6 py-5 text-center text-3xl tracking-[0.35em]`}
          />

          <button
            type="submit"
            disabled={verifyPending || token.length !== 6}
            className="w-full rounded-2xl bg-gradient-to-b from-sky-500 to-sky-600 py-4 text-[15px] font-semibold text-white shadow-[0_4px_16px_-4px_rgba(2,132,199,0.45)] transition-all duration-200 hover:from-sky-400 hover:to-sky-500 hover:shadow-[0_6px_22px_-4px_rgba(2,132,199,0.5)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {verifyPending ? "Verificando..." : "Verificar código"}
          </button>
        </form>

        <button
          type="button"
          disabled={cooldown > 0 || resendPending || !email}
          onClick={() => {
            setError(null);
            setSuccessMessage(null);
            startResendTransition(async () => {
              const result = await resendEmailOtp(email);
              if (!result.success) {
                setError(result.message);
                return;
              }
              setSuccessMessage("Código reenviado. Revisá tu bandeja de entrada.");
              setCooldown(30);
            });
          }}
          className="mt-1 w-full rounded-2xl py-4 text-[15px] font-semibold text-sky-600 transition-all duration-200 hover:bg-sky-50/90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {cooldown > 0 ? `Reenviar en ${cooldown}s...` : resendPending ? "Reenviando..." : "Reenviar código"}
        </button>

        <button
          type="button"
          disabled={signOutPending}
          onClick={() => {
            setSignOutPending(true);
            const supabase = createClient();
            void supabase.auth.signOut().finally(() => {
              router.replace("/login");
            });
          }}
          className="mx-auto block rounded-2xl px-4 py-2 text-sm font-semibold text-slate-500 transition-all duration-200 hover:bg-slate-100"
        >
          {signOutPending ? "Cerrando sesión..." : "Cerrar sesión"}
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
      </section>
    </main>
  );
}
