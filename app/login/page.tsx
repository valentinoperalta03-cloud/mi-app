import Image from "next/image";
import { LegalFooterLinks } from "@/components/legal-footer-links";
import { AppleAuthForm, EmailAuthForm, GoogleAuthForm } from "./auth-forms";

type LoginPageProps = {
  searchParams: Promise<{ message?: string; kind?: string }>;
};

function displayMessage(raw: string | undefined) {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function LoginMark() {
  return (
    <div className="mx-auto" aria-hidden>
      <Image src="/logo.png" alt="PadeLibre" width={56} height={56} className="rounded-2xl" />
    </div>
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message, kind } = await searchParams;
  const text = displayMessage(message);
  const isError = kind === "error" || (Boolean(text) && kind !== "info");

  return (
    <main className="login-page-main relative isolate flex min-h-dvh flex-col justify-center overflow-y-auto bg-[#F2F2F7] px-4 py-10 dark:bg-black sm:py-14">
      <div className="login-page-inner player-shell-inner mx-auto w-full px-4 md:max-w-2xl">
        <div className="login-page-card rounded-3xl border border-[var(--border-subtle)] bg-white p-8 shadow-[var(--shadow-card)] sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <LoginMark />
            <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
              Crear cuenta
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              Unite a la comunidad de pádel
            </p>
          </div>

          {text ? (
            <p
              role="alert"
              className={
                isError
                  ? "mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300"
                  : "mb-6 rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 px-4 py-3 text-sm font-medium text-[#0585FC] dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300"
              }
            >
              {text}
            </p>
          ) : null}

          <div className="space-y-3">
            <AppleAuthForm />
            <GoogleAuthForm />
          </div>

          <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200/90 dark:bg-slate-700" />
            <span className="shrink-0">o con email</span>
            <span className="h-px flex-1 bg-slate-200/90 dark:bg-slate-700" />
          </div>

          <EmailAuthForm />

          <LegalFooterLinks variant="login" className="mt-6" />
        </div>
      </div>
    </main>
  );
}
