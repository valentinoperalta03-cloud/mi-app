import Link from "next/link";
import MotionPage from "@/components/motion-page";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const profileActions = [
  "Mi progreso",
  "Editar perfil",
  "Ver actividad",
  "Pagos",
  "Ajustes",
];

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email ?? "Invitado sin sesion";

  const { data: profile } = user
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("name, level")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const displayName = profile?.name ?? email;

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-6 bg-transparent px-4 pb-24 pt-6">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 text-center shadow-sm">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-500 text-2xl font-bold text-white">
          {(displayName[0] ?? "U").toUpperCase()}
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-950">
          {profile?.name ?? "Tu perfil"}
        </h1>
        <p className="mt-1 text-sm font-light text-slate-500">{email}</p>
        {profile?.level ? (
          <p className="mt-2 text-sm font-medium text-sky-700">
            Nivel: {profile.level}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Modo desarrollador</h2>
        <p className="mt-1 text-sm font-light text-slate-500">
          Si sos <code className="text-xs">owner_id</code> de un club, el inicio te lleva al
          panel admin.
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href="/feed"
            className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-sky-500 active:scale-95"
          >
            Ir a vista Jugador
          </Link>
          <Link
            href="/admin/gestion"
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-all duration-300 hover:opacity-95 active:scale-95"
          >
            Ir a Admin
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        {profileActions.map((item) => (
          <button
            key={item}
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:scale-[1.02] hover:border-sky-200 hover:shadow-lg active:scale-95"
          >
            <span className="text-lg font-semibold tracking-tight text-slate-950">
              {item}
            </span>
            <span className="text-slate-400">›</span>
          </button>
        ))}
      </section>
    </MotionPage>
  );
}
