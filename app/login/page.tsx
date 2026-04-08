import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message } = await searchParams;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-slate-100 px-5 py-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-600 text-2xl font-bold text-white shadow-sm">
        P
      </div>

      <h1 className="mt-6 text-center text-4xl font-extrabold text-slate-900">
        Crear cuenta
      </h1>
      <p className="mt-2 text-center text-lg text-slate-500">
        Unite a la comunidad de padel
      </p>

      {message ? (
        <p className="mx-auto mt-5 w-full rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
          {message}
        </p>
      ) : null}

      <div className="mt-7 space-y-3">
        <form action={signInWithGoogle}>
          <button type="submit" className="ui-btn-ghost w-full bg-white">
            Continuar con Google
          </button>
        </form>
        <button type="button" className="ui-btn-ghost w-full bg-white">
          Continuar con Apple
        </button>
      </div>

      <div className="my-8 flex items-center gap-3 text-sm text-slate-400">
        <span className="h-px flex-1 bg-slate-300" />
        <span>o con email</span>
        <span className="h-px flex-1 bg-slate-300" />
      </div>

      <form className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-600">
            Correo electronico
          </label>
          <input
            type="email"
            name="email"
            placeholder="tu@email.com"
            required
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-blue-300 transition focus:ring-2"
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
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none ring-blue-300 transition focus:ring-2"
          />
        </div>

        <button type="submit" formAction={signUpWithEmail} className="ui-btn-primary w-full">
          Crear mi cuenta
        </button>
        <button type="submit" formAction={signInWithEmail} className="w-full text-center text-sm font-semibold text-blue-600">
          Ya tenes cuenta? Inicia sesion
        </button>
      </form>
    </main>
  );
}
