import { notFound, redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { saveCourtHourlyPrices } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; error?: string }>;
};

const COURT_TURNS = [
  { start: "09:00", end: "10:30" },
  { start: "10:30", end: "12:00" },
  { start: "12:00", end: "13:30" },
  { start: "13:30", end: "15:00" },
  { start: "15:00", end: "16:30" },
  { start: "16:30", end: "18:00" },
  { start: "18:00", end: "19:30" },
  { start: "19:30", end: "21:00" },
  { start: "21:00", end: "22:30" },
  { start: "22:30", end: "23:59" },
] as const;

function decodeErr(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

export default async function AdminCanchaPreciosPage({ params, searchParams }: PageProps) {
  const { id: courtId } = await params;
  const sp = searchParams ? await searchParams : {};
  const saved = sp.saved === "1";
  const errRaw = sp.error?.trim() ?? "";

  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.courtIds.includes(courtId)) notFound();

  const { data: court } = await supabase.from(DB_TABLES.courts).select("id,name,price").eq("id", courtId).maybeSingle();
  if (!court) notFound();

  const { data: rows } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("start_time,price_override")
    .eq("court_id", courtId)
    .is("day_of_week", null)
    .not("start_time", "is", null);

  const byTurnStart = new Map(
    ((rows ?? []) as Array<{ start_time: string | null; price_override: number | null }>)
      .filter((r) => r.start_time)
      .map((r) => [String(r.start_time).slice(0, 5), Number(r.price_override ?? 0)])
  );
  const basePrice = Number((court as { price: number | null }).price ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/canchas" />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Precios por turno</p>
        <h1 className={adminTitle}>{(court as { name: string | null }).name ?? "Cancha"}</h1>
        <p className={adminSubtitle}>Configurá precio por turno (09:00 a 23:59).</p>
      </header>

      {saved ? (
        <div className={`${adminCard} border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800`}>
          Precios guardados correctamente.
        </div>
      ) : null}
      {errRaw ? (
        <div className={`${adminCard} border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800`}>
          {decodeErr(errRaw)}
        </div>
      ) : null}

      <form action={saveCourtHourlyPrices} className={`${adminCard} space-y-4`}>
        <input type="hidden" name="court_id" value={courtId} />
        {COURT_TURNS.map((turn) => (
          <label key={`${turn.start}-${turn.end}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">{turn.start} - {turn.end}</span>
            <input
              type="number"
              min={0}
              step="1"
              name={`price_${turn.start}`}
              defaultValue={byTurnStart.get(turn.start) ?? basePrice}
              className="w-36 rounded-xl border border-slate-300 px-3 py-2 text-right text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
            />
          </label>
        ))}
        <button type="submit" className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
          Guardar precios
        </button>
      </form>
    </div>
  );
}
