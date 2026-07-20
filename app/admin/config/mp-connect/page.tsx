import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle, CreditCard, ExternalLink, Info } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import {
  adminAccentBar,
  adminBadgeLima,
  adminBadgePending,
  adminCard,
  adminCTAPrimary,
  adminKicker,
  adminPressable,
  adminSubtitle,
  adminTitle,
} from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";

export default async function MpConnectPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubs.length) redirect("/admin/config");

  const club = ctx.clubs[0];

  // mp_access_token/mp_user_id estan revocadas para anon/authenticated: se leen con service client.
  // La pertenencia del club ya se validó vía getOwnerAdminContext(supabase).
  const { data: clubData } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .select("mp_access_token, mp_user_id, name")
    .eq("id", club.id)
    .maybeSingle();

  const isConnected = Boolean(
    (clubData as { mp_access_token?: string | null } | null)?.mp_access_token
  );
  const mpUserId = (clubData as { mp_user_id?: string | null } | null)?.mp_user_id;

  const appId = process.env.MP_APP_ID;
  const redirectUri =
    process.env.MP_REDIRECT_URI ?? `${process.env.NEXT_PUBLIC_SITE_URL}/api/mp/callback`;

  const oauthUrl = appId
    ? `https://auth.mercadopago.com.ar/authorization?client_id=${appId}&response_type=code&platform_id=mp&state=${club.id}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <AdminBackLink />

      <header className="space-y-2">
        <p className={adminKicker}>Configuración · Cobros</p>
        <h1 className={adminTitle}>Mercado Pago</h1>
        <p className={adminSubtitle}>
          Conectá tu cuenta para recibir los pagos de las reservas directamente.
        </p>
      </header>

      <div className={`${adminCard} ${adminAccentBar} flex items-start gap-4`}>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            isConnected ? "bg-[var(--admin-accent-lima-subtle)]" : "bg-amber-100 dark:bg-amber-950/30"
          }`}
        >
          {isConnected ? (
            <CheckCircle size={24} className="text-[var(--admin-status-active-text)]" />
          ) : (
            <AlertCircle size={24} className="text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-[var(--text-primary)]">
              {isConnected ? "Cuenta conectada" : "Sin conectar"}
            </p>
            <span className={isConnected ? adminBadgeLima : adminBadgePending}>
              {isConnected ? "Conectado" : "Pendiente"}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {isConnected
              ? `Tu club recibe pagos directamente. MP User ID: ${mpUserId ?? "—"}`
              : "Sin conectar tu cuenta de Mercado Pago, los jugadores no van a poder pagar online. Solo vas a poder recibir pagos en efectivo o transferencia directamente en el club."}
          </p>
        </div>
      </div>

      <details className="group overflow-hidden rounded-3xl border border-sky-200 bg-sky-100 dark:border-sky-800/60 dark:bg-sky-900/25">
        <summary className="flex cursor-pointer select-none items-center gap-2.5 px-5 py-4 text-sm font-semibold text-sky-900 marker:content-none dark:text-sky-100">
          <Info size={18} className="shrink-0 text-sky-600 dark:text-sky-400" />
          ¿Cómo funciona la conexión con Mercado Pago?
          <span className="ml-auto text-xs font-normal text-sky-600 dark:text-sky-400 group-open:hidden">Ver guía</span>
          <span className="ml-auto hidden text-xs font-normal text-sky-600 dark:text-sky-400 group-open:inline">Cerrar</span>
        </summary>
        <div className="space-y-4 border-t border-sky-200/60 px-5 pb-5 pt-4 dark:border-sky-800/40">
          {[
            {
              n: "1",
              title: "El organizador paga la seña (si la configuraste)",
              desc: "Si activaste seña para tu cancha, el organizador la paga al crear la reserva o el partido.",
            },
            {
              n: "2",
              title: "El 100% va a tu cuenta",
              desc: "Mercado Pago envía el dinero directamente a tu cuenta. PadeLibre no cobra comisión por reserva.",
            },
            {
              n: "3",
              title: "Recibís el dinero",
              desc: "El monto de la seña aparece en tu cuenta de MP sin intermediarios.",
            },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0585FC] text-xs font-bold text-white">
                {step.n}
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">{step.title}</p>
                <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </details>

      {oauthUrl ? (
        <div className="space-y-3">
          <a
            href={oauthUrl}
            className={`${adminCTAPrimary} ${adminPressable} flex w-full items-center justify-center gap-3`}
          >
            <CreditCard size={20} />
            {isConnected ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}
            <ExternalLink size={16} className="opacity-70" />
          </a>

          {isConnected ? (
            <p className="text-center text-xs text-[var(--text-tertiary)]">
              Ya estás conectado. Podés reconectar si cambiaste de cuenta.
            </p>
          ) : null}
        </div>
      ) : (
        <div className={`${adminCard} border-rose-200/80 bg-rose-50/90 dark:bg-rose-950/20`}>
          <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
            Falta configurar MP_APP_ID en las variables de entorno.
          </p>
        </div>
      )}

      <div className={`${adminCard} bg-[var(--bg-subtle)]`}>
        <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">
          💡 Al conectar tu cuenta autorizás a Padelibre a procesar pagos en tu nombre mediante la
          API de Mercado Pago. Podés desconectar en cualquier momento desde tu panel de MP.
          PadeLibre no cobra comisión por reserva — el 100% de la seña va a tu cuenta.
        </p>
      </div>
    </div>
  );
}
