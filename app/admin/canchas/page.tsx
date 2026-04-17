import Link from "next/link";
import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import { createCourt } from "./actions";

type CourtRow = {
  id: string;
  name: string | null;
  price: number | null;
  club_id: string;
};

export default async function AdminCanchasPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const { data: courtsRaw, error } =
    ctx.courtIds.length > 0
      ? await supabase
          .from(DB_TABLES.courts)
          .select("id,name,price,club_id")
          .in("id", ctx.courtIds)
          .order("name")
      : { data: [], error: null };

  const courts = (courtsRaw ?? []) as CourtRow[];

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />
      <header className="space-y-2">
        <p className={`${adminKicker} text-sky-600`}>Canchas</p>
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
          <summary className="cursor-pointer list-none text-sm font-semibold text-sky-700 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-2 group-open:border-sky-300">
              Nueva cancha +
            </span>
          </summary>
          <form action={createCourt} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Club</span>
              <select
                name="club_id"
                required
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
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
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
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
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
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
                  <p className="text-sm font-medium text-sky-700">${c.price ?? 0}/turno</p>
                </div>
                <Link
                  href={`/admin/canchas/${c.id}/horarios`}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-sky-200 hover:bg-sky-50"
                >
                  Horarios
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
