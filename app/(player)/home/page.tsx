import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CirclePlus, GraduationCap, Search, Trophy, Zap } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { CompetitiveResultConfirmationCard } from "@/components/competitive-result-confirmation-card";
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
    desc: "Organizá un partido y encontrá rivales",
    href: "/crear-partido",
    Icon: CirclePlus,
    gradient: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
    shadow: "0 2px 8px rgba(22,163,74,0.25)",
    hoverShadow: "hover:shadow-[0_8px_24px_rgba(22,163,74,0.28)]",
  },
  {
    title: "Aprender",
    desc: "Clases y entrenamientos",
    href: "/clases",
    Icon: GraduationCap,
    gradient: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)",
    shadow: "0 2px 8px rgba(5,133,252,0.2)",
    hoverShadow: "hover:shadow-[0_8px_24px_rgba(5,133,252,0.25)]",
  },
  {
    title: "Competir",
    desc: "Torneos y competencias",
    href: "/torneos",
    Icon: Trophy,
    gradient: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    shadow: "0 2px 8px rgba(245,158,11,0.25)",
    hoverShadow: "hover:shadow-[0_8px_24px_rgba(245,158,11,0.3)]",
  },
  {
    title: "Buscar partido",
    desc: "Unite a partidos abiertos",
    href: "/buscar-partido",
    Icon: Search,
    gradient: "linear-gradient(135deg, #facc15 0%, #eab308 100%)",
    shadow: "0 2px 8px rgba(234,179,8,0.24)",
    hoverShadow: "hover:shadow-[0_8px_24px_rgba(234,179,8,0.28)]",
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
          <p className="text-sm font-semibold">Perfil guardado con exito.</p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Tu nivel y preferencias ya se actualizaron correctamente.
          </p>
        </section>
      ) : null}

      <section
        className="relative overflow-hidden rounded-3xl p-6 text-white"
        style={{
          background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)",
          boxShadow: "0 8px 32px rgba(5,133,252,0.25)",
        }}
      >
        <div className="absolute right-4 top-4 opacity-[0.07]">
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="36" fill="none" stroke="white" strokeWidth="3" />
            <circle cx="40" cy="40" r="24" fill="none" stroke="white" strokeWidth="2" />
            <circle cx="40" cy="40" r="12" fill="none" stroke="white" strokeWidth="1.5" />
            <path d="M10 30 Q40 25 70 30" stroke="white" strokeWidth="2" fill="none" />
            <path d="M10 40 Q40 35 70 40" stroke="white" strokeWidth="2" fill="none" />
            <path d="M10 50 Q40 45 70 50" stroke="white" strokeWidth="2" fill="none" />
          </svg>
        </div>

        <div className="relative z-10 flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
            <Zap size={20} strokeWidth={2.25} className="text-white" aria-hidden />
          </span>
          <h1 className="text-xl font-bold leading-tight tracking-tight md:text-[1.35rem]">
            ¡Vamos! Todo listo para tu partido, {displayName}.
          </h1>
        </div>
        <div
          className="mt-4 h-px w-full"
          style={{ background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.4), transparent)" }}
        />
      </section>

      <section className="grid grid-cols-2 gap-4">
        {quickActions.map(({ title, desc, href, Icon, gradient, shadow, hoverShadow }) => (
          <Link
            key={title}
            href={href}
            className={`group flex min-h-[7.5rem] flex-col justify-between rounded-2xl p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 ${hoverShadow} active:scale-[0.98] active:translate-y-0`}
            style={{
              background: gradient,
              boxShadow: shadow,
            }}
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <Icon size={22} className="text-white" aria-hidden />
            </span>
            <div className="mt-3">
              <h2 className="text-[15px] font-semibold leading-tight text-white">{title}</h2>
              <p className="mt-0.5 text-[12px] leading-snug text-white/60">{desc}</p>
            </div>
          </Link>
        ))}
      </section>

      {pendingForMe.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Resultados pendientes</h2>
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
          <HomeJoinRequestsSection userId={user.id} />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Sugerencias para vos</h2>
        <Suspense fallback={<HomeSuggestionsSkeleton />}>
          <HomeSuggestionsSection userId={user.id} />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Tu resumen</h2>
        <Suspense fallback={<HomeSummarySkeleton />}>
          <HomeSummarySection userId={user.id} />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Mis Reservas</h2>
        <Suspense fallback={<HomeReservationsSkeleton />}>
          <HomeReservationsSection userId={user.id} />
        </Suspense>
      </section>
    </MotionPage>
  );
}
