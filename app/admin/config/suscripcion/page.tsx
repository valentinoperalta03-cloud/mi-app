import { redirect } from "next/navigation";
import AdminBackLink from "@/components/admin/admin-back-link";
import {
  adminAccentBar,
  adminBadgeError,
  adminBadgeLima,
  adminBadgeNeutral,
  adminCard,
  adminKicker,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import ActivateSubscriptionButton from "@/app/admin/facturacion/activate-subscription-button";

export const dynamic = "force-dynamic";

const SUBSCRIPTION_PRICE_LABEL = "$50.000 ARS";

function formatDateAr(value: string | null): string {
  if (!value) return "sin definir";
  return new Date(value).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
}

export default async function AdminConfigSuscripcionPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const clubId = ctx.clubIds[0] ?? "";
  if (!clubId) {
    return (
      <div className="flex flex-col gap-6">
        <AdminBackLink href="/admin/config" label="Volver a Configuración" />
        <header className="space-y-2">
          <p className={adminKicker}>Configuración</p>
          <h1 className={adminTitle}>Mi suscripción</h1>
        </header>
        <div className={`${adminCard} p-6 text-sm font-medium text-amber-800`}>
          No encontramos un club asociado a tu cuenta. Contactá a soporte.
        </div>
      </div>
    );
  }

  // subscription_status/trial_end_date/next_billing_date/mp_subscription_id estan
  // revocadas para authenticated, por eso esta consulta usa el service client
  // (mismo patron que app/admin/facturacion/page.tsx).
  const service = createServiceClient();
  const { data: clubRow } = await service
    .from(DB_TABLES.clubs)
    .select("subscription_status, trial_end_date, next_billing_date, mp_subscription_id")
    .eq("id", clubId)
    .maybeSingle();
  const row = clubRow as {
    subscription_status?: string | null;
    trial_end_date?: string | null;
    next_billing_date?: string | null;
    mp_subscription_id?: string | null;
  } | null;

  const status = row?.subscription_status ?? "trial";
  const mpSubscriptionId = row?.mp_subscription_id ?? null;

  const daysLeft = row?.trial_end_date
    ? Math.max(Math.ceil((new Date(row.trial_end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)), 0)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink href="/admin/config" label="Volver a Configuración" />
      <header className="space-y-2">
        <p className={adminKicker}>Configuración</p>
        <h1 className={adminTitle}>Mi suscripción</h1>
        <p className={adminSubtitle}>Plan, estado y facturación.</p>
      </header>

      {status === "pending" ? (
        <section
          className={`${adminCard} border-[#0085FC]/20 bg-[#0085FC]/5 p-6 dark:border-sky-800 dark:bg-sky-950/20`}
        >
          <p className="text-base font-bold text-[#0461C4] dark:text-sky-300">Activá tu suscripción</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Para empezar a usar PadeLibre necesitás cargar una tarjeta con débito automático. No se te cobra nada
            durante los primeros 15 días.
          </p>
          <ActivateSubscriptionButton clubId={clubId} />
        </section>
      ) : status === "active" ? (
        <section
          className={`${adminCard} border-emerald-200 bg-emerald-50/60 p-6 dark:border-emerald-800 dark:bg-emerald-950/20`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-emerald-800 dark:text-emerald-300">Suscripción activa</p>
            <span className={adminBadgeLima}>Activa</span>
          </div>
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
            Próximo cobro: {formatDateAr(row?.next_billing_date ?? null)} · {SUBSCRIPTION_PRICE_LABEL}
          </p>
        </section>
      ) : status === "trial" ? (
        <section
          className={`${adminCard} border-[#0085FC]/20 bg-[#0085FC]/5 p-6 dark:border-sky-800 dark:bg-sky-950/20`}
        >
          <p className="text-base font-bold text-[#0461C4] dark:text-sky-300">Período de prueba</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {daysLeft != null
              ? `Te ${daysLeft === 1 ? "queda" : "quedan"} ${daysLeft} día${daysLeft === 1 ? "" : "s"} de prueba gratuita.`
              : "Estás en período de prueba gratuita."}{" "}
            Vence el {formatDateAr(row?.trial_end_date ?? null)}.
          </p>
          <ActivateSubscriptionButton clubId={clubId} label="Activar suscripción" />
        </section>
      ) : status === "past_due" ? (
        <section className={`${adminCard} border-rose-200 bg-rose-50/60 p-6 dark:border-rose-800 dark:bg-rose-950/20`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-rose-800 dark:text-rose-300">Pago fallido</p>
            <span className={adminBadgeError}>Atención</span>
          </div>
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">
            Tu pago mensual no pudo procesarse. Actualizá tu método de pago para seguir usando PadeLibre.
          </p>
          <ActivateSubscriptionButton clubId={clubId} label="Reintentar pago" variant="danger" />
        </section>
      ) : status === "paused" ? (
        <section className={`${adminCard} p-6`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-[var(--text-primary)]">Suscripción pausada</p>
            <span className={adminBadgeNeutral}>Pausada</span>
          </div>
          <p className="mt-2 text-sm text-[var(--text-tertiary)]">
            Reactivá tu suscripción para volver a usar el panel de PadeLibre.
          </p>
          <ActivateSubscriptionButton clubId={clubId} label="Reactivar suscripción" />
        </section>
      ) : (
        <section className={`${adminCard} border-rose-200 bg-rose-50/60 p-6 dark:border-rose-800 dark:bg-rose-950/20`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-rose-800 dark:text-rose-300">Necesitás activar tu suscripción</p>
            <span className={adminBadgeError}>Sin activar</span>
          </div>
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-400">
            Activá tu suscripción para seguir usando el panel de PadeLibre.
          </p>
          <ActivateSubscriptionButton clubId={clubId} label="Activar suscripción" />
        </section>
      )}

      <section className={`${adminCard} ${adminAccentBar} p-6`}>
        <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Detalles del plan</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-[var(--text-tertiary)]">Plan</dt>
            <dd className="font-semibold text-[var(--text-primary)]">PadeLibre Club</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-[var(--text-tertiary)]">Precio</dt>
            <dd className="font-semibold text-[var(--text-primary)]">{SUBSCRIPTION_PRICE_LABEL} / mes</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="font-medium text-[var(--text-tertiary)]">Facturación</dt>
            <dd className="font-semibold text-[var(--text-primary)]">Automática vía débito en Mercado Pago</dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-1.5 text-sm text-[var(--text-secondary)]">
          <li>✓ Sin comisiones por reservas, partidos ni torneos</li>
          <li>✓ Soporte incluido</li>
        </ul>
      </section>

      {status === "active" ? (
        <section className={`${adminCard} p-6`}>
          <h2 className="font-admin-display text-base font-bold text-[var(--text-primary)]">Gestionar suscripción</h2>
          <a
            href="https://www.mercadopago.com.ar/subscriptions"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand-primary hover:underline"
          >
            Gestionar en Mercado Pago →
          </a>
          <p className="mt-3 text-sm text-[var(--text-tertiary)]">
            Para cancelar tu suscripción, gestionala directamente desde tu cuenta de Mercado Pago. Tu acceso a
            PadeLibre se mantiene hasta el fin del período pagado.
          </p>
        </section>
      ) : null}

      {mpSubscriptionId ? (
        <p className="text-xs text-[var(--text-tertiary)]">ID de suscripción: {mpSubscriptionId}</p>
      ) : null}
    </div>
  );
}
