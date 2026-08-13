import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Clock,
  HelpCircle,
  Ticket,
  UserPlus,
  Users,
} from "lucide-react";
import {
  adminBadgeBrand,
  adminBadgeError,
  adminBadgeLima,
  adminBadgeNeutral,
  adminBadgePending,
} from "@/components/admin/admin-premium";

const pillVariantClasses = {
  brand: adminBadgeBrand,
  success: adminBadgeLima,
  warning: adminBadgePending,
  error: adminBadgeError,
  neutral: adminBadgeNeutral,
} as const;

function Pill({
  Icon,
  label,
  variant,
  className,
}: {
  Icon: LucideIcon;
  label: string;
  variant: keyof typeof pillVariantClasses;
  className: string;
}) {
  return (
    <span className={`gap-1 ${pillVariantClasses[variant]} ${className}`}>
      <Icon size={12} strokeWidth={2.25} className="shrink-0 opacity-90" aria-hidden />
      {label}
    </span>
  );
}

function normalizePayment(raw: string) {
  const s = raw.trim().toLowerCase();
  if (s === "paid" || s === "pagado" || s === "pago") return "paid" as const;
  if (s === "pending" || s === "pendiente") return "pending" as const;
  if (s === "failed" || s === "fallido" || s === "cancelled" || s === "cancelado")
    return "failed" as const;
  if (s === "—" || s === "" || s === "-") return "unknown" as const;
  return "other" as const;
}

export function PaymentStatusPill({ status }: { status: string }) {
  const key = normalizePayment(status);
  const label =
    key === "paid"
      ? "Pagado"
      : key === "pending"
        ? "Pendiente"
        : key === "failed"
          ? "No cobrado"
          : key === "unknown"
            ? "Sin estado"
            : status;

  switch (key) {
    case "paid":
      return (
        <Pill
          Icon={Ticket}
          label={label}
          variant="success"
          className=""
        />
      );
    case "pending":
      return (
        <Pill
          Icon={Clock}
          label={label}
          variant="warning"
          className=""
        />
      );
    case "failed":
      return (
        <Pill
          Icon={Ban}
          label={label}
          variant="error"
          className=""
        />
      );
    case "unknown":
      return (
        <Pill
          Icon={HelpCircle}
          label={label}
          variant="neutral"
          className=""
        />
      );
    default:
      return (
        <Pill
          Icon={HelpCircle}
          label={label}
          variant="brand"
          className=""
        />
      );
  }
}

/** Estado financiero de una inscripción (torneo/clase): distingue seña parcial de pago completo. */
export function FinancialStatusPill({
  financialStatus,
  amountPaid,
  amountPending,
}: {
  financialStatus: string | null | undefined;
  amountPaid?: number | null;
  amountPending?: number | null;
}) {
  const status = String(financialStatus ?? "unpaid").toLowerCase();

  if (status === "fully_paid") {
    return <Pill Icon={Ticket} label="Abonado" variant="success" className="" />;
  }
  if (status === "partially_paid") {
    const title = `Pagó $${Number(amountPaid ?? 0).toLocaleString("es-AR")} · Saldo $${Number(amountPending ?? 0).toLocaleString("es-AR")} en el club`;
    return (
      <span title={title}>
        <Pill Icon={Clock} label="Seña abonada" variant="warning" className="" />
      </span>
    );
  }
  return <Pill Icon={Clock} label="Pendiente" variant="warning" className="" />;
}

export function PlayerSegmentPill({ segment }: { segment: "Nuevo" | "Recurrente" }) {
  if (segment === "Recurrente") {
    return (
      <Pill
        Icon={Users}
        label="Recurrente"
        variant="brand"
        className=""
      />
    );
  }
  return (
    <Pill
      Icon={UserPlus}
      label="Nuevo"
      variant="success"
      className=""
    />
  );
}

export function PlayerAvatar({ name }: { name: string }) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0085FC] to-indigo-100 text-base font-bold text-[#0085FC] ring-1 ring-[#0085FC]/20"
      aria-hidden
    >
      {initial}
    </div>
  );
}
