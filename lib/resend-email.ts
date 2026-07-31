import { Resend } from "resend";

function getResendClient(): Resend {
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.RESEND_FROM_EMAIL || "soporte@padelibre.online";

function formatFechaHoraAr(date: string, time: string): string {
  const dt = new Date(`${date}T${time}:00-03:00`);
  const fecha = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(dt);
  return `${fecha}, ${time} hs`;
}

function meetingEmailHtml(params: {
  fullName: string;
  clubName: string;
  date: string;
  time: string;
  meetLink: string;
}): string {
  const fechaHora = formatFechaHoraAr(params.date, params.time);
  return `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#031733;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#031733;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background-color:#0a2240;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0;text-align:center;">
                <span style="font-size:40px;">🎾</span>
                <p style="margin:8px 0 0;color:#ffffff;font-size:18px;font-weight:700;">PadeLibre</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;color:#e2ecf5;font-size:15px;line-height:1.6;">
                <p>Hola ${params.fullName}, tu videollamada con el equipo de PadeLibre está confirmada.</p>
                <p style="margin:20px 0;padding:16px;background-color:#0d2d52;border-radius:12px;">
                  <strong style="color:#ffffff;">Club:</strong> ${params.clubName}<br />
                  <strong style="color:#ffffff;">Fecha y hora:</strong> ${fechaHora}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;text-align:center;">
                <a href="${params.meetLink}" style="display:inline-block;background-color:#0085FC;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;">
                  Unirse a la reunión
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;color:#9fb3c8;font-size:13px;line-height:1.6;">
                <p>Si necesitás cancelar o reprogramar, respondé este email.</p>
                <p style="margin-top:16px;color:#6b839c;">soporte@padelibre.online</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();
}

export async function sendMeetingConfirmationEmail(params: {
  to: string;
  fullName: string;
  clubName: string;
  date: string;
  time: string;
  meetLink: string;
}): Promise<void> {
  await getResendClient().emails.send({
    from: FROM,
    to: params.to,
    subject: "✅ Tu reunión con PadeLibre está confirmada",
    html: meetingEmailHtml(params),
  });
}

export async function sendMeetingCancellationEmail(params: {
  to: string;
  fullName: string;
  clubName: string;
  date: string;
  time: string;
}): Promise<void> {
  const fechaHora = formatFechaHoraAr(params.date, params.time);
  await getResendClient().emails.send({
    from: FROM,
    to: params.to,
    subject: "Tu reunión con PadeLibre fue cancelada",
    html: `
<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background-color:#031733;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#031733;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background-color:#0a2240;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 0;text-align:center;">
                <span style="font-size:40px;">🎾</span>
                <p style="margin:8px 0 0;color:#ffffff;font-size:18px;font-weight:700;">PadeLibre</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;color:#e2ecf5;font-size:15px;line-height:1.6;">
                <p>Hola ${params.fullName}, tu reunión con el equipo de PadeLibre programada para el ${fechaHora} fue cancelada.</p>
                <p>Si querés coordinar un nuevo horario, entrá a <a href="https://padelibre.online/agenda" style="color:#4fa3ff;">padelibre.online/agenda</a>.</p>
                <p style="margin-top:16px;color:#6b839c;">soporte@padelibre.online</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim(),
  });
}
