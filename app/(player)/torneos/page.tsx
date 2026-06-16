import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";
import { DB_TABLES } from "@/lib/db-tables";
import { TOURNAMENT_PLATFORM_FEE_ARS, TOURNAMENT_STATUS_LABELS, TOURNAMENT_TYPE_OPTIONS } from "@/lib/tournament-constants";
import { formatCategoryRange } from "@/lib/tournament-utils";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type Filter = "all" | "open" | "in_progress" | "finished";

export default async function TorneosPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const sp = await searchParams;
  const f = (sp.f as Filter) ?? "all";
  const supabase = await createClient();

  let q = supabase
    .from(DB_TABLES.tournaments)
    .select("id, name, tournament_type, status, start_date, start_time, max_pairs, price_per_pair, prize, registration_deadline, category_min, category_max, clubs(name, logo_url)")
    .order("start_date", { ascending: true });

  if (f === "open") q = q.eq("status", "open");
  else if (f === "in_progress") q = q.eq("status", "in_progress");
  else if (f === "finished") q = q.eq("status", "finished");

  const { data: rows } = await q;
  const list = ((rows ?? []) as unknown as Array<{
    id: string;
    name: string;
    tournament_type: string;
    status: string;
    start_date: string;
    start_time: string;
    max_pairs: number;
    price_per_pair: number;
    prize: string | null;
    registration_deadline: string;
    category_min: number | null;
    category_max: number | null;
    clubs: { name: string | null; logo_url: string | null }[] | { name: string | null; logo_url: string | null } | null;
  }>).map((row) => {
    const c = row.clubs;
    const club = Array.isArray(c) ? c[0] ?? null : c;
    return { ...row, clubs: club };
  });

  const ids = list.map((r) => r.id);
  const { data: counts } = ids.length
    ? await supabase
        .from(DB_TABLES.tournamentRegistrations)
        .select("tournament_id")
        .in("tournament_id", ids)
        .eq("payment_status", "approved")
        .eq("waitlist", false)
    : { data: [] };
  const countMap = new Map<string, number>();
  for (const c of (counts ?? []) as { tournament_id: string }[]) {
    countMap.set(c.tournament_id, (countMap.get(c.tournament_id) ?? 0) + 1);
  }

  const chip = (key: Filter, label: string) => {
    const on = f === key;
    return (
      <Link
        key={key}
        href={key === "all" ? "/torneos" : `/torneos?f=${key}`}
        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
          on
            ? "bg-[#0461C4] text-white"
            : "bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-[var(--bg-app)] px-4 pb-28 pt-6">
      <PlayerStackHeader
        backHref="/home"
        backLabel="Volver al inicio"
        title="Torneos"
        subtitle="Inscribite en torneos de clubes y seguí el fixture."
      />
      <div className="mb-6 min-w-0">
        <div className="flex min-w-0 flex-wrap gap-2">
          {chip("all", "Todos")}
          {chip("open", "Abiertos")}
          {chip("in_progress", "En curso")}
          {chip("finished", "Finalizados")}
        </div>
      </div>

      <ul className="min-w-0 space-y-4">
        {list.length === 0 ? (
          <li className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-10 text-center text-sm text-[var(--text-tertiary)]">
            No hay torneos para mostrar.
          </li>
        ) : null}
        {list.map((t) => {
          const badge = TOURNAMENT_TYPE_OPTIONS.find((o) => o.value === t.tournament_type)?.badge ?? t.tournament_type;
          const st = t.status;
          const stLabel = TOURNAMENT_STATUS_LABELS[st] ?? st;
          const stClass =
            st === "open"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : st === "in_progress"
                ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                : "bg-slate-500/15 text-slate-600 dark:text-slate-300";
          const dt = parseISO(`${t.start_date}T${String(t.start_time).slice(0, 5)}:00`);
          const dateLabel = format(dt, "EEEE d 'de' MMMM", { locale: es });
          const timeLabel = format(dt, "HH:mm");
          const n = countMap.get(t.id) ?? 0;
          const club = t.clubs;
          return (
            <li key={t.id}>
              <Link
                href={`/torneos/${t.id}`}
                className="block min-w-0 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-[0_8px_30px_-18px_rgba(15,23,42,0.15)] transition active:scale-[0.99]"
              >
                <div className="flex min-w-0 gap-3 p-4 sm:gap-4">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[var(--bg-subtle)] ring-1 ring-black/5 dark:ring-white/10 sm:h-16 sm:w-16">
                    {club?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URLs externas de storage
                      <img src={club.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-[#0461C4]">
                        {(club?.name ?? "C").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">{club?.name ?? "Club"}</p>
                    <h2 className="line-clamp-2 text-lg font-bold leading-snug break-words text-[var(--text-primary)]">{t.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                        {badge}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stClass}`}>{stLabel}</span>
                    </div>
                    <p className="mt-2 text-xs capitalize text-[var(--text-secondary)]">
                      {dateLabel} · {timeLabel}hs
                    </p>
                    <p className="mt-1 break-words text-xs text-[var(--text-tertiary)]">
                      ${Math.round(Number(t.price_per_pair) + TOURNAMENT_PLATFORM_FEE_ARS).toLocaleString("es-AR")} / pareja · {n}/{t.max_pairs} parejas ·{" "}
                      {formatCategoryRange(t.category_min, t.category_max)}
                    </p>
                    {t.prize ? (
                      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">🏅 Premio: {t.prize}</p>
                    ) : null}
                  </div>
                </div>
                <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 px-4 py-3 text-center text-sm font-semibold text-[#0461C4]">
                  Ver torneo
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </MotionPage>
  );
}
