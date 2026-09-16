import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { REASON_BLOQUEO_MANUAL } from "@/lib/admin/day-activity";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import BloqueosClient, { type BlockRow, type ClosedDayRow, type CourtOption } from "./bloqueos-client";

export default async function AdminBloqueosPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const today = getTodayYmdInArgentina();
  // Mismo alcance que las actions: un solo club (el primero del dueño).
  const clubId = ctx.clubIds[0] ?? null;
  const courts: CourtOption[] = ctx.courts
    .filter((c) => c.club_id === clubId)
    .map((c) => ({ id: c.id, name: c.name?.trim() || "Cancha" }));
  const courtIds = courts.map((c) => c.id);
  const courtNameById = new Map(courts.map((c) => [c.id, c.name]));

  const [{ data: closedDaysRaw }, { data: blocksRaw }] = await Promise.all([
    clubId
      ? supabase
          .from(DB_TABLES.clubClosedDays)
          .select("id,closed_date,reason")
          .eq("club_id", clubId)
          .gte("closed_date", today)
          .order("closed_date", { ascending: true })
      : Promise.resolve({ data: [] }),
    courtIds.length
      ? supabase
          .from(DB_TABLES.courtBlocks)
          .select("id,court_id,blocked_date,blocked_time,reason,note")
          .in("court_id", courtIds)
          .eq("reason", REASON_BLOQUEO_MANUAL)
          .gte("blocked_date", today)
          .order("blocked_date", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const closedDays = (closedDaysRaw ?? []) as ClosedDayRow[];
  const blocks: BlockRow[] = ((blocksRaw ?? []) as Array<{
    id: string;
    court_id: string;
    blocked_date: string;
    blocked_time: string | null;
    note: string | null;
  }>)
    .map((b) => ({
      id: b.id,
      courtName: courtNameById.get(b.court_id) ?? "Cancha",
      blocked_date: b.blocked_date,
      blocked_time: String(b.blocked_time ?? "").slice(0, 5),
      note: b.note?.trim() || null,
    }))
    .sort((a, b) => a.blocked_date.localeCompare(b.blocked_date) || a.blocked_time.localeCompare(b.blocked_time));

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <BloqueosClient courts={courts} closedDays={closedDays} blocks={blocks} todayYmd={today} />
    </div>
  );
}
