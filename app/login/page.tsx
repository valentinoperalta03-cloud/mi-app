import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ message?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { message } = await searchParams;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-sky-100 bg-white p-8 shadow-xl shadow-sky-100/70">
        <h1 className="text-center text-3xl font-bold text-sky-600">
          Iniciar sesión
        </h1>
        <p className="mt-2 text-center text-sm text-sky-700/80">
          Volvé a la cancha
        </p>

        {message ? (
          <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
            {message}
          </p>
        ) : null}

        <form action={signInWithGoogle} className="mt-6">
          <button
            type="submit"
            className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white transition hover:bg-sky-600"
          >
            Continuar con Google
          </button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-sky-400">
          <span className="h-px flex-1 bg-sky-100" />
          <span>o con email</span>
          <span className="h-px flex-1 bg-sky-100" />
        </div>

        <form className="space-y-3">
          <input
            type="email"
            name="email"
            placeholder="Correo electrónico"
            required
            className="w-full rounded-2xl border border-sky-200 px-4 py-3 outline-none ring-sky-300 transition focus:ring-2"
          />
          <input
            type="password"
            name="password"
            placeholder="Contraseña"
            required
            className="w-full rounded-2xl border border-sky-200 px-4 py-3 outline-none ring-sky-300 transition focus:ring-2"
          />
          <button
            type="submit"
            formAction={signInWithEmail}
            className="w-full rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white transition hover:bg-sky-600"
          >
            Entrar
          </button>
          <button
            type="submit"
            formAction={signUpWithEmail}
            className="w-full rounded-2xl border border-sky-300 px-4 py-3 font-semibold text-sky-700 transition hover:bg-sky-50"
          >
            Registrate
          </button>
        </form>
      </div>
    </main>
  );
}
