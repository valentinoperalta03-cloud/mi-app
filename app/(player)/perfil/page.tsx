import { Building2, User } from "lucide-react";
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
import { formatProfileNivelFromRow, getProfileLevelParts } from "@/lib/profile-display";
import { fetchFinishedMatchActivity } from "@/lib/player-match-history";
import {
  fetchLevelEvolutionSeries,
  fetchProfileMatchCards,
  fetchTopClubsByReservations,
  fetchTopCoplayers,
} from "@/lib/profile-insights";
import { ensureProfileRowExists } from "@/lib/profiles";
import SuperadminEntryLink from "@/components/superadmin/superadmin-entry-link";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const PROFILE_SELECT =
  "name, bio, level, level_of_play, technical_score, age, avatar_url, category, is_leveled, onboarding_completed, preferred_hand, court_position, preferred_schedule" as const;

const USER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (typeof user.id !== "string" || !USER_ID_RE.test(user.id)) {
    redirect("/login");
  }

  const userId = user.id;

  const email = user.email ?? "Invitado sin sesion";
  const adminEmail =
    process.env.ADMIN_EMAIL?.trim().toLowerCase() ??
    process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() ??
    "";
  const isAdmin = Boolean(adminEmail) && email.toLowerCase() === adminEmail;

  let { data: profile, error: profileError } = await supabase
    .from(DB_TABLES.profiles)
    .select(PROFILE_SELECT)
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return (
      <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-[var(--bg-app)] px-4 pb-24 pt-6">
        <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          <p className="font-medium">No pudimos cargar tu perfil.</p>
          <p className="mt-2 text-xs text-rose-800/90">
            {profileError.code ? `${profileError.code}: ` : ""}
            {profileError.message}
          </p>
          <p className="mt-3 text-xs text-rose-700/80">
            Si ves PGRST116, hay más de una fila para tu usuario. Con 0 filas y sin error, debería crearse
            el perfil automáticamente.
          </p>
        </div>
      </MotionPage>
    );
  }

  // maybeSingle(): 0 filas → data null y error null (no es “array vacío”). Falta de fila: creamos perfil mínimo y reintentamos.
  if (profile === null) {
    const ensured = await ensureProfileRowExists(supabase, user);
    if (ensured.error) {
      return (
        <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-[var(--bg-app)] px-4 pb-24 pt-6">
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            <p className="font-medium">No hay fila en perfiles para tu cuenta.</p>
            <p className="mt-2 text-xs text-rose-800/90">{ensured.error}</p>
          </div>
        </MotionPage>
      );
    }
    const retry = await supabase
      .from(DB_TABLES.profiles)
      .select(PROFILE_SELECT)
      .eq("user_id", userId)
      .maybeSingle();
    profile = retry.data;
    profileError = retry.error;
    if (profileError || profile === null) {
      return (
        <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 bg-[var(--bg-app)] px-4 pb-24 pt-6">
          <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
            <p className="font-medium">No se pudo leer el perfil después de crearlo.</p>
            {profileError ? (
              <p className="mt-2 text-xs text-rose-800/90">
                {profileError.code ? `${profileError.code}: ` : ""}
                {profileError.message}
              </p>
            ) : null}
          </div>
        </MotionPage>
      );
    }
  }

  const row = profile as ProfileRow & {
    category?: string | null;
    is_leveled?: boolean | null;
    onboarding_completed?: boolean | null;
    preferred_hand?: string | null;
    court_position?: string | null;
    preferred_schedule?: string | null;
  };
  if (row.onboarding_completed !== true) {
    redirect("/onboarding");
  }
  const isLeveled =
    (row?.level != null && Number.isFinite(Number(row.level))) ||
    Boolean(row?.level_of_play?.trim()) ||
    row?.is_leveled === true;
  const displayName = row?.name?.trim() || "Tu perfil";
  const levelParts = getProfileLevelParts(row);
  const nivelLine = formatProfileNivelFromRow(row);

  if (!isLeveled) {
    return (
      <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-2 bg-[var(--bg-app)] px-4 pb-24 pt-6">
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
  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from(DB_TABLES.userFavorites)
      .select("user_id", { count: "exact", head: true })
      .eq("favorite_user_id", userId),
    supabase
      .from(DB_TABLES.userFavorites)
      .select("user_id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-5 bg-[var(--bg-app)] px-4 pb-24 pt-6">
      <ProfileMotionSurface animateOnMount>
        <div className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] px-5 py-6">

          {/* Avatar + editar + badge categoría */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                avatarUrl={row?.avatar_url ?? null}
                name={displayName}
                size={72}
                ringClassName="ring-2 ring-[var(--border-subtle)]"
              />
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{displayName}</h1>
                {levelParts ? (
                  <span
                    className="mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-widest"
                    style={{ background: "#CCFF00", color: "#000" }}
                  >
                    {levelParts.category}
                  </span>
                ) : (
                  <p className="mt-0.5 text-sm font-semibold text-[var(--text-secondary)]">{nivelLine}</p>
                )}
              </div>
            </div>
            <Link
              href="/perfil/editar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] transition active:scale-95"
              aria-label="Editar perfil"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </Link>
          </div>

          {/* Barra de progreso */}
          {levelParts ? (
            <div className="mt-5 space-y-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                <div
                  className="h-full rounded-full transition-[width]"
                  style={{ width: `${levelParts.progressInEloUnit}%`, background: "#CCFF00" }}
                />
              </div>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                {levelParts.progressInEloUnit}% hacia la siguiente categoría
              </p>
            </div>
          ) : null}

          {/* Bio */}
          {row?.bio?.trim() ? (
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">{row.bio.trim()}</p>
          ) : null}

          {/* Seguidores / Siguiendo */}
          <div className="mt-5 flex gap-6 border-t border-[var(--border-subtle)] pt-4">
            <div>
              <p className="text-base font-black text-[var(--text-primary)]">{followersCount ?? 0}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Seguidores</p>
            </div>
            <div>
              <p className="text-base font-black text-[var(--text-primary)]">{followingCount ?? 0}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Siguiendo</p>
            </div>
          </div>

        </div>
      </ProfileMotionSurface>

      <SuperadminEntryLink />

      {isAdmin ? (
        <section className="rounded-[2.5rem] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Modo desarrollador</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Si sos <code className="text-xs">owner_id</code> de un club, el inicio te lleva al panel
            admin.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/home"
              className="btn-primary-gradient rounded-2xl px-4 py-2.5 text-sm font-medium transition hover:brightness-95"
            >
              Ir a vista Jugador
            </Link>
            <Link
              href="/admin/dashboard"
              className="rounded-2xl border border-[var(--border-subtle)] bg-transparent px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)]"
            >
              Ir a Admin
            </Link>
          </div>
        </section>
      ) : null}

      <ProfileMotionSection
        title="Evolución de nivel"
        description="Progreso según nivelación inicial y partidos jugados."
      >
        <LevelEvolutionChart points={evolution} />
      </ProfileMotionSection>

      <ProfileMotionSection title="Partidos" description="Tus últimos resultados.">
        <ProfileMatchCardsPremium cards={matchCards} showViewAll />
      </ProfileMotionSection>

      <ProfileMotionSection title="Datos" description="Información de tu perfil.">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-4">
          <User className="h-5 w-5 shrink-0 text-[#0585FC]" strokeWidth={1.6} aria-hidden />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Edad</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">
              {row.age != null && row.age > 0 ? `${row.age} años` : "—"}
            </p>
          </div>
        </div>
      </ProfileMotionSection>

      <ProfileMotionSection
        title="Personas con las que más jugás"
        description="Según partidos recientes."
      >
        {coplayers.length === 0 ? (
          <p className="text-sm text-[var(--text-tertiary)]">Todavía no hay datos suficientes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {coplayers.map((p) => (
              <li key={p.user_id}>
                <Link
                  href={`/jugador/${p.user_id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2.5 transition hover:bg-[var(--bg-subtle)]"
                >
                  <ProfileAvatar avatarUrl={p.avatar_url} name={p.name} size={44} ringClassName="ring-2 ring-[var(--bg-subtle)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--text-primary)]">{p.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
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
          <p className="text-sm text-[var(--text-tertiary)]">Creá reservas para ver tendencias aquí.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {clubs.map((c) => (
              <li key={c.club_id}>
                <Link
                  href={`/clubes/${c.club_id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3 transition hover:bg-[var(--bg-subtle)]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Building2 className="h-4 w-4 shrink-0 text-[#0585FC]" strokeWidth={1.6} />
                    <span className="truncate text-sm font-medium text-[var(--text-primary)]">{c.name}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--text-secondary)] ring-1 ring-[var(--border-subtle)]">
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
