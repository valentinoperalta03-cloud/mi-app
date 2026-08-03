import { redirect } from "next/navigation";
import ActivateSubscriptionButton from "@/app/admin/facturacion/activate-subscription-button";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";

const CHECKLIST = [
  "15 días completamente gratis",
  "Sin comisiones por reservas ni partidos",
  "Cancelá cuando quieras desde Mercado Pago",
  "$50.000 ARS/mes después del período de prueba",
];

export default async function ActivacionPage() {
  const supabase = await createClient();
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) redirect("/login");

  const clubId = ctx.clubIds[0] ?? "";
  if (!clubId) redirect("/login");

  // subscription_status esta revocada para authenticated: se lee con service client.
  const { data: clubRow } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .select("subscription_status")
    .eq("id", clubId)
    .maybeSingle();
  const status = (clubRow as { subscription_status?: string | null } | null)?.subscription_status;

  if (status && status !== "pending") {
    redirect("/admin/dashboard");
  }

  const clubName = ctx.clubs[0]?.name ?? "tu club";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-[#031733] px-4 py-12 text-white">
      <div className="w-full max-w-lg text-center">
        <p className="text-2xl">🎾 PadeLibre</p>

        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Bienvenido, {clubName}</h1>
        <p className="mt-2 text-lg font-semibold text-sky-300">Activá tu prueba gratuita de 15 días</p>

        <p className="mt-5 text-sm leading-relaxed text-slate-300">
          Para comenzar a usar PadeLibre, activá tu suscripción con débito automático en Mercado Pago.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          No se te cobra nada hasta el día 15. Si no querés continuar, cancelá desde tu cuenta de Mercado
          Pago antes de esa fecha — sin cargos.
        </p>

        <ul className="mt-6 space-y-2 text-left text-sm text-slate-200">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-0.5 text-emerald-400">✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <ActivateSubscriptionButton clubId={clubId} label="Activar prueba gratuita de 15 días" />

        <p className="mt-6 text-xs text-slate-400">
          ¿Dudas? soporte.padelibre@gmail.com | +54 9 341 374-1000
        </p>
      </div>
    </div>
  );
}
