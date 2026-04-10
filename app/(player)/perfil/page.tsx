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
  const adminEmail =
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ??
    process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ??
    "";
  const isAdmin = Boolean(adminEmail) && email.toLowerCase() === adminEmail;

  const { data: profile } = user
    ? await supabase
        .from(DB_TABLES.profiles)
        .select("name, level")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const displayName = profile?.name ?? email;
  const initial = (displayName[0] ?? "U").toUpperCase();

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md space-y-7 bg-transparent px-4 pb-24 pt-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 ring-4 ring-sky-100">
          <span className="text-3xl font-semibold tracking-tight text-white">{initial}</span>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
          {profile?.name ?? "Tu perfil"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{email}</p>
        {profile?.level ? (
          <p className="mt-3 inline-flex rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm font-medium text-sky-700">
            Nivel: {profile.level}
          </p>
        ) : null}
      </section>

      {isAdmin ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Modo desarrollador</h2>
          <p className="mt-1 text-sm text-slate-500">
            Si sos <code className="text-xs">owner_id</code> de un club, el inicio te lleva al
            panel admin.
          </p>
          <div className="mt-4 flex gap-2">
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
      ) : null}

      <section className="space-y-4">
        {profileActions.map((item) => (
          <button
            key={item}
            type="button"
            className="flex w-full items-center justify-between rounded-3xl border border-slate-200 bg-white px-5 py-5 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition-all duration-300 hover:border-sky-200 hover:shadow-[0_16px_34px_rgba(14,116,144,0.10)] active:scale-[0.99]"
          >
            <span className="text-lg font-medium tracking-tight text-slate-900">
              {item}
            </span>
            <span className="text-xl font-semibold text-sky-500">›</span>
          </button>
        ))}
      </section>
    </MotionPage>
  );
}
