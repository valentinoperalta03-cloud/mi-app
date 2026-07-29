import Link from "next/link";
import { Check } from "lucide-react";
import { adminCard, adminPressable } from "@/components/admin/admin-premium";
import type { OnboardingItems } from "@/lib/admin/onboarding-check";

export type OnboardingChecklistProps = {
  items: OnboardingItems;
  completedCount: number;
  totalCount: number;
  canReceiveReservations: boolean;
  allCompleted: boolean;
};

const STEPS: Array<{
  key: keyof OnboardingItems;
  title: string;
  description: string;
  href: string;
}> = [
  {
    key: "datos_club",
    title: "Datos del club",
    description: "Nombre, descripción, dirección y WhatsApp",
    href: "/admin/config/informacion",
  },
  {
    key: "fotos",
    title: "Fotos del club",
    description: "Logo y foto de portada",
    href: "/admin/config/informacion",
  },
  {
    key: "horarios",
    title: "Horarios de atención",
    description: "Hora de apertura y cierre del club (en Configuración)",
    href: "/admin/config/informacion",
  },
  {
    key: "canchas",
    title: "Canchas",
    description: "Creá al menos una cancha",
    href: "/admin/canchas",
  },
  {
    key: "precios",
    title: "Precios",
    description: "Configurá el precio por turno de cada cancha",
    href: "/admin/canchas",
  },
  {
    key: "metodos_pago",
    title: "Métodos de pago",
    description: "Elegí cómo cobrar: efectivo, transferencia (alias CBU) o Mercado Pago",
    href: "/admin/config/pagos",
  },
  {
    key: "politica_cancelacion",
    title: "Política de cancelación",
    description: "Definí con cuánta anticipación pueden cancelar los jugadores",
    href: "/admin/config/informacion",
  },
  {
    key: "sena",
    title: "Configurar seña de reserva",
    description: "Definí el monto que el jugador paga para confirmar la reserva",
    href: "/admin/canchas",
  },
];

export default function OnboardingChecklist({
  items,
  completedCount,
  totalCount,
  canReceiveReservations,
  allCompleted,
}: OnboardingChecklistProps) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <section
      className={`${adminCard} space-y-5 border-[#0085FC]/20 bg-gradient-to-br from-[var(--bg-subtle)] via-[var(--bg-card)] to-sky-50/40 ring-1 ring-[#0085FC]/10 dark:border-sky-900/30 dark:from-[var(--bg-app)] dark:via-[var(--bg-subtle)] dark:to-sky-950/20 dark:ring-sky-500/10`}
    >
      <header className="space-y-1">
        <p className="font-admin-display text-xl font-semibold tracking-tight text-[var(--text-primary)]">👋 Bienvenido a PadeLibre</p>
        <p className="text-sm font-medium text-[var(--text-secondary)]">
          Completá estos pasos para empezar a recibir reservas
        </p>
      </header>

      {!canReceiveReservations ? (
        <div className="rounded-2xl border border-[var(--border-error)] bg-[var(--bg-error-subtle)] px-4 py-3 text-sm font-semibold text-[var(--text-error)] shadow-sm">
          🚫 Tu club no puede recibir reservas todavía. Completá al menos: datos básicos, canchas con precio, horarios y
          un método de pago.
        </div>
      ) : null}

      {canReceiveReservations && !allCompleted ? (
        <div className="rounded-2xl border border-[var(--border-warning)] bg-[var(--bg-warning-subtle)] px-4 py-3 text-sm font-semibold text-[var(--text-warning)] shadow-sm">
          ⚠️ Podés recibir reservas pero te faltan algunos pasos para tener el perfil completo.
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          <span>Progreso</span>
          <span className="text-[var(--admin-brand-primary)]">
            {completedCount}/{totalCount} completados
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
          <div
            className="h-full rounded-full bg-brand-gradient transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {STEPS.map((step, index) => {
          const done = items[step.key];
          return (
            <li
              key={step.key}
              className={`flex gap-3 rounded-2xl border px-4 py-3.5 transition ${
                done
                  ? "border-[var(--border-success)] bg-[var(--bg-success-subtle)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-card)]/90"
              }`}
            >
              <div className="flex shrink-0 flex-col items-center pt-0.5">
                {done ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--admin-accent-lima)] text-black shadow-sm">
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  </span>
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-secondary)]">
                    {index + 1}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-bold text-[var(--text-primary)]">{step.title}</p>
                <p className="text-xs font-medium leading-snug text-[var(--text-secondary)]">{step.description}</p>
                <Link
                  href={step.href}
                  prefetch
                  className={`mt-2 inline-flex w-fit items-center rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--admin-brand-primary)] ring-1 ring-[var(--admin-brand-primary)]/25 transition hover:bg-[var(--admin-brand-primary)]/10 ${adminPressable}`}
                >
                  Completar →
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
