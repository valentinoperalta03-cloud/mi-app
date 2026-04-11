import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { AdminPressableSurface } from "@/components/admin/admin-pressable";
import { PlayerAvatar, PlayerSegmentPill } from "@/components/admin/admin-status-pills";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

const NEW_DAYS = 21;

export default async function AdminJugadoresPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: matchesRaw } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.matches)
          .select("created_by,date")
          .in("court_id", ctx.courtIds)
          .not("created_by", "is", null)
          .order("date", { ascending: false })
      : { data: [] };

  const rows = (matchesRaw ?? []) as { created_by: string | null; date: string }[];

  const byUser = new Map<string, { count: number; last: string; first: string }>();
  for (const r of rows) {
    const uid = r.created_by;
    if (!uid) continue;
    const cur = byUser.get(uid);
    if (!cur) {
      byUser.set(uid, { count: 1, last: r.date, first: r.date });
    } else {
      cur.count += 1;
      if (parseISO(r.date) > parseISO(cur.last)) cur.last = r.date;
      if (parseISO(r.date) < parseISO(cur.first)) cur.first = r.date;
    }
  }

  const userIds = Array.from(byUser.keys());
  const { data: profilesRaw } = userIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", userIds)
    : { data: [] };

  const names = new Map(
    (profilesRaw ?? []).map((p: { user_id: string; name: string | null }) => [
      p.user_id,
      p.name ?? "Jugador",
    ])
  );

  const now = new Date();
  const list = userIds
    .map((uid) => {
      const stats = byUser.get(uid)!;
      const firstDt = parseISO(stats.first);
      const daysSinceFirst = (now.getTime() - firstDt.getTime()) / (86400 * 1000);
      const segment =
        stats.count === 1 || daysSinceFirst < NEW_DAYS
          ? ("Nuevo" as const)
          : ("Recurrente" as const);
      return {
        uid,
        name: names.get(uid) ?? "Jugador",
        count: stats.count,
        last: stats.last,
        segment,
      };
    })
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-sky-600`}>CRM</p>
        <h1 className={adminTitle}>Jugadores</h1>
        <p className={adminSubtitle}>
          Basado en <code className="text-xs text-slate-400">matches.created_by</code> y{" "}
          <code className="text-xs text-slate-400">profiles.name</code>.
        </p>
      </header>

      {list.length === 0 ? (
        <p className={`${adminCard} text-center text-sm font-medium text-slate-500`}>
          Todavía no hay creadores de partidos en tus canchas.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((row) => (
            <li key={row.uid}>
              <AdminPressableSurface className={adminCard}>
                <div className="flex gap-4">
                  <PlayerAvatar name={row.name} />
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-slate-900">{row.name}</p>
                        <p className="mt-0.5 text-xs font-medium text-slate-400">
                          ID: {row.uid.slice(0, 8)}…
                        </p>
                      </div>
                      <PlayerSegmentPill segment={row.segment} />
                    </div>
                    <dl className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className={adminKicker}>Reservas creadas</dt>
                        <dd className="mt-1 font-semibold text-slate-800">{row.count}</dd>
                      </div>
                      <div>
                        <dt className={adminKicker}>Última actividad</dt>
                        <dd className="mt-1 font-semibold text-slate-800">
                          {format(parseISO(row.last), "d MMM yyyy HH:mm", { locale: es })}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </AdminPressableSurface>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
