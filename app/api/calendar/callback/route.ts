import { NextResponse } from "next/server";

/**
 * Callback de la autorización OAuth de Google Calendar. El intercambio del `code` por
 * el refresh_token se hace una única vez de forma manual (ver README de setup); esta
 * ruta solo evita el 404 si alguien vuelve a abrir el link de autorización.
 */
export async function GET() {
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PadeLibre</title>
  </head>
  <body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#031733;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e2ecf5;">
    <div style="text-align:center;">
      <p style="font-size:40px;margin:0;">✅</p>
      <p style="font-size:18px;font-weight:700;margin:12px 0 0;">Autorización completada</p>
    </div>
  </body>
</html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
