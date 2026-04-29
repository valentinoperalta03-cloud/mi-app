import { notFound, redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { saveCourtHourlyPrices } from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

function buildHours() {
  return Array.from({ length: 15 }, (_, idx) => `${String(idx + 8).padStart(2, "0")}:00`);
}

export default async function AdminCanchaPreciosPage({ params }: PageProps) {
  const { id: courtId } = await params;
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
    .not("price_override", "is", null);

  const byHour = new Map(
    ((rows ?? []) as Array<{ start_time: string | null; price_override: number | null }>)
      .filter((r) => r.start_time)
      .map((r) => [String(r.start_time).slice(0, 5), Number(r.price_override ?? 0)])
  );
  const basePrice = Number((court as { price: number | null }).price ?? 0);
  const hours = buildHours();

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/canchas" />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Precios dinámicos</p>
        <h1 className={adminTitle}>{(court as { name: string | null }).name ?? "Cancha"}</h1>
        <p className={adminSubtitle}>Configurá precio por franja horaria (08:00 a 22:00).</p>
      </header>

      <form action={saveCourtHourlyPrices} className={`${adminCard} space-y-4`}>
        <input type="hidden" name="court_id" value={courtId} />
        {hours.map((hour) => (
          <label key={hour} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3">
            <span className="text-sm font-semibold text-slate-700">{hour}</span>
            <input
              type="number"
              min={0}
              step="1"
              name={`price_${hour}`}
              defaultValue={byHour.get(hour) ?? basePrice}
              className="w-36 rounded-xl border border-slate-300 px-3 py-2 text-right text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
            />
          </label>
        ))}
        <button type="submit" className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
          Guardar todo
        </button>
      </form>
    </div>
  );
}
