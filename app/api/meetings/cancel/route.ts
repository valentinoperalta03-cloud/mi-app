import { NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { cancelCalendarEvent } from "@/lib/google-calendar";
import { sendMeetingCancellationEmail } from "@/lib/resend-email";
import { requireSuperadminAction } from "@/lib/superadmin/guards";

export async function POST(req: Request) {
  const { svc } = await requireSuperadminAction();

  const body = (await req.json().catch(() => ({}))) as { meetingId?: string };
  const meetingId = String(body.meetingId ?? "").trim();
  if (!meetingId) {
    return NextResponse.json({ error: "Falta meetingId." }, { status: 400 });
  }

  const { data: meeting, error: fetchError } = await svc
    .from(DB_TABLES.meetings)
    .select("id,full_name,club_name,email,meeting_date,meeting_time,google_event_id,status")
    .eq("id", meetingId)
    .maybeSingle();

  if (fetchError || !meeting) {
    return NextResponse.json({ error: "Reunión no encontrada." }, { status: 404 });
  }

  const row = meeting as {
    id: string;
    full_name: string;
    club_name: string;
    email: string;
    meeting_date: string;
    meeting_time: string;
    google_event_id: string | null;
    status: string;
  };

  if (row.status === "cancelled") {
    return NextResponse.json({ ok: true });
  }

  if (row.google_event_id) {
    try {
      await cancelCalendarEvent(row.google_event_id);
    } catch (err) {
      console.error("[meetings/cancel] google", err);
    }
  }

  const { error: updateError } = await svc
    .from(DB_TABLES.meetings)
    .update({ status: "cancelled" })
    .eq("id", meetingId);

  if (updateError) {
    return NextResponse.json({ error: "No se pudo cancelar la reunión." }, { status: 500 });
  }

  try {
    await sendMeetingCancellationEmail({
      to: row.email,
      fullName: row.full_name,
      clubName: row.club_name,
      date: row.meeting_date,
      time: String(row.meeting_time).slice(0, 5),
    });
  } catch (err) {
    console.error("[meetings/cancel] email", err);
  }

  return NextResponse.json({ ok: true });
}
