import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { PlayerStackHeader } from "@/components/player-back-button";
import { ProfileAvatar } from "@/components/profile-avatar";
import { fetchGlobalRanking, fetchMyGlobalRank, fetchWeeklyTopWinners } from "@/lib/rankings-data";
import { createClient } from "@/utils/supabase/server";

function medalForPosition(n: number) {
  if (n === 1) return "🥇";
  if (n === 2) return "🥈";
  if (n === 3) return "🥉";
  return `${n}.`;
}

function globalAccentClass(accent: "elite" | "avanzado" | "intermedio" | "principiante") {
  switch (accent) {
    case "elite":
      return "text-[#f59e0b]";
    case "avanzado":
      return "text-[#0585FC]";
    case "intermedio":
      return "text-[#16a34a]";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
}

export default async function RankingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [weekly, global, myRank] = await Promise.all([
    fetchWeeklyTopWinners(10),
    fetchGlobalRanking(50),
    fetchMyGlobalRank(user.id),
  ]);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-transparent px-4 pb-32 pt-5">
      <PlayerStackHeader
        backHref="/comunidad"
        backLabel="Volver a Comunidad"
        title="Rankings"
        subtitle="ELO y victorias recientes"
      />

      <section className="mb-8 rounded-3xl bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] dark:ring-white/10">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">🏆 Top 10 de la semana</h2>
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
                <span className="w-8 shrink-0 text-center text-lg font-bold" aria-hidden>
                  {medalForPosition(i + 1)}
                </span>
                <ProfileAvatar avatarUrl={row.avatar_url} name={row.name ?? "?"} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--text-primary)]">{row.name ?? "Jugador"}</p>
                  <p className="truncate text-xs text-[var(--text-tertiary)]">{row.categoryLabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-[#0585FC]">{row.wins} victorias</p>
                  <p className="text-xs text-[var(--text-tertiary)]">ELO {row.level?.toFixed(1) ?? "—"}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="mb-8 rounded-3xl bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] dark:ring-white/10">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">📊 Ranking global</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">Ordenado por nivel competitivo (ELO)</p>
        <ol className="mt-4 space-y-2">
          {global.map((row, i) => (
            <li
              key={row.user_id}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-white/60 px-3 py-2 dark:bg-white/5"
            >
              <span className="w-7 shrink-0 text-center text-sm font-bold text-[var(--text-tertiary)]">
                {i + 1}
              </span>
              <ProfileAvatar avatarUrl={row.avatar_url} name={row.name ?? "?"} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-[var(--text-primary)]">{row.name ?? "Jugador"}</p>
                <p className={`truncate text-xs font-medium ${globalAccentClass(row.accent)}`}>{row.categoryLabel}</p>
              </div>
              <p className="shrink-0 text-sm font-bold tabular-nums text-[var(--text-primary)]">
                {row.level?.toFixed(1) ?? "—"}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-3xl bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] dark:ring-white/10">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">Tu posición</h2>
        {myRank ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#0585FC]/25 bg-[rgba(5,133,252,0.08)] p-3 dark:bg-[rgba(5,133,252,0.12)]">
            <ProfileAvatar avatarUrl={myRank.avatar_url} name={myRank.name ?? "?"} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--text-primary)]">
                #{myRank.position} de {myRank.total} jugadores
              </p>
              <p className="truncate text-sm text-[var(--text-secondary)]">{myRank.name ?? "Vos"}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{myRank.categoryLabel}</p>
            </div>
            <p className="shrink-0 text-xl font-bold text-[#0585FC]">{myRank.level?.toFixed(1) ?? "—"}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            No encontramos tu perfil en el ranking. Completá tu nivelación para aparecer.
          </p>
        )}
      </section>
    </MotionPage>
  );
}
