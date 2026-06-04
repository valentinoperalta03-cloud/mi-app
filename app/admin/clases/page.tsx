import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { GraduationCap, Plus } from "lucide-react";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { PRACTICE_STATUS_LABELS } from "@/lib/practice-constants";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminClasesPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");

  const { data: rows } = await supabase
    .from(DB_TABLES.practices)
    .select("id, title, status, recurrence_type, start_date, end_date, max_spots, price_base")
    .in("club_id", ctx.clubIds)
    .order("created_at", { ascending: false });

  const practiceIds = ((rows ?? []) as { id: string }[]).map((r) => r.id);
  const { data: sessionCounts } = practiceIds.length
    ? await supabase.from(DB_TABLES.practiceSessions).select("practice_id").in("practice_id", practiceIds)
    : { data: [] };
  const sessionsBy = new Map<string, number>();
  for (const s of (sessionCounts ?? []) as { practice_id: string }[]) {
    sessionsBy.set(s.practice_id, (sessionsBy.get(s.practice_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 md:pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Clases</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Prácticas y entrenamientos de tu club.</p>
        </div>
        <Link
          href="/admin/clases/nuevo"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#0461C4] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
        >
          <Plus size={18} />
          Crear
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Registro de clases
        </h2>
        <ul className="space-y-2">
          {((rows ?? []) as Array<{
            id: string;
            title: string;
            status: string;
            recurrence_type: string;
            start_date: string;
            end_date: string;
            max_spots: number;
            price_base: number;
          }>).length === 0 ? (
            <li className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <GraduationCap className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Todavía no hay clases.
            </li>
          ) : null}
          {((rows ?? []) as Array<{
            id: string;
            title: string;
            status: string;
            recurrence_type: string;
            start_date: string;
            end_date: string;
            max_spots: number;
            price_base: number;
          }>).map((p) => {
            const dateLabel =
              p.recurrence_type === "weekly"
                ? `${format(parseISO(p.start_date), "d MMM", { locale: es })} – ${format(parseISO(p.end_date), "d MMM yyyy", { locale: es })}`
                : format(parseISO(p.start_date), "d MMM yyyy", { locale: es });
            const nSessions = sessionsBy.get(p.id) ?? 0;
            return (
              <li key={p.id}>
                <Link
                  href={`/admin/clases/${p.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-[#0461C4]/40 dark:border-slate-800 dark:bg-slate-950"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">{p.title}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {PRACTICE_STATUS_LABELS[p.status] ?? p.status} · {dateLabel}
                    {nSessions > 0 ? ` · ${nSessions} fecha(s)` : ""} · {p.max_spots} cupos · $
                    {Number(p.price_base).toLocaleString("es-AR")}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
