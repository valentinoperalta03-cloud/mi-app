import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

const profileActions = ["Mi Progresion", "Editar perfil", "Ver actividad", "Pagos", "Ajustes"];

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "Invitado sin sesion";

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-slate-50 px-4 pb-24 pt-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-5 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-500 text-2xl font-bold text-white">
          {(email[0] ?? "U").toUpperCase()}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Tu perfil</h1>
        <p className="mt-1 text-sm text-slate-500">{email}</p>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Modo desarrollador</h2>
        <p className="mt-1 text-sm text-slate-500">Acceso rapido para testear ambos portales.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/inicio" className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white">
            Ir a vista Jugador
          </Link>
          <Link href="/admin/gestion" className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
            Ir a Admin
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        {profileActions.map((item) => (
          <button
            key={item}
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white p-5 text-left"
          >
            <span className="text-xl font-semibold text-slate-900">{item}</span>
            <span className="text-slate-400">›</span>
          </button>
        ))}
      </section>
    </main>
  );
}
