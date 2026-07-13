import { createHmac, timingSafeEqual } from "node:crypto";

export const SUBSCRIPTION_COOKIE_NAME = "pl_sub_gate";
export const SUBSCRIPTION_COOKIE_MAX_AGE_SECONDS = 5 * 60;

function hmacSecret(): string {
  return (
    process.env.SUBSCRIPTION_COOKIE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 48) ||
    "padelibre-subscription-dev-only"
  );
}

export type CachedClubSubscription = {
  clubId: string;
  status: string;
  trialEndDate: string | null;
};

function encodeField(v: string | null): string {
  return v ? encodeURIComponent(v) : "-";
}

function decodeField(v: string): string | null {
  return v === "-" ? null : decodeURIComponent(v);
}

/** Token: `${exp}.${clubId}.${status}.${trialEndDate}.${sig}`, TTL fijo de 5 min. */
export function signSubscriptionCookie(data: CachedClubSubscription): string {
  const exp = Math.floor(Date.now() / 1000) + SUBSCRIPTION_COOKIE_MAX_AGE_SECONDS;
  const payload = `${exp}.${encodeField(data.clubId)}.${encodeField(data.status)}.${encodeField(data.trialEndDate)}`;
  const sig = createHmac("sha256", hmacSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySubscriptionCookie(
  token: string | undefined,
  expectedClubId: string
): CachedClubSubscription | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [expRaw, clubIdRaw, statusRaw, trialRaw, sig] = parts;

  const exp = Number.parseInt(expRaw ?? "", 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

  const payload = `${expRaw}.${clubIdRaw}.${statusRaw}.${trialRaw}`;
  const expected = createHmac("sha256", hmacSecret()).update(payload).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"))) return null;
  } catch {
    return null;
  }

  const clubId = decodeField(clubIdRaw ?? "-");
  if (clubId !== expectedClubId) return null;

  return {
    clubId,
    status: decodeField(statusRaw ?? "-") ?? "trial",
    trialEndDate: decodeField(trialRaw ?? "-"),
  };
}
