import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CirclePlus, GraduationCap, Search, Trophy, Zap } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { CompetitiveResultConfirmationCard } from "@/components/competitive-result-confirmation-card";
import { FriendRequestsSection } from "@/components/friend-requests-section";
import HomeJoinRequestsSection from "@/components/home-join-requests-section";
import { HomeReservationsSection } from "@/components/home-reservations-section";
import { HomeSuggestionsSection } from "@/components/home-suggestions-section";
import { HomeSummarySection } from "@/components/home-summary-section";
import {
  HomeReservationsSkeleton,
  HomeSuggestionsSkeleton,
  HomeSummarySkeleton,
} from "@/components/home-loading-skeletons";
import OnboardingSlides from "@/components/onboarding-slides";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const primaryActions = [
  {
    title: "Crear Partido",
    href: "/crear-partido",
    Icon: CirclePlus,
    desc: "Organizá un partido en segundos",
  },
  {
    title: "Buscar partido",
    desc: "Sumate a partidos abiertos",
    href: "/buscar-partido",
    Icon: Search,
  },
] as const;

const secondaryActions = [
  { title: "Aprender", href: "/clases", Icon: GraduationCap },
  { title: "Competir", href: "/torneos", Icon: Trophy },
] as const;

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const levelingDone =
    params.nivelacion === "ok" ||
    (Array.isArray(params.nivelacion) && params.nivelacion.includes("ok"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from(DB_TABLES.profiles)
    .select("name")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName =
    (profile as { name?: string | null } | null)?.name?.trim() || "Jugador";

  const { data: pendingRows } = await supabase
    .from(DB_TABLES.matchResults)
    .select("match_id, team_a_score, team_b_score, proposed_by, status")
    .eq("status", "pending_confirmation");
  const pending = (pendingRows ?? []) as Array<{
    match_id: string;
    team_a_score: number | null;
    team_b_score: number | null;
    proposed_by?: string | null;
    status?: string | null;
  }>;

  let pendingForMe: typeof pending = [];
  if (pending.length > 0) {
    const matchIds = pending.map((r) => r.match_id);
    const { data: myParticipations } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("match_id, player_id")
      .eq("player_id", user.id)
      .in("match_id", matchIds);
    const mine = new Set((myParticipations ?? []).map((r: { match_id: string }) => r.match_id));
    pendingForMe = pending.filter((r) => mine.has(r.match_id) && r.proposed_by !== user.id);
  }

  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 bg-transparent px-4 pb-24 pt-6">
      <OnboardingSlides />
      {levelingDone ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-100">
          <p className="text-sm font-semibold">Perfil guardado con exito.</p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Tu nivel y preferencias ya se actualizaron correctamente.
          </p>
        </section>
      ) : null}

      <section
        className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]"
      >
        <div className="relative z-10 flex items-start gap-3">
          <span
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
            style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
          >
            <Zap size={20} strokeWidth={2.25} aria-hidden />
          </span>
          <h1 className="text-xl font-bold leading-tight tracking-tight text-[var(--text-primary)] md:text-[1.35rem]">
            ¡Vamos! Todo listo para tu partido, {displayName}.
          </h1>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        {primaryActions.map(({ title, desc, href, Icon }) => (
          <Link
            key={title}
            href={href}
            className="group flex min-h-[7.5rem] flex-col justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 ring-1 ring-sky-100">
              <Icon size={22} className="text-[#0585FC]" aria-hidden />
            </span>
            <div className="mt-3">
              <h2 className="text-[15px] font-bold leading-tight text-[var(--text-primary)]">{title}</h2>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-tertiary)]">{desc}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3">
        {secondaryActions.map(({ title, href, Icon }) => (
          <Link
            key={title}
            href={href}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-card)]"
          >
            <Icon size={16} className="text-[#0585FC]" />
            {title}
          </Link>
        ))}
      </section>

      {pendingForMe.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Resultados pendientes</h2>
          {pendingForMe.slice(0, 2).map((p) => (
            <CompetitiveResultConfirmationCard
              key={p.match_id}
              matchId={p.match_id}
              label="la dupla rival"
              scoreLabel={`${p.team_a_score ?? 0}-${p.team_b_score ?? 0}`}
            />
          ))}
        </section>
      ) : null}

      <section className="space-y-4">
        <Suspense fallback={null}>
          <FriendRequestsSection userId={user.id} />
        </Suspense>
        <Suspense fallback={null}>
          <HomeJoinRequestsSection userId={user.id} />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Sugerencias para vos</h2>
        <Suspense fallback={<HomeSuggestionsSkeleton />}>
          <HomeSuggestionsSection userId={user.id} />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Tu resumen</h2>
        <Suspense fallback={<HomeSummarySkeleton />}>
          <HomeSummarySection userId={user.id} />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Mis Reservas</h2>
        <Suspense fallback={<HomeReservationsSkeleton />}>
          <HomeReservationsSection userId={user.id} />
        </Suspense>
      </section>
    </MotionPage>
  );
}
