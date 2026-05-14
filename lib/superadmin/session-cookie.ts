import { createHmac, timingSafeEqual } from "node:crypto";

function hmacSecret(): string {
  return (
    process.env.SUPERADMIN_COOKIE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 48) ||
    "padelibre-superadmin-dev-only"
  );
}

/** Token: `${expSec}.${userId}.${sig}` */
export function signSuperadminSession(userId: string, maxAgeSec = 7 * 24 * 3600): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  const payload = `${exp}.${userId}`;
  const sig = createHmac("sha256", hmacSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifySuperadminSession(token: string | undefined, userId: string): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expRaw, sub, sig] = parts;
  const exp = Number.parseInt(expRaw ?? "", 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  if (sub !== userId) return false;
  const payload = `${exp}.${sub}`;
  const expected = createHmac("sha256", hmacSecret()).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
  } catch {
    return false;
  }
}
