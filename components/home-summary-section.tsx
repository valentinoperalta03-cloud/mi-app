import { Calendar, Star, Trophy } from "lucide-react";
import { fetchHomeSummary } from "@/lib/home-summary";
import { splitOfficialCategoryLine } from "@/lib/profile-display";
import { createClient } from "@/utils/supabase/server";

export async function HomeSummarySection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const summary = await fetchHomeSummary(supabase, userId);
  const nivelParts = splitOfficialCategoryLine(summary.nivelLine);

  return (
    <div className="grid grid-cols-3 gap-3" suppressHydrationWarning>
      <article className="flex flex-col items-center justify-center rounded-[2rem] border border-slate-200/80 bg-white px-2 py-5 text-center shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
        <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
          <Trophy size={18} strokeWidth={2.1} aria-hidden />
        </span>
        <p className="text-xl font-bold tabular-nums text-slate-900">{summary.matchesPlayed}</p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Partidos
        </p>
      </article>
      <article className="flex flex-col items-center justify-center rounded-[2rem] border border-slate-200/80 bg-white px-2 py-5 text-center shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
        <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-[#0085FC]/10 text-[#0085FC]">
          <Calendar size={18} strokeWidth={2.1} aria-hidden />
        </span>
        <p className="text-xl font-bold tabular-nums text-slate-900">
          {summary.activeReservasCount}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Reservas
        </p>
      </article>
      <article className="flex flex-col items-center justify-center rounded-[2rem] border border-slate-200/80 bg-white px-2 py-5 text-center shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]">
        <span className="mb-1 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Star size={18} strokeWidth={2.1} aria-hidden />
        </span>
        <p className="line-clamp-2 min-h-[3rem] text-sm font-bold leading-tight text-[#0085FC]">
          {nivelParts.category || summary.nivelLine || "—"}
        </p>
        <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Nivel</p>
      </article>
    </div>
  );
}
