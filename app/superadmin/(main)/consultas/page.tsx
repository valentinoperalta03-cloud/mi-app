import Link from "next/link";
import { updateClubLeadStatusAction } from "@/app/superadmin/actions";
import {
  CLUB_LEAD_STATUSES,
  formatWhatsapp,
  isClubLeadStatus,
  problemLabel,
  whatsappHref,
  type ClubLeadStatus,
} from "@/lib/club-leads";
import { DB_TABLES } from "@/lib/db-tables";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

type Filter = "all" | ClubLeadStatus;

type LeadRow = {
  id: string;
  club_name: string;
  whatsapp: string;
  problem: string;
  status: ClubLeadStatus;
  created_at: string;
  contacted_at: string | null;
  updated_by: string | null;
};

const statusBadge: Record<ClubLeadStatus, string> = {
  new: "border-cyan-500/40 bg-cyan-500/10 text-cyan-200",
  contacted: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  converted: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  discarded: "border-slate-500/40 bg-slate-500/10 text-slate-300",
};

const statusLabel = Object.fromEntries(CLUB_LEAD_STATUSES.map((s) => [s.value, s.label])) as Record<ClubLeadStatus, string>;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SuperadminConsultasPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; error?: string }>;
}) {
  const { svc } = await requireSuperadminAction();
  const sp = await searchParams;
  const raw = String(sp.f ?? "new").toLowerCase();
  const filter: Filter = raw === "all" || isClubLeadStatus(raw) ? (raw as Filter) : "new";

  let query = svc
    .from(DB_TABLES.clubLeads)
    .select("id,club_name,whatsapp,problem,status,created_at,contacted_at,updated_by")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter !== "all") query = query.eq("status", filter);
  const { data, error } = await query;
  const leads = (data ?? []) as LeadRow[];

  const { count: newCount } = await svc
    .from(DB_TABLES.clubLeads)
    .select("id", { count: "exact", head: true })
    .eq("status", "new");

  const tabs: { key: Filter; label: string }[] = [
    { key: "new", label: `Nuevas${newCount ? ` (${newCount})` : ""}` },
    { key: "contacted", label: "Contactadas" },
    { key: "converted", label: "Registraron su club" },
    { key: "discarded", label: "Descartadas" },
    { key: "all", label: "Todas" },
  ];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-3xl font-bold text-white">Consultas de clubes</h1>
        <p className="mt-1 text-sm text-slate-400">
          Dueños que dejaron sus datos en /para-clubes para que los contactemos. El número no está verificado.
        </p>
      </header>

      {error || sp.error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {error ? "No se pudieron cargar las consultas." : "No se pudo actualizar el estado. Probá de nuevo."}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "new" ? "/superadmin/consultas" : `/superadmin/consultas?f=${t.key}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === t.key
                ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-500/40"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {leads.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-10 text-center text-sm text-slate-500">
          No hay consultas con este filtro.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {leads.map((l) => (
            <li key={l.id} className="rounded-2xl border border-white/10 bg-slate-900/40 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-white">{l.club_name}</h2>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge[l.status]}`}>
                      {statusLabel[l.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{problemLabel(l.problem)}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Recibida el {formatDate(l.created_at)}
                    {l.contacted_at ? ` · Contactada el ${formatDate(l.contacted_at)}` : ""}
                    {l.updated_by ? ` · Último cambio: ${l.updated_by}` : ""}
                  </p>
                </div>
                <a
                  href={whatsappHref(
                    l.whatsapp,
                    `Hola, ¿cómo estás? Te escribo de PadeLibre por la consulta que dejaste para ${l.club_name}.`
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-4 py-2.5 text-sm font-semibold text-emerald-100 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
                >
                  WhatsApp {formatWhatsapp(l.whatsapp)}
                </a>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-3">
                {CLUB_LEAD_STATUSES.filter((s) => s.value !== l.status).map((s) => (
                  <form key={s.value} action={updateClubLeadStatusAction}>
                    <input type="hidden" name="lead_id" value={l.id} />
                    <input type="hidden" name="status" value={s.value} />
                    <input type="hidden" name="return_filter" value={filter} />
                    <button
                      type="submit"
                      className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                      Marcar como {s.label.toLowerCase()}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
