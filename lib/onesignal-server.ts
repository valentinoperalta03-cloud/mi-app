import "server-only";

// Sin retries: si OneSignal no responde en este plazo se loguea y se sigue.
const ONESIGNAL_TIMEOUT_MS = 8_000;

export async function sendPushNotification(params: {
  userId: string;
  title: string;
  body: string;
  matchId?: string;
  idempotencyKey: string;
}): Promise<void> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    console.error("[push] OneSignal not configured");
    return;
  }

  const payload: Record<string, unknown> = {
    app_id: appId,
    target_channel: "push",
    include_aliases: {
      external_id: [String(params.userId)],
    },
    headings: { en: params.title },
    contents: { en: params.body },
    // OneSignal descarta requests repetidos con la misma key (ventana de 30 días).
    idempotency_key: params.idempotencyKey,
  };

  if (params.matchId) {
    payload.data = { match_id: params.matchId };
  }

  try {
    const res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ONESIGNAL_TIMEOUT_MS),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      console.error("[push] OneSignal error:", res.status, data);
    }
  } catch (err) {
    console.error("Push notification error:", err);
  }
}
