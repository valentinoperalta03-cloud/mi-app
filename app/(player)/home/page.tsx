import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, CirclePlus, GraduationCap, Search, Trophy } from "lucide-react";
import MotionPage from "@/components/motion-page";
import { CompetitiveResultConfirmationCard } from "@/components/competitive-result-confirmation-card";
import { FriendRequestsSection } from "@/components/friend-requests-section";
import HomeJoinRequestsSection from "@/components/home-join-requests-section";
import { HomeReservationsSection } from "@/components/home-reservations-section";
import { HomeSummarySection } from "@/components/home-summary-section";
import {
  HomeReservationsSkeleton,
  HomeSectionLineSkeleton,
  HomeSummarySkeleton,
} from "@/components/home-loading-skeletons";
import {
  getCachedPendingResultsForUser,
  getCachedProfileDisplayName,
} from "@/lib/home-cache";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type HomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const quickActions = [
  {
    title: "Buscar partido",
    href: "/buscar-partido",
    Icon: Search,
    desc: "Encontrá partidos abiertos de tu nivel",
    featured: true,
  },
  {
    title: "Crear Partido",
    href: "/crear-partido",
    Icon: CirclePlus,
    desc: "Organizá un partido en segundos",
    featured: false,
  },
] as const;

const secondaryActions = [
  { title: "Torneos", href: "/torneos", Icon: Trophy },
  { title: "Aprender", href: "/clases", Icon: GraduationCap },
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

  const { data: profileSlides } = await supabase
    .from(DB_TABLES.profiles)
    .select("slides_seen")
    .eq("user_id", user.id)
    .maybeSingle();

  const slidesSeen = Boolean((profileSlides as { slides_seen?: boolean | null } | null)?.slides_seen);
  if (!slidesSeen) redirect("/bienvenida");

  const [displayName, pendingForMe] = await Promise.all([
    getCachedProfileDisplayName(user.id),
    getCachedPendingResultsForUser(user.id),
  ]);

  return (
    <MotionPage className="home-page-shell mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 bg-transparent px-4 pb-24 pt-6">
      {levelingDone ? (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-900/20 dark:text-emerald-100">
          <p className="text-sm font-semibold">Perfil guardado con éxito.</p>
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
            Tu nivel y preferencias ya se actualizaron correctamente.
          </p>
        </section>
      ) : null}

      <section
        className="relative overflow-hidden rounded-3xl p-5 text-white"
        style={{
          background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)",
          boxShadow: "0 4px 24px rgba(5,133,252,0.3)",
        }}
      >
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10">
          <span
            className="mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: "#CCFF00", color: "#000" }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-black" />
            En línea
          </span>
          <h1 className="text-xl font-bold leading-tight tracking-tight">¡Vamos, {displayName}!</h1>
          <p className="mt-1 text-sm text-white/75">¿Qué querés hacer hoy?</p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <Link
          href={quickActions[0].href}
          prefetch
          className="group relative flex items-center gap-4 overflow-hidden rounded-3xl p-5 text-white transition active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)",
            boxShadow: "0 4px 20px rgba(5,133,252,0.25)",
          }}
        >
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl" />
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/25">
            <Search size={22} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold">{quickActions[0].title}</p>
            <p className="text-sm text-white/75">{quickActions[0].desc}</p>
          </div>
          <ChevronRight size={20} className="shrink-0 text-white/60" />
        </Link>

        <Link
          href={quickActions[1].href}
          prefetch
          className="flex items-center gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] transition active:scale-[0.98]"
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "rgba(204,255,0,0.12)" }}
          >
            <CirclePlus size={22} style={{ color: "#CCFF00" }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-[var(--text-primary)]">{quickActions[1].title}</p>
            <p className="text-sm text-[var(--text-tertiary)]">{quickActions[1].desc}</p>
          </div>
          <ChevronRight size={20} className="shrink-0 text-[var(--text-tertiary)]" />
        </Link>

        <div className="grid grid-cols-2 gap-3">
          {secondaryActions.map(({ title, href, Icon }) => (
            <Link
              key={title}
              href={href}
              prefetch
              className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3.5 shadow-[var(--shadow-card)] transition active:scale-[0.97]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0585FC]/10">
                <Icon size={18} className="text-[#0585FC]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{title}</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {title === "Torneos" ? "Competí" : "Clases"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Link
        href="/clubes"
        prefetch
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
        <Suspense fallback={<HomeSectionLineSkeleton />}>
          <FriendRequestsSection userId={user.id} />
        </Suspense>
        <Suspense fallback={<HomeSectionLineSkeleton />}>
          <HomeJoinRequestsSection userId={user.id} />
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
