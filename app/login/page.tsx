import { EmailAuthForm, GoogleAuthForm } from "./auth-forms";

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
    <div
      className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-indigo-600 shadow-[0_4px_14px_-2px_rgba(2,132,199,0.35)] ring-4 ring-white/90"
      aria-hidden
    >
      <svg width="22" height="22" viewBox="0 0 32 32" fill="none" className="text-white">
        <rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
        <path d="M16 6v20M4 16h24" stroke="currentColor" strokeWidth="1.5" opacity="0.9" />
      </svg>
    </div>
  );
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message, kind } = await searchParams;
  const text = displayMessage(message);
  const isError = kind === "error" || (Boolean(text) && kind !== "info");

  return (
    <main className="relative isolate min-h-dvh bg-slate-50 px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-[26rem]">
        <div
          className="rounded-[2.5rem] border border-white/70 bg-white/65 p-8 shadow-[0_2px_20px_-4px_rgba(15,23,42,0.06),0_12px_48px_-16px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-10"
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <LoginMark />
            <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Crear cuenta
            </h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Unite a la comunidad de pádel
            </p>
          </div>

          {text ? (
            <p
              role="alert"
              className={
                isError
                  ? "mb-6 rounded-2xl border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm font-medium text-rose-800"
                  : "mb-6 rounded-2xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 text-sm font-medium text-sky-900"
              }
            >
              {text}
            </p>
          ) : null}

          <div className="space-y-3">
            <GoogleAuthForm />
            <button
              type="button"
              className="w-full cursor-not-allowed rounded-2xl border border-slate-200/60 bg-slate-50/80 py-3.5 text-sm font-semibold text-slate-400"
              disabled
            >
              Continuar con Apple
            </button>
          </div>

          <div className="my-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-slate-200/90" />
            <span className="shrink-0">o con email</span>
            <span className="h-px flex-1 bg-slate-200/90" />
          </div>

          <EmailAuthForm />
        </div>
      </div>
    </main>
  );
}
