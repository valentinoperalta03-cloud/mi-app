"use server";

import { revalidatePath } from "next/cache";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import { buildPracticeSessionRows } from "@/lib/practice-sessions";
import { createClient } from "@/utils/supabase/server";

export type PublishPracticeState = { ok: boolean; message: string };

export async function publishPracticeAction(practiceId: string): Promise<PublishPracticeState> {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };

  const { data: p } = await supabase
    .from(DB_TABLES.practices)
    .select(
      "id, club_id, status, recurrence_type, start_date, end_date, start_time, weekly_days"
    )
    .eq("id", practiceId)
    .maybeSingle();
  if (!p) return { ok: false, message: "Clase no encontrada." };
  const row = p as {
    club_id: string;
    status: string;
    recurrence_type: "once" | "weekly";
    start_date: string;
    end_date: string;
    start_time: string;
    weekly_days: number[] | null;
  };
  if (!ctx.clubIds.includes(row.club_id)) return { ok: false, message: "Sin permiso." };
  if (row.status !== "draft") return { ok: false, message: "Solo se publican borradores." };

  const timeStr = String(row.start_time).slice(0, 8);
  const sessions = buildPracticeSessionRows({
    recurrenceType: row.recurrence_type,
    startDate: row.start_date,
    endDate: row.end_date,
    startTime: timeStr,
    weeklyDays: row.weekly_days ?? [],
  });
  if (sessions.length === 0) return { ok: false, message: "No hay fechas para publicar." };

  const { error: insErr } = await supabase.from(DB_TABLES.practiceSessions).insert(
    sessions.map((s) => ({
      practice_id: practiceId,
      session_date: s.session_date,
      start_time: s.start_time,
      status: "open",
    }))
  );
  if (insErr) return { ok: false, message: insErr.message };

  const { error: upErr } = await supabase
    .from(DB_TABLES.practices)
    .update({ status: "open" })
    .eq("id", practiceId);
  if (upErr) return { ok: false, message: upErr.message };

  revalidatePath(`/admin/clases/${practiceId}`);
  revalidatePath("/admin/clases");
  revalidatePath("/clases");
  return { ok: true, message: `Publicada con ${sessions.length} fecha(s).` };
}

export async function cancelPracticeAction(practiceId: string): Promise<PublishPracticeState> {
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };

  const { data: p } = await supabase
    .from(DB_TABLES.practices)
    .select("club_id")
    .eq("id", practiceId)
    .maybeSingle();
  if (!p || !ctx.clubIds.includes((p as { club_id: string }).club_id)) {
    return { ok: false, message: "Sin permiso." };
  }

  await supabase.from(DB_TABLES.practices).update({ status: "cancelled" }).eq("id", practiceId);
  await supabase
    .from(DB_TABLES.practiceSessions)
    .update({ status: "cancelled" })
    .eq("practice_id", practiceId)
    .eq("status", "open");

  revalidatePath(`/admin/clases/${practiceId}`);
  revalidatePath("/admin/clases");
  revalidatePath("/clases");
  return { ok: true, message: "Clase cancelada." };
}
