import type { LucideIcon } from "lucide-react";
import {
  Ban,
  Clock,
  HeartHandshake,
  HelpCircle,
  Ticket,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

function Pill({
  Icon,
  label,
  variant,
  className,
}: {
  Icon: LucideIcon;
  label: string;
  variant: "brand" | "success" | "warning" | "neutral";
  className: string;
}) {
  return (
    <Badge variant={variant} className={`gap-1 ${className}`}>
      <Icon size={12} strokeWidth={2.25} className="shrink-0 opacity-90" aria-hidden />
      {label}
    </Badge>
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
          variant="neutral"
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

export function MatchTypePill({ isCompetitive }: { isCompetitive: boolean | null }) {
  if (isCompetitive === null || isCompetitive === undefined) {
    return null;
  }
  if (isCompetitive) {
    return (
      <Pill
        Icon={Trophy}
        label="Competitivo"
        variant="brand"
        className=""
      />
    );
  }
  return (
    <Pill
      Icon={HeartHandshake}
      label="Amistoso"
      variant="brand"
      className=""
    />
  );
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
      variant="warning"
      className=""
    />
  );
}

export function PlayerAvatar({ name }: { name: string }) {
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <div
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0585FC] to-indigo-100 text-base font-bold text-[#0585FC] ring-1 ring-[#0585FC]/20/50"
      aria-hidden
    >
      {initial}
    </div>
  );
}
