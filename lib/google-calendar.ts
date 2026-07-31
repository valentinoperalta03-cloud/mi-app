import { randomUUID } from "crypto";
import { google } from "googleapis";

/** Argentina no tiene horario de verano desde 2009: offset fijo UTC-3. */
const TIME_ZONE = "America/Argentina/Buenos_Aires";

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Faltan credenciales de Google Calendar (GOOGLE_CALENDAR_*).");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`No se pudo refrescar el access_token de Google Calendar: ${json.error ?? res.status}`);
  }
  return json.access_token;
}

async function getCalendarClient() {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: await getAccessToken() });
  return google.calendar({ version: "v3", auth });
}

export async function createCalendarEvent(params: {
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMinutes: number;
  attendeeEmail: string;
  attendeeName: string;
}): Promise<{ eventId: string; meetLink: string }> {
  const calendar = await getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  const start = new Date(`${params.date}T${params.time}:00-03:00`);
  const end = new Date(start.getTime() + params.durationMinutes * 60_000);

  const { data } = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: params.title,
      description: params.description,
      start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
      end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
      attendees: [{ email: params.attendeeEmail, displayName: params.attendeeName }],
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    },
  });

  const eventId = data.id;
  const meetLink =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;

  if (!eventId || !meetLink) {
    throw new Error("Google Calendar no devolvió el evento o el link de Meet.");
  }

  return { eventId, meetLink };
}

export async function cancelCalendarEvent(eventId: string): Promise<void> {
  const calendar = await getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
  await calendar.events.delete({ calendarId, eventId, sendUpdates: "all" });
}
