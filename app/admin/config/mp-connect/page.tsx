import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle, CreditCard, ExternalLink } from "lucide-react";
import AdminBackLink from "@/components/admin/admin-back-link";
import { adminCard, adminKicker, adminSubtitle, adminTitle } from "@/components/admin/admin-premium";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

export default async function MpConnectPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");
  if (!ctx.clubs.length) redirect("/admin/config");

  const club = ctx.clubs[0];

  const { data: clubData } = await supabase
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

      <div className={`${adminCard} flex items-start gap-4`}>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            isConnected ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-amber-50 dark:bg-amber-950/30"
          }`}
        >
          {isConnected ? (
            <CheckCircle size={24} className="text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle size={24} className="text-amber-600 dark:text-amber-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 dark:text-white">
            {isConnected ? "Cuenta conectada ✓" : "Sin conectar"}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isConnected
              ? `Tu club recibe pagos directamente. MP User ID: ${mpUserId ?? "—"}`
              : "Los pagos van a la cuenta de Padelibre hasta que conectes la tuya."}
          </p>
        </div>
      </div>

      <div className={adminCard}>
        <p className="mb-4 font-bold text-slate-900 dark:text-white">¿Cómo funciona?</p>
        <div className="space-y-4">
          {[
            {
              n: "1",
              title: "Jugador paga la reserva",
              desc: "El jugador abona su parte del turno más el 5% de servicio de Padelibre.",
            },
            {
              n: "2",
              title: "MP divide automáticamente",
              desc: "Mercado Pago envía el dinero del turno directamente a tu cuenta y la comisión a Padelibre.",
            },
            {
              n: "3",
              title: "Recibís el dinero",
              desc: "El monto del turno aparece en tu cuenta de MP sin intermediarios.",
            },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0585FC] text-xs font-bold text-white">
                {step.n}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{step.title}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {oauthUrl ? (
        <div className="space-y-3">
          <a
            href={oauthUrl}
            className="flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-base font-bold text-white shadow-[0_4px_16px_rgba(5,133,252,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(5,133,252,0.4)] active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
          >
            <CreditCard size={20} />
            {isConnected ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}
            <ExternalLink size={16} className="opacity-70" />
          </a>

          {isConnected ? (
            <p className="text-center text-xs text-slate-400">
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

      <div className={`${adminCard} bg-slate-50/80 dark:bg-slate-800/50`}>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          💡 Al conectar tu cuenta autorizás a Padelibre a procesar pagos en tu nombre mediante la
          API de Mercado Pago. Podés desconectar en cualquier momento desde tu panel de MP. La
          comisión de Padelibre es del 5% por reserva confirmada.
        </p>
      </div>
    </div>
  );
}
