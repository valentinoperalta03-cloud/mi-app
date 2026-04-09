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

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message, kind } = await searchParams;
  const text = displayMessage(message);
  const isError = kind === "error" || (Boolean(text) && kind !== "info");

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-[hsl(var(--background))] px-4 py-8 pb-24">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-2xl font-bold text-white shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
        P
      </div>

      <h1 className="text-center text-2xl font-bold text-slate-900">
        Crear cuenta
      </h1>
      <p className="text-center text-base text-slate-500">
        Unite a la comunidad de padel
      </p>

      {text ? (
        <p
          role="alert"
          className={
            isError
              ? "mx-auto w-full rounded-[24px] border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-800"
              : "mx-auto w-full rounded-[24px] border border-sky-200 bg-sky-50 px-5 py-3 text-sm text-sky-800"
          }
        >
          {text}
        </p>
      ) : null}

      <div className="space-y-3">
        <GoogleAuthForm />
        <button type="button" className="ui-btn-ghost w-full bg-white" disabled>
          Continuar con Apple
        </button>
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-400">
        <span className="h-px flex-1 bg-slate-300" />
        <span>o con email</span>
        <span className="h-px flex-1 bg-slate-300" />
      </div>

      <EmailAuthForm />
    </main>
  );
}
