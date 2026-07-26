import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, PartyPopper } from "lucide-react";
import {
  adminCard,
  adminCTAPrimary,
  adminEmptyState,
  adminSectionLabel,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { penaStatusMeta } from "@/lib/pena-constants";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPenasPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");

  const { data: rows } = await supabase
    .from(DB_TABLES.penas)
    .select("id, name, date, start_time, level, status, max_players, club_id")
    .in("club_id", ctx.clubIds)
    .order("date", { ascending: false });

  const penas = (rows ?? []) as Array<{
    id: string;
    name: string;
    date: string;
    start_time: string;
    level: string;
    status: string;
    max_players: number;
  }>;

  const ids = penas.map((p) => p.id);
  const { data: counts } = ids.length
    ? await supabase.from(DB_TABLES.penaRegistrations).select("pena_id").in("pena_id", ids).eq("status", "registered")
    : { data: [] };
  const countBy = new Map<string, number>();
  for (const r of (counts ?? []) as { pena_id: string }[]) {
    countBy.set(r.pena_id, (countBy.get(r.pena_id) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 md:pb-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className={adminTitle}>Peñas</h1>
          <p className={`mt-1 ${adminSubtitle}`}>Organizá encuentros sociales para los jugadores de tu club.</p>
        </div>
        <Link
          href="/admin/penas/nuevo"
          className={`inline-flex shrink-0 items-center gap-1.5 ${adminCTAPrimary}`}
        >
          <Plus size={18} />
          Nueva peña
        </Link>
      </div>

      <section className="mt-8">
        <h2 className={`mb-3 ${adminSectionLabel}`}>Listado</h2>
        {penas.length === 0 ? (
          <div className={adminEmptyState}>
            <PartyPopper className="mx-auto mb-2 h-8 w-8 opacity-40" />
            <p>Todavía no hay peñas.</p>
            <Link href="/admin/penas/nuevo" className={`mt-4 inline-flex items-center gap-1.5 ${adminCTAPrimary}`}>
              <Plus size={16} />
              Crear primera peña
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {penas.map((p) => {
              const meta = penaStatusMeta(p.status);
              const count = countBy.get(p.id) ?? 0;
              return (
                <li key={p.id}>
                  <Link
                    href={`/admin/penas/${p.id}`}
                    className={`${adminCard} flex flex-col gap-1 hover:-translate-y-0.5 sm:flex-row sm:items-center sm:justify-between`}
                  >
                    <div>
                      <p className="font-semibold text-[var(--text-primary)]">{p.name}</p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        {p.date} · {p.start_time.slice(0, 5)} · {p.level}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={meta.className}>{meta.label}</span>
                      <span className="text-[var(--text-secondary)]">
                        {count}/{p.max_players} jugadores
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
