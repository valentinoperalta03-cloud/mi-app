import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { fetchTopByMatchesPlayed, fetchWeeklyTopWinners } from "@/lib/rankings-data";
import { createClient } from "@/utils/supabase/server";

function medalForPosition(n: number) {
  if (n === 1) return "🥇";
  if (n === 2) return "🥈";
  if (n === 3) return "🥉";
  return `${n}.`;
}

export default async function RankingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [weekly, topMatches] = await Promise.all([fetchWeeklyTopWinners(10), fetchTopByMatchesPlayed(10)]);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-transparent px-4 pb-32 pt-5">
      <PlayerStackHeader
        backHref="/comunidad"
        backLabel="Volver a Comunidad"
        title="Rankings"
        subtitle="Victorias de la semana y partidos jugados"
      />

      <section className="mb-8 rounded-3xl bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] dark:ring-white/10">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">🏆 Top 10 de la semana</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Jugadores con más victorias en partidos con confirmación de resultado en los últimos 7 días
        </p>
        <ul className="mt-4 space-y-3">
          {weekly.length === 0 ? (
            <li className="rounded-2xl bg-[var(--bg-subtle)] px-3 py-4 text-center text-sm text-[var(--text-secondary)]">
              Todavía no hay victorias registradas en esta ventana.
            </li>
          ) : (
            weekly.map((row, i) => (
              <li
                key={row.user_id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white/60 px-3 py-2.5 dark:bg-white/5"
              >
                <span className="w-8 shrink-0 text-center text-base font-semibold" aria-hidden>
                  {medalForPosition(i + 1)}
                </span>
                <ProfileAvatar avatarUrl={row.avatar_url} name={row.name ?? "?"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text-primary)]">{row.name ?? "Jugador"}</p>
                  <p className="truncate text-xs text-[var(--text-tertiary)]">{row.categoryLabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#0085FC]">{row.wins} victorias</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-3xl bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] dark:ring-white/10">
        <h2 className="text-base font-semibold text-[var(--text-primary)]">🎾 Más partidos jugados</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Jugadores con más participaciones registradas en partidos
        </p>
        <ul className="mt-4 space-y-3">
          {topMatches.length === 0 ? (
            <li className="rounded-2xl bg-[var(--bg-subtle)] px-3 py-4 text-center text-sm text-[var(--text-secondary)]">
              Todavía no hay partidos registrados.
            </li>
          ) : (
            topMatches.map((row, i) => (
              <li
                key={row.user_id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white/60 px-3 py-2.5 dark:bg-white/5"
              >
                <span className="w-8 shrink-0 text-center text-base font-semibold" aria-hidden>
                  {medalForPosition(i + 1)}
                </span>
                <ProfileAvatar avatarUrl={row.avatar_url} name={row.name ?? "?"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text-primary)]">{row.name ?? "Jugador"}</p>
                  <p className="truncate text-xs text-[var(--text-tertiary)]">{row.categoryLabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#0085FC]">{row.matches_played} partidos</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
    </MotionPage>
  );
}
