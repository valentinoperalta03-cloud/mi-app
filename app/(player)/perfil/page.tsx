import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ProfileActivityClient } from "@/components/profile-activity-client";
import { ProfileSessionFooter } from "@/components/profile-session-footer";
import { fetchFinishedMatchActivity } from "@/lib/player-match-history";
import { formatProfileNivel } from "@/lib/profile-display";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const email = user.email ?? "Invitado sin sesion";
  const adminEmail =
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ??
    process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ??
    "";
  const isAdmin = Boolean(adminEmail) && email.toLowerCase() === adminEmail;

  const [{ data: profile }, activities] = await Promise.all([
    supabase
      .from(DB_TABLES.profiles)
      .select("name, category, level, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle(),
    fetchFinishedMatchActivity(supabase, user.id),
  ]);

  const row = profile as {
    name: string | null;
    category: string | null;
    level: string | number | null;
    avatar_url: string | null;
  } | null;

  const displayName = row?.name?.trim() || email.split("@")[0] || "Tu perfil";
  const nivelLine = formatProfileNivel(row?.category, row?.level);

  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 bg-gradient-to-b from-slate-50 to-white px-4 pb-28 pt-6">
      <section className="rounded-3xl border border-slate-200/80 bg-white p-6 text-center shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <div className="mx-auto w-fit">
          <ProfileAvatar avatarUrl={row?.avatar_url ?? null} name={displayName} size={96} />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">{displayName}</h1>
        <p className="mt-1 text-sm text-slate-500">{email}</p>
        <p className="mt-2 text-sm font-semibold text-slate-700">{nivelLine}</p>

        <Link
          href="/perfil/editar"
          className="mt-5 inline-flex w-full items-center justify-center rounded-3xl bg-sky-600 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-500 active:scale-[0.99]"
        >
          Editar perfil
        </Link>
      </section>

      {isAdmin ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
          <h2 className="text-lg font-semibold text-slate-900">Modo desarrollador</h2>
          <p className="mt-1 text-sm text-slate-500">
            Si sos <code className="text-xs">owner_id</code> de un club, el inicio te lleva al panel
            admin.
          </p>
          <div className="mt-4 flex gap-2">
            <Link
              href="/home"
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

      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Actividad</h2>
        <ProfileActivityClient activities={activities} />
      </section>

      <ProfileSessionFooter />
    </MotionPage>
  );
}
