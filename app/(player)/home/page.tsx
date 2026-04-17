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
    iconWrap: "bg-sky-100 text-sky-600 ring-sky-200/60",
  },
  {
    title: "Aprender",
    desc: "Clases y entrenamientos",
    href: "/clases",
    Icon: GraduationCap,
    iconWrap: "bg-emerald-100 text-emerald-700 ring-emerald-200/60",
  },
  {
    title: "Competir",
    desc: "Torneos y competencias",
    href: "/torneos",
    Icon: Trophy,
    iconWrap: "bg-orange-100 text-orange-700 ring-orange-200/55",
  },
  {
    title: "Buscar partido",
    desc: "Unite a partidos abiertos",
    href: "/buscar-partido",
    Icon: Search,
    iconWrap: "bg-violet-100 text-violet-700 ring-violet-200/55",
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
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 bg-slate-50 px-4 pb-32 pt-6">
      {levelingDone ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm">
          <p className="text-sm font-semibold">Perfil guardado con exito.</p>
          <p className="mt-1 text-xs text-emerald-700">
            Tu nivel y preferencias ya se actualizaron correctamente.
          </p>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-sky-600 via-sky-600 to-indigo-600 p-6 text-white shadow-[0_12px_40px_-12px_rgba(2,132,199,0.55)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <Zap size={20} strokeWidth={2.25} className="text-amber-200" aria-hidden />
          </span>
          <h1 className="text-xl font-bold leading-snug tracking-tight md:text-[1.35rem]">
            ¡Vamos! Todo listo para tu partido, {displayName}.
          </h1>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        {quickActions.map(({ title, desc, href, Icon, iconWrap }) => (
          <Link
            key={title}
            href={href}
            className="group flex min-h-[7.5rem] flex-col justify-between rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] transition-all duration-200 hover:border-slate-300/90 hover:shadow-md active:scale-[0.98]"
          >
            <span
              className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${iconWrap}`}
            >
              <Icon size={22} strokeWidth={2.1} aria-hidden />
            </span>
            <div className="mt-3">
              <h2 className="text-[15px] font-bold leading-tight text-slate-900">{title}</h2>
              <p className="mt-1 text-[11px] font-medium leading-snug text-slate-500">{desc}</p>
            </div>
          </Link>
        ))}
      </section>

      {pendingForMe.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Resultados pendientes</h2>
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
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Sugerencias para vos</h2>
        <Suspense fallback={<HomeSuggestionsSkeleton />}>
          <HomeSuggestionsSection userId={user.id} />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Tu resumen</h2>
        <Suspense fallback={<HomeSummarySkeleton />}>
          <HomeSummarySection userId={user.id} />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Mis Reservas</h2>
        <Suspense fallback={<HomeReservationsSkeleton />}>
          <HomeReservationsSection userId={user.id} />
        </Suspense>
      </section>
    </MotionPage>
  );
}
