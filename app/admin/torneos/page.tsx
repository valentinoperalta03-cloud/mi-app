import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Trophy } from "lucide-react";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { TOURNAMENT_STATUS_LABELS, TOURNAMENT_TYPE_OPTIONS } from "@/lib/tournament-constants";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminTorneosPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");

  const { data: rows } = await supabase
    .from(DB_TABLES.tournaments)
    .select("id, name, tournament_type, start_date, end_date, status, max_pairs, club_id")
    .in("club_id", ctx.clubIds)
    .order("start_date", { ascending: false });

  const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);
  const { data: counts } = ids.length
    ? await supabase
        .from(DB_TABLES.tournamentRegistrations)
        .select("tournament_id")
        .in("tournament_id", ids)
        .eq("payment_status", "approved")
        .eq("waitlist", false)
    : { data: [] };
  const countBy = new Map<string, number>();
  for (const r of (counts ?? []) as { tournament_id: string }[]) {
    countBy.set(r.tournament_id, (countBy.get(r.tournament_id) ?? 0) + 1);
  }

  const typeLabel = (t: string) => TOURNAMENT_TYPE_OPTIONS.find((o) => o.value === t)?.badge ?? t;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 md:pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Torneos</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Creá y gestioná torneos para tu club.</p>
        </div>
        <Link
          href="/admin/torneos/nuevo"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#0461C4] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <Plus size={18} />
          Crear
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Listado</h2>
        <ul className="space-y-2">
          {((rows ?? []) as Array<{
            id: string;
            name: string;
            tournament_type: string;
            start_date: string;
            end_date: string;
            status: string;
            max_pairs: number;
          }>).length === 0 ? (
            <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <Trophy className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Todavía no hay torneos.
            </li>
          ) : null}
          {((rows ?? []) as Array<{
            id: string;
            name: string;
            tournament_type: string;
            start_date: string;
            end_date: string;
            status: string;
            max_pairs: number;
          }>).map((t) => {
            const c = countBy.get(t.id) ?? 0;
            return (
              <li key={t.id}>
                <Link
                  href={`/admin/torneos/${t.id}`}
                  className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-[#0585FC]/40 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-sky-500/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {typeLabel(t.tournament_type)} · {t.start_date} → {t.end_date}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {TOURNAMENT_STATUS_LABELS[t.status] ?? t.status}
                    </span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {c}/{t.max_pairs} parejas
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
