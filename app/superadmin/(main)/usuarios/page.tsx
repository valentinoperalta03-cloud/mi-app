import Image from "next/image";
import Link from "next/link";
import { format, subDays } from "date-fns";
import { toggleUserGlobalBlockAction } from "@/app/superadmin/actions";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

type Filter = "all" | "active" | "blocked" | "new";

const tabs: { key: Filter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "active", label: "Activos" },
  { key: "blocked", label: "Bloqueados" },
  { key: "new", label: "Nuevos (7 días)" },
];

type ProfileOv = {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  profile_created_at: string | null;
  matches_played: number | null;
  category: string | null;
  is_globally_blocked: boolean;
};

export default async function SuperadminUsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const { svc } = await requireSuperadminAction();
  const raw = String(sp.f ?? "all").toLowerCase();
  const filter: Filter = tabs.some((t) => t.key === raw) ? (raw as Filter) : "all";
  const q = String(sp.q ?? "").trim();

  let query = svc.from("superadmin_profiles_overview").select("*").order("profile_created_at", { ascending: false });
  if (q) {
    const esc = q.replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.or(`name.ilike.%${esc}%,email.ilike.%${esc}%`);
  }

  const { data: rowsRaw, error } = await query;
  if (error) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-6 text-rose-100">
        Error al cargar perfiles: {error.message}
      </div>
    );
  }

  const weekAgo = subDays(new Date(), 7);
  let rows = (rowsRaw ?? []) as ProfileOv[];
  if (filter === "active") rows = rows.filter((r) => !r.is_globally_blocked);
  if (filter === "blocked") rows = rows.filter((r) => r.is_globally_blocked);
  if (filter === "new") {
    rows = rows.filter((r) => {
      if (!r.profile_created_at) return false;
      return new Date(r.profile_created_at) >= weekAgo;
    });
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold text-white">Usuarios</h1>
        <p className="mt-1 text-sm text-slate-400">Jugadores registrados en la plataforma.</p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="f" value={filter} />
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Buscar
          <input
            name="q"
            defaultValue={q}
            placeholder="Nombre o email"
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <button
          type="submit"
          className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "all" ? `/superadmin/usuarios${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/superadmin/usuarios?f=${t.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === t.key ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-500/40" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/40">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Jugador</th>
              <th className="px-4 py-3">Registro</th>
              <th className="px-4 py-3">Partidos</th>
              <th className="px-4 py-3">ELO / Cat.</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Sin resultados.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.user_id} className="text-slate-200">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-slate-800">
                        {r.avatar_url ? (
                          <Image src={r.avatar_url} alt="" fill className="object-cover" sizes="40px" unoptimized />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-xs text-slate-500">?</span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{r.name ?? "Sin nombre"}</p>
                        <p className="text-xs text-slate-500">{r.email ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                    {r.profile_created_at ? format(new Date(r.profile_created_at), "dd/MM/yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">{r.matches_played ?? 0}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {r.category ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.is_globally_blocked ? "bg-rose-500/15 text-rose-200" : "bg-emerald-500/15 text-emerald-200"
                      }`}
                    >
                      {r.is_globally_blocked ? "Bloqueado" : "Activo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link
                        href={`/superadmin/usuarios/${r.user_id}`}
                        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white hover:bg-white/10"
                      >
                        Ver perfil
                      </Link>
                      <form action={toggleUserGlobalBlockAction}>
                        <input type="hidden" name="user_id" value={r.user_id} />
                        <input type="hidden" name="next_blocked" value={r.is_globally_blocked ? "0" : "1"} />
                        <button
                          type="submit"
                          className="rounded-lg border border-white/15 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
                        >
                          {r.is_globally_blocked ? "Desbloquear" : "Bloquear"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
