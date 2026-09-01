import Link from "next/link";
import { format } from "date-fns";
import { notFound } from "next/navigation";
import ClubAnalyticsGrid from "@/components/superadmin/club-analytics-grid";
import ClubHealthBadge from "@/components/superadmin/club-health-badge";
import ClubManagementActionsForm from "@/components/superadmin/club-management-actions-form";
import SubscriptionActionsForm from "@/components/superadmin/subscription-actions-form";
import SubscriptionBadge from "@/components/superadmin/subscription-badge";
import { DB_TABLES } from "@/lib/db-tables";
import { type SuperadminClubOverview } from "@/lib/superadmin/club-overview";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

function money(n: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

const subMessages: Record<string, string> = {
  activated: "Suscripción activada manualmente.",
  trial_activated: "Trial activado manualmente por 15 días.",
  extended: "Trial extendido correctamente.",
  past_due: "Club marcado como pago fallido.",
  paused: "Suscripción pausada.",
  reset: "Suscripción reseteada a pending.",
};

const subErrorMessages: Record<string, string> = {
  dias: "Ingresá una cantidad de días válida para extender el trial.",
  db: "No se pudo actualizar la suscripción. Reintentá o revisá los logs.",
};

const deleteErrorMessages: Record<string, string> = {
  "1": "No se pudo eliminar el club. Puede haber datos vinculados que impiden el borrado.",
  reservas: "No se puede eliminar: el club tiene reservas futuras activas. Cancelalas antes de borrar el club.",
};

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    notif?: string;
    notif_error?: string;
    created?: string;
    delete_error?: string;
    active?: string;
    active_error?: string;
    sub?: string;
    sub_error?: string;
  }>;
};

export default async function SuperadminClubDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const { svc } = await requireSuperadminAction();

  const [{ data: ov }, { data: club }] = await Promise.all([
    svc.from("superadmin_clubs_overview").select("*").eq("id", id).maybeSingle(),
    svc
      .from(DB_TABLES.clubs)
      .select(
        "id,name,location,description,address,contact_phone,whatsapp,instagram,created_at,is_active,mp_access_token,owner_id,accepts_cash,accepts_transfer,bank_alias,bank_cbu,cancellation_policy"
      )
      .eq("id", id)
      .maybeSingle(),
  ]);

  if (!ov || !club) notFound();

  const overview = ov as SuperadminClubOverview;

  const c = club as {
    description: string | null;
    address: string | null;
    contact_phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    accepts_cash: boolean | null;
    accepts_transfer: boolean | null;
    bank_alias: string | null;
    bank_cbu: string | null;
    cancellation_policy: string | null;
  };

  const { data: courts } = await svc.from(DB_TABLES.courts).select("id,name,surface_type").eq("club_id", id).order("name");

  const courtIds = (courts ?? []).map((x) => (x as { id: string }).id);
  const { data: reservas } =
    courtIds.length > 0
      ? await svc
          .from(DB_TABLES.matches)
          .select("id,scheduled_date,scheduled_time,amount_paid,payment_status,match_status,court_id,courts(name)")
          .eq("match_type", "reservation")
          .in("court_id", courtIds)
          .order("scheduled_date", { ascending: false })
          .order("scheduled_time", { ascending: false })
          .limit(20)
      : { data: [] };

  const mpOk = overview.mp_connected;
  const subOk = sp.sub ? subMessages[sp.sub] : null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/superadmin/clubes" className="text-xs font-semibold text-cyan-400 hover:underline">
            ← Clubes
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-white">{overview.name ?? "Club"}</h1>
          <p className="mt-1 text-sm text-slate-400">{overview.location ?? "Sin ciudad"}</p>
        </div>
      </div>

      {sp.created === "1" ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          Club dado de alta correctamente. El dueño puede completar onboarding desde el panel admin.
        </p>
      ) : null}

      {sp.notif === "1" ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          Notificación enviada al owner del club.
        </p>
      ) : null}

      {sp.notif_error === "1" ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          Escribí un mensaje antes de notificar al club.
        </p>
      ) : null}

      {sp.active === "0" ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-4 py-3 text-sm text-amber-100">
          Club dado de baja. Se ocultó de la app del jugador.
        </p>
      ) : null}

      {sp.active === "1" ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          Club reactivado. Vuelve a estar visible en la app del jugador.
        </p>
      ) : null}

      {sp.delete_error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {deleteErrorMessages[sp.delete_error] ?? "No se pudo eliminar el club."}
        </p>
      ) : null}

      {sp.active_error === "1" ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          No se pudo cambiar el estado operativo del club. Reintentá o revisá los logs.
        </p>
      ) : null}

      {subOk ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          {subOk}
        </p>
      ) : null}

      {sp.sub_error ? (
        <p className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-100">
          {subErrorMessages[sp.sub_error] ?? "No se pudo actualizar la suscripción."}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <ClubHealthBadge row={overview} />
        <SubscriptionBadge row={overview} />
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            overview.onboarding_completed
              ? "bg-emerald-500/15 text-emerald-200"
              : "bg-amber-500/15 text-amber-200"
          }`}
        >
          {overview.onboarding_completed ? "Onboarding completo" : "Onboarding pendiente"}
        </span>
      </div>

      <ClubAnalyticsGrid row={overview} />

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Información</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Owner</dt>
            <dd className="font-medium text-slate-200">{overview.owner_email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Registro</dt>
            <dd className="font-medium text-slate-200">
              {overview.club_created_at ? format(new Date(overview.club_created_at), "dd/MM/yyyy HH:mm") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Mercado Pago</dt>
            <dd className={mpOk ? "text-emerald-300" : "text-amber-300"}>{mpOk ? "Conectado" : "No conectado"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Estado</dt>
            <dd className={overview.is_active ? "text-emerald-300" : "text-rose-300"}>{overview.is_active ? "Activo" : "Inactivo"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-slate-500">Dirección</dt>
            <dd className="text-slate-200">{c.address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Teléfono</dt>
            <dd className="text-slate-200">{c.contact_phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">WhatsApp</dt>
            <dd className="text-slate-200">{c.whatsapp ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Efectivo / transferencia</dt>
            <dd className="text-slate-200">
              {c.accepts_cash ? "Efectivo " : ""}
              {c.accepts_transfer ? "Transferencia" : ""}
              {!c.accepts_cash && !c.accepts_transfer ? "—" : ""}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Alias / CBU</dt>
            <dd className="break-all text-slate-200">
              {c.bank_alias ?? "—"} / {c.bank_cbu ?? "—"}
            </dd>
          </div>
          {c.description ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Descripción</dt>
              <dd className="text-slate-300">{c.description}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Canchas</h2>
        <ul className="mt-4 divide-y divide-white/5">
          {(courts ?? []).length === 0 ? (
            <li className="py-3 text-sm text-slate-500">Sin canchas.</li>
          ) : (
            (courts ?? []).map((ct) => {
              const row = ct as { id: string; name: string | null; surface_type: string | null };
              return (
                <li key={row.id} className="flex justify-between py-3 text-sm text-slate-200">
                  <span className="font-medium">{row.name ?? "Cancha"}</span>
                  <span className="text-slate-500">{row.surface_type ?? ""}</span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Últimas 20 reservas</h2>
        <ul className="mt-4 space-y-2">
          {(reservas ?? []).length === 0 ? (
            <li className="text-sm text-slate-500">Sin reservas.</li>
          ) : (
            (reservas ?? []).map((m) => {
              const row = m as {
                id: string;
                scheduled_date: string | null;
                scheduled_time: string | null;
                amount_paid: number | null;
                payment_status: string | null;
                match_status: string | null;
                courts: { name: string | null } | { name: string | null }[] | null;
              };
              const courtRel = Array.isArray(row.courts) ? row.courts[0] : row.courts;
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">
                    {row.scheduled_date} {row.scheduled_time?.slice(0, 5) ?? ""}{" "}
                    <span className="text-slate-500">· {courtRel?.name ?? "Cancha"}</span>
                  </span>
                  <span className="text-slate-400">
                    {money(Number(row.amount_paid ?? 0))} · {row.payment_status ?? "—"} · {row.match_status ?? "—"}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>

      <section id="suscripcion" className="scroll-mt-24 rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-white">Suscripción PadeLibre</h2>
          <SubscriptionBadge row={overview} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">
              {overview.subscription_status === "trial" ? "Vence el trial" : "Próximo cobro"}
            </dt>
            <dd className="text-slate-200">
              {overview.subscription_status === "trial"
                ? overview.trial_end_date
                  ? format(new Date(overview.trial_end_date), "dd/MM/yyyy HH:mm")
                  : "—"
                : overview.next_billing_date
                  ? format(new Date(overview.next_billing_date), "dd/MM/yyyy")
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">ID de suscripción en MP</dt>
            <dd className="break-all font-mono text-xs text-slate-300">{overview.mp_subscription_id ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-slate-500">MP conectado para cobrar a jugadores</dt>
            <dd className={mpOk ? "text-emerald-300" : "text-amber-300"}>{mpOk ? "Sí" : "No"}</dd>
          </div>
        </dl>
        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Acciones manuales</p>
          <SubscriptionActionsForm clubId={id} subscriptionStatus={overview.subscription_status} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
        <h2 className="text-lg font-bold text-white">Gestión del club</h2>
        <div className="mt-4">
          <ClubManagementActionsForm
            clubId={id}
            clubName={overview.name ?? "Club"}
            isActive={Boolean(overview.is_active)}
          />
        </div>
      </section>
    </div>
  );
}
