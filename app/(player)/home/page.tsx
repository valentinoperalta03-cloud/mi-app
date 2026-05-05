import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, CirclePlus, GraduationCap, Search, Trophy, Zap } from "lucide-react";
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

const quickActions = [
  {
    title: "Crear Partido",
    href: "/crear-partido",
    Icon: CirclePlus,
    desc: "Organizá un partido en segundos",
    gradient: "var(--color-brand-gradient)",
    shadow: "0 4px 16px rgba(5,133,252,0.35)",
  },
  {
    title: "Buscar partido",
    desc: "Sumate a partidos abiertos",
    href: "/buscar-partido",
    Icon: Search,
    gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
    shadow: "0 4px 16px rgba(22,163,74,0.35)",
  },
  {
    title: "Aprender",
    href: "/clases",
    Icon: GraduationCap,
    desc: "Clases y entrenamientos",
    gradient: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
    shadow: "0 4px 16px rgba(168,85,247,0.35)",
  },
  {
    title: "Competir",
    href: "/torneos",
    Icon: Trophy,
    desc: "Torneos y competencias",
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    shadow: "0 4px 16px rgba(245,158,11,0.35)",
  },
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
          <p className="text-sm font-semibold">Perfil guardado con éxito.</p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Tu nivel y preferencias ya se actualizaron correctamente.
          </p>
        </section>
      ) : null}

      <section
        className="relative overflow-hidden rounded-3xl p-6 text-white"
        style={{
          background: "var(--color-brand-gradient)",
          boxShadow: "0 4px 20px rgba(5,133,252,0.3)",
        }}
      >
        <div className="relative z-10 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
            <Zap size={20} strokeWidth={2.25} aria-hidden />
          </span>
          <h1 className="text-xl font-bold leading-tight tracking-tight md:text-[1.35rem]">
            ¡Vamos! Todo listo para tu partido, {displayName}.
          </h1>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {quickActions.map(({ title, desc, href, Icon, gradient, shadow }) => (
          <Link
            key={title}
            href={href}
            className="group flex min-h-28 flex-col justify-between rounded-2xl p-4 text-white transition-all duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98] active:translate-y-0"
            style={{ background: gradient, boxShadow: shadow }}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Icon size={20} className="text-white" aria-hidden />
            </span>
            <div className="mt-2">
              <h2 className="text-base font-bold leading-tight">{title}</h2>
              <p className="mt-0.5 text-xs leading-snug text-white/80">{desc}</p>
            </div>
          </Link>
        ))}
      </section>

      <Link
        href="/clubes"
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] transition hover:opacity-95 active:scale-[0.99]"
      >
        <Building2 size={20} className="shrink-0 text-[#0585FC]" aria-hidden />
        <div className="min-w-0 flex-1 text-left">
          <p className="font-bold text-[var(--text-primary)]">Explorar clubes</p>
          <p className="text-sm text-[var(--text-tertiary)]">Encontrá canchas cerca tuyo</p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-[#0585FC]" aria-hidden />
      </Link>

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
