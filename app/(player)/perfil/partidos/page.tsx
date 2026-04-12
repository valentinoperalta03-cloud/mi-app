import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { fetchProfileMatchCards } from "@/lib/profile-insights";
import { createClient } from "@/utils/supabase/server";

export default async function PerfilPartidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const cards = await fetchProfileMatchCards(supabase, user.id, 80);

  return (
    <MotionPage className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-4 bg-slate-50 px-4 pb-28 pt-6">
      <div className="flex items-center gap-3">
        <Link
          href="/perfil"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          ← Perfil
        </Link>
      </div>

      <header className="rounded-[2.5rem] border border-slate-200/60 bg-white px-6 py-5 shadow-[0_2px_24px_-8px_rgba(15,23,42,0.06)]">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Historial de partidos</h1>
        <p className="mt-1 text-sm text-slate-500">Resultados de tus partidos con registro.</p>
      </header>

      <ul className="flex flex-col gap-2">
        {cards.length === 0 ? (
          <li className="rounded-[2rem] border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-400">
            No hay partidos con resultado todavía.
          </li>
        ) : (
          cards.map((c) => (
            <li key={c.matchId}>
              <Link
                href={`/matches/${c.matchId}`}
                className="flex items-center justify-between gap-3 rounded-[2rem] border border-slate-100 bg-white px-5 py-4 shadow-[0_1px_12px_-4px_rgba(15,23,42,0.05)] transition hover:border-slate-200"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{c.clubName}</p>
                  <p className="truncate text-xs text-slate-500">{c.courtName}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {format(new Date(c.whenIso), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
                {c.scoreLabel ? (
                  <span className="shrink-0 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold tabular-nums text-sky-800 ring-1 ring-slate-100">
                    {c.scoreLabel}
                  </span>
                ) : null}
              </Link>
            </li>
          ))
        )}
      </ul>
    </MotionPage>
  );
}
