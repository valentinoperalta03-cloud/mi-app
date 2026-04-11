import Link from "next/link";
import { format, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import {
  Calendar,
  Clock,
  GraduationCap,
  Search,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import MotionPage from "@/components/motion-page";
import { fetchPlayerHomeStats } from "@/lib/player-home-stats";
import {
  fetchNextMatchForPlayer,
  matchClubName,
  matchCourtName,
  type UpcomingMatchRow,
} from "@/lib/matches";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const PADEL_MAX = 4;

function matchTitle(m: UpcomingMatchRow): string {
  if (m.is_competitive) return "Competitivo";
  return "Dobles intermedio";
}

function formatNextWhen(dateIso: string): string {
  const d = parseISO(dateIso);
  if (isToday(d)) {
    return `Hoy ${format(d, "HH:mm")}`;
  }
  return format(d, "EEE d MMM · HH:mm", { locale: es });
}

export default async function InicioPage() {
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

  const [nextMatch, stats] = await Promise.all([
    fetchNextMatchForPlayer(supabase, user.id),
    fetchPlayerHomeStats(supabase, user.id),
  ]);

  const spotsLeft = nextMatch
    ? Math.max(0, PADEL_MAX - (nextMatch.match_players?.length ?? 0))
    : 0;

  const quickActions = [
    {
      title: "Reservar pista",
      desc: "Encontrá y reservá tu cancha ideal",
      href: "/reservas",
      Icon: Calendar,
      iconWrap: "bg-sky-100 text-sky-600 ring-sky-200/60",
    },
    {
      title: "Aprender",
      desc: "Clases y entrenamientos para mejorar",
      href: "/perfil",
      Icon: GraduationCap,
      iconWrap: "bg-emerald-100 text-emerald-700 ring-emerald-200/60",
    },
    {
      title: "Competir",
      desc: "Torneos y competencias activas",
      href: "/partidos",
      Icon: Trophy,
      iconWrap: "bg-orange-100 text-orange-700 ring-orange-200/55",
    },
    {
      title: "Buscar partido",
      desc: "Uníte a partidos abiertos",
      href: "/feed",
      Icon: Search,
      iconWrap: "bg-violet-100 text-violet-700 ring-violet-200/55",
    },
  ] as const;

  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 bg-gradient-to-b from-slate-50 to-white px-4 pb-32 pt-5">
      {/* Welcome header */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-sky-600 via-sky-600 to-indigo-600 px-5 py-6 text-white shadow-[0_12px_40px_-12px_rgba(2,132,199,0.55)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <Zap size={20} strokeWidth={2.25} className="text-amber-200" aria-hidden />
          </span>
          <h1 className="text-xl font-bold leading-snug tracking-tight md:text-[1.35rem]">
            ¡Vamos! Todo listo para tu partido, {displayName}.
          </h1>
        </div>
      </section>

      {/* Quick actions 2x2 */}
      <section className="grid grid-cols-2 gap-3">
        {quickActions.map(({ title, desc, href, Icon, iconWrap }) => (
          <Link
            key={title}
            href={href}
            className="group flex min-h-[7.5rem] flex-col justify-between rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)] transition-all duration-200 active:scale-[0.98] hover:border-slate-300/80 hover:shadow-md"
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

      {/* Próximo partido */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold tracking-tight text-slate-900">Próximo partido</h3>

        <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 p-5 text-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.45)]">
          {nextMatch ? (
            <>
              {spotsLeft > 0 ? (
                <span className="absolute right-4 top-4 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white ring-1 ring-white/25">
                  {spotsLeft} {spotsLeft === 1 ? "lugar" : "lugares"}
                </span>
              ) : null}
              <p className="pr-20 text-lg font-bold leading-tight">{matchTitle(nextMatch)}</p>
              <p className="mt-1 text-sm font-medium text-sky-100/90">{matchClubName(nextMatch)}</p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-white/95">
                <Clock size={17} strokeWidth={2} className="shrink-0 text-sky-300" aria-hidden />
                {formatNextWhen(nextMatch.date)}
              </div>
              <p className="mt-1 text-xs font-medium text-sky-200/80">{matchCourtName(nextMatch)}</p>
              <Link
                href={`/matches/${nextMatch.id}`}
                className="mt-5 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-white/95 to-sky-50 py-3.5 text-sm font-bold text-slate-900 shadow-md transition hover:from-white hover:to-white active:scale-[0.99]"
              >
                Ver detalles →
              </Link>
            </>
          ) : (
            <>
              <p className="text-lg font-bold">Sin partido próximo</p>
              <p className="mt-1 text-sm font-medium text-sky-100/85">
                Reservá una cancha o unite a un partido abierto.
              </p>
              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <Link
                  href="/reservas"
                  className="flex flex-1 items-center justify-center rounded-2xl bg-white/95 py-3 text-sm font-bold text-slate-900"
                >
                  Reservar
                </Link>
                <Link
                  href="/feed"
                  className="flex flex-1 items-center justify-center rounded-2xl bg-white/10 py-3 text-sm font-bold text-white ring-1 ring-white/30"
                >
                  Buscar partido
                </Link>
              </div>
            </>
          )}
        </article>
      </section>

      {/* Tu resumen */}
      <section className="space-y-3">
        <h3 className="text-lg font-bold tracking-tight text-slate-900">Tu resumen</h3>
        <div className="flex flex-col gap-3">
          <article className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
                <Trophy size={20} strokeWidth={2.1} aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {stats.partidosCount}
                </p>
                <p className="text-xs font-semibold text-slate-500">Partidos</p>
              </div>
            </div>
          </article>
          <article className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Calendar size={20} strokeWidth={2.1} aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {stats.reservasCount}
                </p>
                <p className="text-xs font-semibold text-slate-500">Reservas</p>
              </div>
            </div>
          </article>
          <article className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Star size={20} strokeWidth={2.1} aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">
                  {stats.nivelDisplay === 0 ? "—" : stats.nivelDisplay}
                </p>
                <p className="text-xs font-semibold text-slate-500">Nivel</p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </MotionPage>
  );
}
