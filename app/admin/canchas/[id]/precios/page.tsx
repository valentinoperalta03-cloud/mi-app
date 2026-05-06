import { notFound, redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { type RangeKey } from "./actions";
import PreciosForm, { type RangeFormInitial } from "./precios-form";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string; error?: string }>;
};

const DEFAULTS: Record<RangeKey, { start: string; end: string }> = {
  manana: { start: "06:00", end: "12:00" },
  tarde: { start: "12:00", end: "18:00" },
  noche: { start: "18:00", end: "23:00" },
};

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

  const basePrice = Number((court as { price: number | null }).price ?? 0);
  const courtName = (court as { name: string | null }).name ?? "Cancha";

  const { data: bandRows } = await supabase
    .from(DB_TABLES.courtSchedules)
    .select("start_time,end_time,price_override,range_name")
    .eq("court_id", courtId)
    .is("day_of_week", null)
    .not("range_name", "is", null);

  const empty = (key: RangeKey): RangeFormInitial => ({
    active: false,
    start: DEFAULTS[key].start,
    end: DEFAULTS[key].end,
    price: basePrice,
  });

  const initial: Record<RangeKey, RangeFormInitial> = {
    manana: empty("manana"),
    tarde: empty("tarde"),
    noche: empty("noche"),
  };

  for (const row of bandRows ?? []) {
    const k = String((row as { range_name: string | null }).range_name ?? "")
      .toLowerCase()
      .trim();
    if (k !== "manana" && k !== "tarde" && k !== "noche") continue;
    const rk = k as RangeKey;
    initial[rk] = {
      active: true,
      start: String((row as { start_time: string | null }).start_time ?? "").slice(0, 5) || DEFAULTS[rk].start,
      end: String((row as { end_time: string | null }).end_time ?? "").slice(0, 5) || DEFAULTS[rk].end,
      price: Number((row as { price_override: number | null }).price_override ?? basePrice),
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/canchas" />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Precios por franja</p>
        <h1 className={adminTitle}>{courtName}</h1>
        <p className={adminSubtitle}>
          Activá una o más franjas (mañana, tarde, noche), definí horario cada 30 minutos y el precio en pesos.
        </p>
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

      <PreciosForm courtId={courtId} initial={initial} />
    </div>
  );
}
