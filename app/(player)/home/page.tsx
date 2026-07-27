import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, CirclePlus, GraduationCap, MapPin, Search, Trophy } from "lucide-react";
import PlayerProfileNudgeBanner from "@/components/player-profile-nudge-banner";
import MotionPage from "@/components/motion-page";
import { CompetitiveResultConfirmationCard } from "@/components/competitive-result-confirmation-card";
import { FriendRequestsSection } from "@/components/friend-requests-section";
import HomeJoinRequestsSection from "@/components/home-join-requests-section";
import { HomeReservationsSection } from "@/components/home-reservations-section";
import { HomeSocialSection } from "@/components/home-social-section";
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
import { formatCityLabel } from "@/lib/locations";
import { getUserLocationServer } from "@/lib/locations-server";
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

  const { data: profileData } = await supabase
    .from(DB_TABLES.profiles)
    .select("slides_seen, onboarding_completed, name, gender")
    .eq("user_id", user.id)
    .maybeSingle();

  const profileRow = profileData as {
    slides_seen?: boolean | null;
    onboarding_completed?: boolean | null;
    name?: string | null;
    gender?: string | null;
  } | null;

  const slidesSeen = Boolean(profileRow?.slides_seen);
  if (!slidesSeen) redirect("/bienvenida");

  const hasName = Boolean(profileRow?.name?.trim());
  const hasGender = Boolean(profileRow?.gender?.trim());
  const hasOnboarding = Boolean(profileRow?.onboarding_completed);
  const profileComplete = hasOnboarding && hasName && hasGender;

  const [displayName, pendingForMe, userLocation] = await Promise.all([
    getCachedProfileDisplayName(user.id),
    getCachedPendingResultsForUser(user.id),
    getUserLocationServer(),
  ]);
  const cityLabel = formatCityLabel(userLocation.city);

  return (
    <MotionPage className="home-page-shell mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 bg-[var(--bg-app)] px-4 pb-24 pt-6">
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
          <h1 className="text-lg font-semibold leading-tight tracking-tight">¡Vamos, {displayName}!</h1>
          <p className="mt-1 text-sm text-white/75">¿Qué querés hacer hoy?</p>
        </div>
      </section>

      <section className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-0 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <MapPin className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <span className="truncate">
            ¿Dónde jugás? <span className="font-semibold text-slate-900 dark:text-white">{cityLabel}</span>
          </span>
        </div>
        <Link
          href="/ajustes"
          className="shrink-0 rounded-full border border-sky-200 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40"
        >
          Cambiar
        </Link>
      </section>

      {!profileComplete ? <PlayerProfileNudgeBanner /> : null}

      <section className={`flex flex-col gap-3 ${!profileComplete ? "pointer-events-none opacity-40 select-none" : ""}`}>
        <Link
          href={profileComplete ? quickActions[0].href : "/onboarding"}
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
          href={profileComplete ? quickActions[1].href : "/onboarding"}
          prefetch
          className="flex items-center gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] transition active:scale-[0.98]"
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: "rgba(204,255,0,0.25)" }}
          >
            <CirclePlus size={22} style={{ color: "#7a9900" }} />
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
              className="flex flex-col gap-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-4 shadow-[var(--shadow-card)] transition active:scale-[0.97]"
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
              >
                <Icon size={19} className="text-white" />
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

      <HomeSocialSection />

      {pendingForMe.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Resultados pendientes</h2>
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
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Tu resumen</h2>
        <Suspense fallback={<HomeSummarySkeleton />}>
          <HomeSummarySection userId={user.id} />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Mis Reservas</h2>
        <Suspense fallback={<HomeReservationsSkeleton />}>
          <HomeReservationsSection userId={user.id} />
        </Suspense>
      </section>
    </MotionPage>
  );
}
