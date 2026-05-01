import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { createCourt, updateCourt } from "./actions";

type CourtRow = {
  id: string;
  name: string | null;
  price: number | null;
  club_id: string;
  surface?: string | null;
  indoor?: boolean | null;
  image_url?: string | null;
};

export default async function AdminCanchasPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: courtsRaw, error } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.courts)
          .select("id,name,price,club_id,surface,indoor,image_url")
          .in("id", ctx.courtIds)
          .order("name")
      : { data: [], error: null };

  const courts = (courtsRaw ?? []) as CourtRow[];

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

      {ctx.clubs.length > 0 ? (
        <details className={`${adminCard} group`}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-[#0461C4] marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-[#0585FC]/20 bg-[#0585FC]/5 px-4 py-2 group-open:border-[#0585FC]/30">
              Nueva cancha +
            </span>
          </summary>
          <form action={createCourt} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Club</span>
              <select
                name="club_id"
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
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
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
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
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Superficie</span>
              <select
                name="surface"
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
                defaultValue="cemento"
              >
                <option value="cemento">Cemento</option>
                <option value="cristal">Cristal</option>
                <option value="cesped sintetico">Césped sintético</option>
                <option value="moqueta">Moqueta</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700">
              <input type="checkbox" name="indoor" className="h-4 w-4 rounded border-slate-300" />
              Techada
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Imagen URL</span>
              <input
                name="image_url"
                type="text"
                placeholder="https://..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-[#0585FC]/30 focus:ring-2 focus:ring-[#0585FC]/20"
              />
            </label>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-slate-900">{c.name ?? "Cancha"}</p>
                  <p className="text-sm font-medium text-[#0461C4]">${c.price ?? 0}/turno</p>
                  <p className="text-xs font-medium text-slate-500">
                    {c.surface ? c.surface : "Superficie no definida"} · {c.indoor ? "Techada" : "Descubierta"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/canchas/${c.id}/horarios`}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#0585FC]/20 hover:bg-[#0585FC]/5"
                  >
                    Horarios
                  </Link>
                  <Link
                    href={`/admin/canchas/${c.id}/precios`}
                    className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#0585FC]/20 hover:bg-[#0585FC]/5"
                  >
                    Precios
                  </Link>
                </div>
              </div>
              <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[#0585FC]/20 hover:bg-[#0585FC]/5">
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
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  />
                  <input
                    name="price"
                    type="number"
                    min={0}
                    required
                    defaultValue={c.price ?? 0}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  />
                  <select
                    name="surface"
                    defaultValue={c.surface ?? "cemento"}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="cemento">Cemento</option>
                    <option value="cristal">Cristal</option>
                    <option value="cesped sintetico">Césped sintético</option>
                    <option value="moqueta">Moqueta</option>
                  </select>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" name="indoor" defaultChecked={Boolean(c.indoor)} className="h-4 w-4 rounded border-slate-300" />
                    Techada
                  </label>
                  <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    Guardar cambios
                  </button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
