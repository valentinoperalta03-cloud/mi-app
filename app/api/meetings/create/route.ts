import { NextResponse } from "next/server";
import { createCalendarEvent } from "@/lib/google-calendar";
import { DB_TABLES } from "@/lib/db-tables";
import { checkRateLimit } from "@/lib/rate-limit";
import { minutesToClock, parseClockToMinutes } from "@/lib/court-slots";
import { sendMeetingConfirmationEmail } from "@/lib/resend-email";
import { createServiceClient } from "@/utils/supabase/server";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLOT_DURATION_MINUTES = 30;

type Body = {
  fullName?: string;
  clubName?: string;
  email?: string;
  phone?: string;
  date?: string;
  time?: string;
};

async function isSlotWithinAvailability(date: string, time: string): Promise<boolean> {
  const svc = createServiceClient();
  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
  const { data } = await svc
    .from(DB_TABLES.meetingAvailability)
    .select("start_time,end_time,slot_duration_minutes")
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true);

  const requested = parseClockToMinutes(time);
  for (const row of (data ?? []) as Array<{ start_time: string; end_time: string; slot_duration_minutes: number }>) {
    const start = parseClockToMinutes(row.start_time);
    const end = parseClockToMinutes(row.end_time);
    const duration = Math.max(1, Number(row.slot_duration_minutes) || SLOT_DURATION_MINUTES);
    for (let t = start; t + duration <= end; t += duration) {
      if (minutesToClock(t) === minutesToClock(requested)) return true;
    }
  }
  return false;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const fullName = String(body.fullName ?? "").trim();
  const clubName = String(body.clubName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const date = String(body.date ?? "").trim();
  const time = String(body.time ?? "").trim();

  if (!fullName || !clubName || !email || !phone || !date || !time) {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) {
    return NextResponse.json({ error: "Fecha u hora inválida." }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }
  const todayAr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  if (date <= todayAr) {
    return NextResponse.json({ error: "Elegí una fecha a partir de mañana." }, { status: 400 });
  }

  const allowed = await checkRateLimit(`meeting-create:${email}`, 5, 3600);
  if (!allowed) {
    return NextResponse.json({ error: "Demasiados intentos. Probá de nuevo más tarde." }, { status: 429 });
  }

  if (!(await isSlotWithinAvailability(date, time))) {
    return NextResponse.json({ error: "Ese horario ya no está disponible." }, { status: 409 });
  }

  const svc = createServiceClient();

  const { data: inserted, error: insertError } = await svc
    .from(DB_TABLES.meetings)
    .insert({
      full_name: fullName,
      club_name: clubName,
      email,
      phone,
      meeting_date: date,
      meeting_time: time,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      return NextResponse.json({ error: "Ese horario ya no está disponible." }, { status: 409 });
    }
    return NextResponse.json({ error: "No se pudo crear la reunión." }, { status: 500 });
  }

  const meetingId = (inserted as { id: string }).id;

  try {
    const { eventId, meetLink } = await createCalendarEvent({
      title: `Reunión PadeLibre - ${clubName}`,
      description: `Videollamada con ${fullName} de ${clubName}. Teléfono: ${phone}`,
      date,
      time,
      durationMinutes: SLOT_DURATION_MINUTES,
      attendeeEmail: email,
      attendeeName: fullName,
    });

    await svc
      .from(DB_TABLES.meetings)
      .update({ status: "confirmed", google_event_id: eventId, meet_link: meetLink })
      .eq("id", meetingId);

    await sendMeetingConfirmationEmail({ to: email, fullName, clubName, date, time, meetLink });

    return NextResponse.json({ ok: true, meetLink });
  } catch (err) {
    await svc.from(DB_TABLES.meetings).delete().eq("id", meetingId);
    console.error("[meetings/create]", err);
    return NextResponse.json({ error: "No se pudo agendar la reunión. Intentá de nuevo." }, { status: 500 });
  }
}

