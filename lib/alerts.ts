import { log } from "@/lib/logger";

const WEBHOOK = process.env.ALERT_WEBHOOK_URL?.trim() || "";
const isProd = process.env.NODE_ENV === "production";

type AlertPayload = {
  source: "app";
  kind: "mp_webhook" | "cron" | "state_machine" | "other";
  title: string;
  detail: string;
  requestId?: string;
};

/**
 * POST opcional a Discord/Slack. Silencioso si no hay URL o no es producción.
 */
export async function sendAlert(payload: AlertPayload): Promise<void> {
  if (!isProd || !WEBHOOK) {
    log.warn({
      event: "alert.skipped",
      kind: payload.kind,
      title: payload.title,
      requestId: payload.requestId,
      msg: payload.detail,
    });
    return;
  }
  try {
    const text = `**${payload.title}**\n${payload.detail}\n\`kind:${payload.kind}\`${payload.requestId ? ` \`req:${payload.requestId}\`` : ""}`;
    const res = await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.slice(0, 1900) }),
    });
    if (!res.ok) {
      log.warn({ event: "alert.http_error", status: res.status, kind: payload.kind });
    }
  } catch (e) {
    log.error({ event: "alert.fetch_failed", err: e, kind: payload.kind });
  }
}
