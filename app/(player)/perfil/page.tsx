import { Building2, Clock, Columns2, Hand } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { LevelEvolutionChart } from "@/components/profile/level-evolution-chart";
import { ProfileLevelingWizard } from "@/components/profile/profile-leveling-wizard";
import {
  ProfileMotionSection,
  ProfileMotionSurface,
} from "@/components/profile/profile-motion-section";
import { ProfileMatchCardsPremium } from "@/components/profile/profile-match-cards-premium";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ProfileActivityClient } from "@/components/profile-activity-client";
import { ProfileSessionFooter } from "@/components/profile-session-footer";
import type { ProfileRow } from "@/lib/database.types";
import { DB_TABLES } from "@/lib/db-tables";
import { formatProfileNivel } from "@/lib/profile-display";
import { fetchFinishedMatchActivity } from "@/lib/player-match-history";
import {
  fetchLevelEvolutionSeries,
  fetchProfileMatchCards,
  fetchTopClubsByReservations,
  fetchTopCoplayers,
} from "@/lib/profile-insights";
import { createClient } from "@/utils/supabase/server";

function labelHand(v: string | null | undefined): string {
  if (v === "derecha") return "Derecha";
  if (v === "izquierda") return "Izquierda";
  return "—";
}

function labelPosition(v: string | null | undefined): string {
  if (v === "drive") return "Drive";
  if (v === "reves") return "Revés";
  return "—";
}

function labelSchedule(v: string | null | undefined): string {
  const m: Record<string, string> = {
    manana: "Mañana",
    mediodia: "Mediodía",
    tarde: "Tarde",
    noche: "Noche",
  };
  return v && m[v] ? m[v] : "—";
}

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

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select(
      "name, category, level, avatar_url, is_leveled, dominant_hand, play_position, play_schedule, base_level"
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const row = profile as ProfileRow | null;
  const isLeveled = row?.is_leveled === true;
  const displayName = row?.name?.trim() || email.split("@")[0] || "Tu perfil";
  const nivelLine = formatProfileNivel(row?.category, row?.level);

  if (!isLeveled) {
    return (
      <MotionPage className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-2 bg-slate-50 px-4 pb-28 pt-6">
        <ProfileLevelingWizard />
        <ProfileSessionFooter />
      </MotionPage>
    );
  }

  const [activities, evolution, matchCards, coplayers, clubs] = await Promise.all([
    fetchFinishedMatchActivity(supabase, user.id),
    fetchLevelEvolutionSeries(supabase, user.id),
    fetchProfileMatchCards(supabase, user.id, 3),
    fetchTopCoplayers(supabase, user.id, 5),
    fetchTopClubsByReservations(supabase, user.id, 5),
  ]);

  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 bg-slate-50 px-4 pb-28 pt-6">
      <ProfileMotionSurface animateOnMount>
        <div className="flex flex-col items-center text-center">
          <div className="mx-auto w-fit">
            <ProfileAvatar
              avatarUrl={row?.avatar_url ?? null}
              name={displayName}
              size={96}
              ringClassName="ring-[6px] ring-slate-100"
            />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">{displayName}</h1>
          <p className="mt-1 text-sm text-slate-500">{email}</p>
          <p className="mt-3 text-sm font-medium text-slate-700">{nivelLine}</p>
          <Link
            href="/perfil/editar"
            className="mt-6 inline-flex w-full max-w-xs items-center justify-center rounded-2xl bg-slate-900 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99]"
          >
            Editar perfil
          </Link>
        </div>
      </ProfileMotionSurface>

      {isAdmin ? (
        <section className="rounded-[2.5rem] border border-slate-200/60 bg-white p-6 shadow-[0_2px_24px_-8px_rgba(15,23,42,0.06)]">
          <h2 className="text-base font-semibold text-slate-900">Modo desarrollador</h2>
          <p className="mt-1 text-sm text-slate-500">
            Si sos <code className="text-xs">owner_id</code> de un club, el inicio te lleva al panel
            admin.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/home"
              className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500"
            >
              Ir a vista Jugador
            </Link>
            <Link
              href="/admin/gestion"
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Ir a Admin
            </Link>
          </div>
        </section>
      ) : null}

      <ProfileMotionSection
        title="Evolución de nivel"
        description="Progreso según tus evaluaciones registradas."
      >
        <LevelEvolutionChart points={evolution} />
      </ProfileMotionSection>

      <ProfileMotionSection title="Partidos" description="Tus últimos resultados.">
        <ProfileMatchCardsPremium cards={matchCards} showViewAll />
      </ProfileMotionSection>

      <ProfileMotionSection title="Ficha técnica" description="Preferencias de juego.">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="flex flex-col items-center rounded-2xl bg-slate-50/90 px-2 py-4 text-center sm:px-3">
            <Hand className="h-5 w-5 text-sky-600" strokeWidth={1.6} aria-hidden />
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Mano
            </span>
            <span className="mt-1 text-sm font-medium text-slate-900">
              {labelHand(row?.dominant_hand)}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-slate-50/90 px-2 py-4 text-center sm:px-3">
            <Columns2 className="h-5 w-5 text-sky-600" strokeWidth={1.6} aria-hidden />
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Posición
            </span>
            <span className="mt-1 text-sm font-medium text-slate-900">
              {labelPosition(row?.play_position)}
            </span>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-slate-50/90 px-2 py-4 text-center sm:px-3">
            <Clock className="h-5 w-5 text-sky-600" strokeWidth={1.6} aria-hidden />
            <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Horario
            </span>
            <span className="mt-1 text-sm font-medium text-slate-900">
              {labelSchedule(row?.play_schedule)}
            </span>
          </div>
        </div>
      </ProfileMotionSection>

      <ProfileMotionSection
        title="Personas con las que más jugás"
        description="Según partidos recientes."
      >
        {coplayers.length === 0 ? (
          <p className="text-sm text-slate-400">Todavía no hay datos suficientes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {coplayers.map((p) => (
              <li key={p.user_id}>
                <Link
                  href={`/jugador/${p.user_id}`}
                  className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-3 py-2.5 transition hover:border-slate-200 hover:bg-white"
                >
                  <ProfileAvatar avatarUrl={p.avatar_url} name={p.name} size={44} ringClassName="ring-2 ring-white" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.sharedMatches} partido{p.sharedMatches === 1 ? "" : "s"} en común
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ProfileMotionSection>

      <ProfileMotionSection title="Clubes favoritos" description="Donde más reservás canchas.">
        {clubs.length === 0 ? (
          <p className="text-sm text-slate-400">Creá reservas para ver tendencias aquí.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {clubs.map((c) => (
              <li key={c.club_id}>
                <Link
                  href={`/clubes/${c.club_id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition hover:border-slate-200 hover:bg-white"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-sky-600" strokeWidth={1.6} />
                    <span className="truncate text-sm font-medium text-slate-900">{c.name}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-100">
                    {c.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </ProfileMotionSection>

      <ProfileMotionSection title="Actividad" description="Últimos movimientos en la app.">
        <ProfileActivityClient activities={activities} />
      </ProfileMotionSection>

      <ProfileSessionFooter />
    </MotionPage>
  );
}
