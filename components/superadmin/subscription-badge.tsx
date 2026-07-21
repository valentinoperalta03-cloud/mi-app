import { subscriptionBadge, type SuperadminClubOverview } from "@/lib/superadmin/club-overview";

const toneClass = {
  ok: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  danger: "bg-rose-500/15 text-rose-200 ring-rose-500/30",
  idle: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  info: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
} as const;

export default function SubscriptionBadge({
  row,
}: {
  row: Pick<SuperadminClubOverview, "subscription_status" | "trial_end_date">;
}) {
  const { tone, label } = subscriptionBadge(row);
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${toneClass[tone]}`}>
      {label}
    </span>
  );
}
