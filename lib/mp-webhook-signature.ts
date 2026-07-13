import { createHmac, timingSafeEqual } from "crypto";
import { log } from "@/lib/logger";

/**
 * Verifica el header `x-signature` de un webhook de Mercado Pago segun el
 * esquema documentado (ts + v1 en base al manifest `id:...;request-id:...;ts:...;`
 * firmado con HMAC-SHA256 y el secret configurado en el panel de desarrolladores).
 *
 * Si `MP_WEBHOOK_SECRET` no esta configurado, no hay secret con el cual
 * verificar: se permite la notificacion (igual que el resto de webhooks de
 * este proyecto hoy) pero se loguea una advertencia.
 */
export function verifyMpWebhookSignature(req: Request, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    log.warn({ event: "mp.webhook.signature.not_configured" });
    return true;
  }

  const signatureHeader = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");
  if (!signatureHeader || !requestId || !dataId) {
    log.warn({ event: "mp.webhook.signature.missing_headers" });
    return false;
  }

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((pair) => {
      const [key, value] = pair.split("=");
      return [key?.trim(), value?.trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) {
    log.warn({ event: "mp.webhook.signature.malformed_header" });
    return false;
  }

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const gotBuf = Buffer.from(v1, "hex");
  const valid = expectedBuf.length === gotBuf.length && timingSafeEqual(expectedBuf, gotBuf);
  if (!valid) {
    log.warn({ event: "mp.webhook.signature.mismatch" });
  }
  return valid;
}
