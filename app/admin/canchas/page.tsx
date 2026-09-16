import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { courtPriceRange, formatCourtPriceRange, loadCourtPricing } from "@/lib/court-pricing";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import CanchasHubClient, {
  type CourtPriceRow,
  type CourtPriceSummary,
  type CourtRow,
  type CourtTimeRange,
} from "./canchas-hub-client";

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

  // Rango real de precios de cada cancha (reglas por día/horario + precio base),
  // desde la misma fuente que usan las reservas: no mostrar un único precio
  // como universal cuando hay precios variables.
  const pricing = await loadCourtPricing(supabase, courtIds);
  const priceSummaryByCourt = new Map<string, CourtPriceSummary>();
  for (const id of courtIds) {
    const range = courtPriceRange(pricing, id);
    const label = formatCourtPriceRange(range);
    if (range && label) priceSummaryByCourt.set(id, { label, variable: range.min !== range.max });
  }

  const { data: clubHoursRow } = mainClubId
    ? await supabase.from(DB_TABLES.clubs).select("open_time,close_time").eq("id", mainClubId).maybeSingle()
    : { data: null };
  const clubOpenTime = String((clubHoursRow as { open_time?: string | null } | null)?.open_time ?? "").trim().slice(0, 5);
  const clubCloseTime = String((clubHoursRow as { close_time?: string | null } | null)?.close_time ?? "").trim().slice(0, 5);

  const { data: timeRangesRaw } = courtIds.length
    ? await supabase
        .from(DB_TABLES.courtTimeRanges)
        .select("id,court_id,day_of_week,open_time,close_time")
        .in("court_id", courtIds)
    : { data: [] };
  const timeRangesByCourt = new Map<string, CourtTimeRange[]>();
  for (const row of (timeRangesRaw ?? []) as Array<{
    id: string;
    court_id: string;
    day_of_week: number;
    open_time: string;
    close_time: string;
  }>) {
    const list = timeRangesByCourt.get(row.court_id) ?? [];
    list.push({ id: row.id, day_of_week: row.day_of_week, open_time: row.open_time, close_time: row.close_time });
    timeRangesByCourt.set(row.court_id, list);
  }

  // Precios por horario/día de cada cancha (todas las filas con start_time,
  // incluye day_of_week específico y legacy day_of_week IS NULL) — para CourtPricesClient.
  const { data: priceSchedulesRaw } = courtIds.length
    ? await supabase
        .from(DB_TABLES.courtSchedules)
        .select("court_id,day_of_week,start_time,price_override")
        .in("court_id", courtIds)
        .not("start_time", "is", null)
    : { data: [] };
  const priceSchedulesByCourt = new Map<string, CourtPriceRow[]>();
  for (const row of (priceSchedulesRaw ?? []) as Array<{
    court_id: string;
    day_of_week: number | null;
    start_time: string | null;
    price_override: number | null;
  }>) {
    if (!row.start_time) continue;
    const list = priceSchedulesByCourt.get(row.court_id) ?? [];
    list.push({ dayOfWeek: row.day_of_week, startTime: String(row.start_time).slice(0, 5), price: Number(row.price_override ?? 0) });
    priceSchedulesByCourt.set(row.court_id, list);
  }

  return (
    <CanchasHubClient
      courts={courts}
      clubs={ctx.clubs}
      userId={ctx.userId}
      mainClubId={mainClubId}
      clubDepositType={clubDepositType}
      clubDepositValue={clubDepositValue}
      blockedCourtIds={Array.from(blockedCourtIds)}
      priceSummaryByCourt={Array.from(priceSummaryByCourt.entries())}
      clubOpenTime={clubOpenTime}
      clubCloseTime={clubCloseTime}
      timeRangesByCourt={Array.from(timeRangesByCourt.entries())}
      priceSchedulesByCourt={Array.from(priceSchedulesByCourt.entries())}
      errorMessage={error?.message ?? errorParam}
    />
  );
}
