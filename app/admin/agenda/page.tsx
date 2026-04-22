import { format } from "date-fns";
import { es } from "date-fns/locale";
import { redirect } from "next/navigation";
import { adminCard, adminKicker, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import AgendaScheduler from "./scheduler-client";

type PageProps = {
  searchParams?: Promise<{ date?: string }>;
};

function ymd(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default async function AdminAgendaPage({ searchParams }: PageProps) {
  const sp = searchParams ? await searchParams : {};
  const selectedDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : ymd(new Date());

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const courts = ctx.courts.map((c) => ({ id: c.id, name: c.name ?? "Cancha" }));
  const courtIds = courts.map((c) => c.id);

  const [{ data: matchesRows }, { data: blocksRows }] = courtIds.length
    ? await Promise.all([
        supabase
          .from(DB_TABLES.matches)
          .select("id,court_id,scheduled_time,duration_minutes,match_status,payment_status,owner_id")
          .in("court_id", courtIds)
          .eq("scheduled_date", selectedDate)
          .neq("match_status", "cancelled"),
        supabase
          .from(DB_TABLES.courtBlocks)
          .select("court_id,start_time")
          .in("court_id", courtIds)
          .eq("date", selectedDate),
      ])
    : [{ data: [] }, { data: [] }];

  const matchList = (matchesRows ?? []) as Array<{
    id: string;
    court_id: string;
    scheduled_time: string | null;
    duration_minutes: number | null;
    match_status: string | null;
    payment_status: string | null;
    owner_id: string | null;
  }>;

  const ownerIds = Array.from(new Set(matchList.map((m) => m.owner_id).filter((v): v is string => Boolean(v))));
  const { data: owners } = ownerIds.length
    ? await supabase.from(DB_TABLES.profiles).select("user_id,name").in("user_id", ownerIds)
    : { data: [] };
  const ownerMap = new Map(((owners ?? []) as Array<{ user_id: string; name: string | null }>).map((o) => [o.user_id, o.name ?? "Jugador"]));

  const participantsMap = new Map<string, Array<{ name: string; player_id: string }>>();
  if (matchList.length > 0) {
    const ids = matchList.map((m) => m.id);
    const { data: partRows } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("match_id,player_id,profiles(name)")
      .in("match_id", ids);
    for (const row of (partRows ?? []) as Array<{ match_id: string; player_id: string; profiles: { name: string | null } | { name: string | null }[] | null }>) {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const arr = participantsMap.get(row.match_id) ?? [];
      arr.push({ name: profile?.name ?? "Jugador", player_id: row.player_id });
      participantsMap.set(row.match_id, arr);
    }
  }

  const schedulerMatches = matchList.map((m) => ({
    id: m.id,
    court_id: m.court_id,
    scheduled_time: String(m.scheduled_time ?? "").slice(0, 5),
    duration_minutes: m.duration_minutes ?? 90,
    payment_status: String(m.payment_status ?? "pending"),
    owner_name: m.owner_id ? ownerMap.get(m.owner_id) ?? "Jugador" : "Jugador",
    players: participantsMap.get(m.id) ?? [],
  }));

  const blocks = (blocksRows ?? []) as Array<{ court_id: string; start_time: string | null }>;
  const blockSet = blocks.map((b) => ({ court_id: b.court_id, start_time: String(b.start_time ?? "").slice(0, 5) }));

  return (
    <div className="flex flex-col gap-6">
      <header className={`${adminCard} space-y-2`}>
        <p className={`${adminKicker} text-[#0585FC]`}>Agenda del día</p>
        <h1 className={adminTitle}>Scheduler de canchas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Vista operativa por hora para reservas, disponibilidad y bloqueos de mantenimiento.
        </p>
      </header>

      <AgendaScheduler date={selectedDate} courts={courts} matches={schedulerMatches} blocks={blockSet} />
    </div>
  );
}

