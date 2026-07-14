import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import { toggleUserGlobalBlockAction } from "@/app/superadmin/actions";
import { DB_TABLES } from "@/lib/db-tables";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

function money(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

type PageProps = { params: Promise<{ id: string }> };

export default async function SuperadminUsuarioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { svc } = await requireSuperadminAction();

  const { data: profile } = await svc.from("superadmin_profiles_overview").select("*").eq("user_id", id).maybeSingle();
  if (!profile) notFound();

  const p = profile as {
    user_id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    profile_created_at: string | null;
    matches_played: number | null;
    wins: number | null;
    technical_score: number | null;
    level_of_play: string | null;
    is_globally_blocked: boolean;
  };

  const [{ data: mpRows }, { data: payments }] = await Promise.all([
    svc
      .from(DB_TABLES.matchPlayers)
      .select("match_id")
      .eq("player_id", id)
      .order("match_id", { ascending: false })
      .limit(40),
    svc
      .from(DB_TABLES.payments)
      .select("id,created_at,amount,status,payment_method,match_id")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const matchIds = [...new Set((mpRows ?? []).map((r) => String((r as { match_id: string }).match_id)))].filter(Boolean);

  const { data: matches } =
    matchIds.length > 0
      ? await svc
          .from(DB_TABLES.matches)
          .select("id,scheduled_date,scheduled_time,match_type,match_status,payment_status,courts(name)")
          .in("id", matchIds)
          .order("scheduled_date", { ascending: false })
      : { data: [] };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <Link href="/superadmin/usuarios" className="text-xs font-semibold text-cyan-400 hover:underline">
        ← Usuarios
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-800">
            {p.avatar_url ? (
              <Image src={p.avatar_url} alt="" fill className="object-cover" sizes="80px" unoptimized />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl text-slate-600">?</span>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{p.name ?? "Sin nombre"}</h1>
            <p className="mt-1 text-sm text-slate-400">{p.email ?? "—"}</p>
            <p className="mt-2 text-xs text-slate-500">
              ID: <span className="font-mono text-slate-400">{p.user_id}</span>
            </p>
          </div>
        </div>
        <form action={toggleUserGlobalBlockAction}>
          <input type="hidden" name="user_id" value={p.user_id} />
          <input type="hidden" name="next_blocked" value={p.is_globally_blocked ? "0" : "1"} />
          <button
            type="submit"
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              p.is_globally_blocked
                ? "border border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                : "border border-rose-500/40 bg-rose-500/15 text-rose-100"
            }`}
          >
            {p.is_globally_blocked ? "Desbloquear globalmente" : "Bloquear globalmente"}
          </button>
        </form>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Resumen</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Registro</dt>
            <dd className="text-slate-200">{p.profile_created_at ? format(new Date(p.profile_created_at), "dd/MM/yyyy") : "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Estado</dt>
            <dd className={p.is_globally_blocked ? "text-rose-300" : "text-emerald-300"}>{p.is_globally_blocked ? "Bloqueado" : "Activo"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Partidos jugados</dt>
            <dd className="text-slate-200">{p.matches_played ?? 0}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Victorias</dt>
            <dd className="text-slate-200">{p.wins ?? 0}</dd>
          </div>
          <div>
            <dt className="text-slate-500">ELO técnico</dt>
            <dd className="text-slate-200">{p.technical_score ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Categoría</dt>
            <dd className="text-slate-200">{p.level_of_play ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Historial de partidos / turnos</h2>
        <ul className="mt-4 space-y-2">
          {(matches ?? []).length === 0 ? (
            <li className="text-sm text-slate-500">Sin partidos recientes.</li>
          ) : (
            (matches ?? []).map((m) => {
              const row = m as unknown as {
                id: string;
                scheduled_date: string | null;
                scheduled_time: string | null;
                match_type: string | null;
                match_status: string | null;
                payment_status: string | null;
                courts: { name: string | null } | { name: string | null }[] | null;
              };
              const court = Array.isArray(row.courts) ? row.courts[0] : row.courts;
              return (
                <li key={row.id} className="rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-sm text-slate-300">
                  <span className="font-medium text-white">
                    {row.scheduled_date} {row.scheduled_time?.slice(0, 5) ?? ""}
                  </span>
                  <span className="text-slate-500"> · {court?.name ?? "Cancha"}</span>
                  <span className="ml-2 text-xs text-slate-600">
                    {row.match_type} · {row.match_status}
                    {row.payment_status ? ` · ${row.payment_status}` : ""}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Pagos realizados</h2>
        <ul className="mt-4 space-y-2">
          {(payments ?? []).length === 0 ? (
            <li className="text-sm text-slate-500">Sin pagos registrados.</li>
          ) : (
            (payments ?? []).map((pay) => {
              const row = pay as {
                id: string;
                created_at: string;
                amount: number | null;
                status: string | null;
                payment_method: string | null;
                match_id: string | null;
              };
              return (
                <li key={row.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-sm">
                  <span className="text-slate-300">
                    {format(new Date(row.created_at), "dd/MM/yy HH:mm")} · {row.payment_method ?? "—"} · {row.status ?? "—"}
                  </span>
                  <span className="text-slate-200">{money(Number(row.amount ?? 0))}</span>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
