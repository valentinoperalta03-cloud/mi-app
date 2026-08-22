import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import TorneosHubClient, { type TorneoRow } from "./torneos-hub-client";

export const dynamic = "force-dynamic";

export default async function AdminTorneosPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (ctx.clubIds.length === 0) redirect("/admin/club");
  const clubId = ctx.clubIds[0]!;

  const { data: rows } = await supabase
    .from(DB_TABLES.tournaments)
    .select(
      "id, name, tournament_type, start_date, end_date, status, max_pairs, club_id",
    )
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

  const torneos: TorneoRow[] = (
    (rows ?? []) as Array<{
      id: string;
      name: string;
      tournament_type: string;
      start_date: string;
      end_date: string;
      status: string;
      max_pairs: number;
    }>
  ).map((t) => ({
    id: t.id,
    name: t.name,
    tournamentType: t.tournament_type,
    startDate: t.start_date,
    endDate: t.end_date,
    status: t.status,
    maxPairs: t.max_pairs,
    registeredCount: countBy.get(t.id) ?? 0,
  }));

  return <TorneosHubClient clubId={clubId} torneos={torneos} />;
}
