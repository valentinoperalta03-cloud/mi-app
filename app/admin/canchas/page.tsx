import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { getTodayYmdInArgentina } from "@/lib/datetime-ar";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import CanchasHubClient, { type ClosedDayRow, type CourtRow, type CourtSlotPrice } from "./canchas-hub-client";

export default async function AdminCanchasPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  const sp = (await searchParams) ?? {};
  const errorParam = typeof sp.error === "string" ? sp.error : "";

  const { data: courtsRaw, error } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.courts)
          .select("id,name,price,club_id,surface,indoor,image_url")
          .in("id", ctx.courtIds)
          .order("name")
      : { data: [], error: null };

  const mainClubId = ctx.clubIds[0] ?? "";
  const { data: clubDepositRow } = mainClubId
    ? await supabase.from(DB_TABLES.clubs).select("deposit_type,deposit_value").eq("id", mainClubId).maybeSingle()
    : { data: null };
  const clubDepositType =
    (clubDepositRow as { deposit_type?: "percentage" | "fixed" | null } | null)?.deposit_type ?? null;
  const clubDepositValue = Number((clubDepositRow as { deposit_value?: number | null } | null)?.deposit_value ?? 0);

  const courts = (courtsRaw ?? []) as CourtRow[];
  const today = new Date().toISOString().slice(0, 10);

  const courtIds = courts.map((c) => c.id);
  const { data: blocksRaw } = courtIds.length
    ? await supabase
        .from(DB_TABLES.courtBlocks)
        .select("court_id,id")
        .in("court_id", courtIds)
        .eq("blocked_date", today)
    : { data: [] };
  const blockedCourtIds = new Set((blocksRaw ?? []).map((b: { court_id: string }) => b.court_id));

  // Solo rama precios (day_of_week IS NULL) — los horarios ahora están en court_time_ranges.
  const { data: schedulesRaw } = courtIds.length
    ? await supabase
        .from(DB_TABLES.courtSchedules)
        .select("court_id,start_time,price_override")
        .in("court_id", courtIds)
        .is("day_of_week", null)
        .not("start_time", "is", null)
        .not("price_override", "is", null)
        .order("start_time", { ascending: true })
    : { data: [] };
  const schedules = (schedulesRaw ?? []) as Array<{ court_id: string; start_time: string | null; price_override: number | null }>;
  const slotPricesByCourt = new Map<string, CourtSlotPrice[]>();
  for (const row of schedules) {
    const time = String(row.start_time ?? "").slice(0, 5);
    if (!time || typeof row.price_override !== "number") continue;
    const list = slotPricesByCourt.get(row.court_id) ?? [];
    list.push({ time, price: row.price_override });
    slotPricesByCourt.set(row.court_id, list);
  }

  const { data: closedDaysRaw } = mainClubId
    ? await supabase
        .from(DB_TABLES.clubClosedDays)
        .select("id,closed_date,reason")
        .eq("club_id", mainClubId)
        .gte("closed_date", getTodayYmdInArgentina())
        .order("closed_date", { ascending: true })
    : { data: [] };
  const closedDays = (closedDaysRaw ?? []) as ClosedDayRow[];

  return (
    <CanchasHubClient
      courts={courts}
      clubs={ctx.clubs}
      userId={ctx.userId}
      mainClubId={mainClubId}
      clubDepositType={clubDepositType}
      clubDepositValue={clubDepositValue}
      blockedCourtIds={Array.from(blockedCourtIds)}
      closedDays={closedDays}
      slotPricesByCourt={Array.from(slotPricesByCourt.entries())}
      errorMessage={error?.message ?? errorParam}
    />
  );
}
