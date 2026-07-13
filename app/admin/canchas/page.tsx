import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import CourtDepositFields from "@/components/admin/court-deposit-fields";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { createCourt, deleteCourt, updateCourt } from "./actions";
import CourtImageUploader from "./court-image-uploader";

type CourtRow = {
  id: string;
  name: string | null;
  price: number | null;
  club_id: string;
  surface?: string | null;
  indoor?: boolean | null;
  image_url?: string | null;
  requires_deposit?: boolean | null;
  deposit_type?: "percentage" | "fixed" | null;
  deposit_value?: number | null;
};

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
          .select("id,name,price,club_id,surface,indoor,image_url,requires_deposit,deposit_type,deposit_value")
          .in("id", ctx.courtIds)
          .order("name")
      : { data: [], error: null };

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
  const slotPricesByCourt = new Map<string, Array<{ time: string; price: number }>>();
  for (const row of schedules) {
    const time = String(row.start_time ?? "").slice(0, 5);
    if (!time || typeof row.price_override !== "number") continue;
    const list = slotPricesByCourt.get(row.court_id) ?? [];
    list.push({ time, price: row.price_override });
    slotPricesByCourt.set(row.court_id, list);
  }

  function getPriceSummary(courtId: string) {
    const slots = slotPricesByCourt.get(courtId);
    if (!slots || slots.length === 0) return "Sin precios por horario";
    return slots.map((s) => `${s.time}: $${new Intl.NumberFormat("es-AR").format(s.price)}`).join(" · ");
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-[#0585FC]`}>Canchas</p>
        <h1 className={adminTitle}>Mis canchas</h1>
        <p className={adminSubtitle}>Gestioná precios y horarios de cada cancha.</p>
      </header>

      {error ? (
        <div className={`${adminCard} border-rose-200/80 bg-rose-50/90 text-sm font-medium text-rose-800`}>
          {error.message}
        </div>
      ) : null}
      {errorParam ? <div className={`${adminCard} border-rose-200/80 bg-rose-50/90 text-sm font-medium text-rose-800`}>{errorParam}</div> : null}

      {ctx.clubs.length > 0 ? (
        <details className={`${adminCard} group`}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-[#0461C4] marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 px-4 py-2 group-open:border-[#0585FC]/30">
              Nueva cancha +
            </span>
          </summary>
          <form action={createCourt} className="mt-4 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Club</span>
              <select
                name="club_id"
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                defaultValue={ctx.clubs[0]?.id ?? ""}
              >
                {ctx.clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? "Club"}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</span>
              <input
                name="name"
                type="text"
                required
                placeholder="Ej. Cancha 1"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Precio del turno (90 min)
              </span>
              <input
                name="price"
                type="number"
                min={0}
                required
                placeholder="0"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Superficie</span>
              <select
                name="surface"
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                defaultValue="cemento"
              >
                <option value="cemento">Cemento</option>
                <option value="cristal">Cristal</option>
                <option value="cesped sintetico">Césped sintético</option>
                <option value="moqueta">Moqueta</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
              <input type="checkbox" name="indoor" className="h-4 w-4 rounded border-slate-300" />
              Techada
            </label>
            <CourtImageUploader courtId={`new-${ctx.userId}`} label="Imagen de cancha" />
            <button
              type="submit"
              className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Crear cancha
            </button>
          </form>
        </details>
      ) : (
        <p className={`${adminCard} text-sm font-medium text-amber-800`}>
          Necesitás un club asignado para crear canchas.
        </p>
      )}

      {courts.length === 0 ? (
        <p className={`${adminCard} text-center text-sm font-medium text-slate-500`}>
          Todavía no tenés canchas. Creá la primera con el formulario de arriba.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {courts.map((c) => (
            <li key={c.id} className={adminCard}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL pública storage
                    <img src={c.image_url} alt={c.name ?? "Cancha"} className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-200 text-lg font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {(c.name ?? "C").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{c.name ?? "Cancha"}</p>
                    <p className="text-base font-semibold text-[#0461C4]">${c.price ?? 0}/turno</p>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {blockedCourtIds.has(c.id) ? "🔴 Bloqueada hoy" : "🟢 Disponible"}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                      {getPriceSummary(c.id)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {c.surface ? c.surface : "Superficie no definida"} · {c.indoor ? "Techada" : "Descubierta"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link
                    href={`/admin/canchas/${c.id}/horarios`}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#0585FC]/20 hover:bg-[#0585FC]/5 dark:border-slate-700 dark:text-slate-200"
                  >
                    Precios
                  </Link>
                </div>
              </div>
              <details className="mt-4 rounded-2xl border border-slate-200 bg-transparent p-4 dark:border-slate-700">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#0585FC]/20 hover:bg-[#0585FC]/5 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    Editar
                  </span>
                </summary>
                <form action={updateCourt} className="mt-3 space-y-3">
                  <input type="hidden" name="court_id" value={c.id} />
                  <input
                    name="name"
                    type="text"
                    required
                    defaultValue={c.name ?? ""}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    name="price"
                    type="number"
                    min={0}
                    required
                    defaultValue={c.price ?? 0}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <select
                    name="surface"
                    defaultValue={c.surface ?? "cemento"}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="cemento">Cemento</option>
                    <option value="cristal">Cristal</option>
                    <option value="cesped sintetico">Césped sintético</option>
                    <option value="moqueta">Moqueta</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <input type="checkbox" name="indoor" defaultChecked={Boolean(c.indoor)} className="h-4 w-4 rounded border-slate-300" />
                    Techada
                  </label>
                  <CourtImageUploader courtId={c.id} initialUrl={c.image_url ?? ""} label="Imagen de cancha" />
                  <CourtDepositFields
                    defaultRequiresDeposit={Boolean(c.requires_deposit)}
                    defaultDepositType={c.deposit_type ?? null}
                    defaultDepositValue={Number(c.deposit_value ?? 0)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                      Guardar cambios
                    </button>
                    <button
                      type="submit"
                      formAction={deleteCourt}
                      name="court_id"
                      value={c.id}
                      className="rounded-xl border border-rose-300 bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-700 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300"
                    >
                      Eliminar
                    </button>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
