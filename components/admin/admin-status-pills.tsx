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

function Pill({
  Icon,
  label,
  className,
}: {
  Icon: LucideIcon;
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold leading-none ${className}`}
    >
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
          className="bg-emerald-100/90 text-emerald-800 ring-1 ring-emerald-200/60"
        />
      );
    case "pending":
      return (
        <Pill
          Icon={Clock}
          label={label}
          className="bg-amber-100/90 text-amber-900 ring-1 ring-amber-200/55"
        />
      );
    case "failed":
      return (
        <Pill
          Icon={Ban}
          label={label}
          className="bg-rose-100/85 text-rose-800 ring-1 ring-rose-200/55"
        />
      );
    case "unknown":
      return (
        <Pill
          Icon={HelpCircle}
          label={label}
          className="bg-slate-100/90 text-slate-600 ring-1 ring-slate-200/70"
        />
      );
    default:
      return (
        <Pill
          Icon={HelpCircle}
          label={label}
          className="bg-violet-100/85 text-violet-800 ring-1 ring-violet-200/55"
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
        className="bg-[#0585FC]/10/90 text-[#0585FC] ring-1 ring-[#0585FC]/20/55"
      />
    );
  }
  return (
    <Pill
      Icon={HeartHandshake}
      label="Amistoso"
      className="bg-fuchsia-100/85 text-fuchsia-900 ring-1 ring-fuchsia-200/50"
    />
  );
}

export function PlayerSegmentPill({ segment }: { segment: "Nuevo" | "Recurrente" }) {
  if (segment === "Recurrente") {
    return (
      <Pill
        Icon={Users}
        label="Recurrente"
        className="bg-[#0585FC]/10/90 text-[#0585FC] ring-1 ring-[#0585FC]/20/55"
      />
    );
  }
  return (
    <Pill
      Icon={UserPlus}
      label="Nuevo"
      className="bg-amber-100/90 text-amber-900 ring-1 ring-amber-200/55"
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
