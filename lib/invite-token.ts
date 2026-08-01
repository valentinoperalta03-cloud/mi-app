import { createHmac, timingSafeEqual } from "node:crypto";
import { isMatchPrivate } from "@/lib/match-visibility";

function getInviteSecret(): string {
  const secret = process.env.INVITE_SECRET;
  if (!secret) {
    throw new Error("Falta INVITE_SECRET en las variables de entorno.");
  }
  return secret;
}

/** Token firmado (HMAC-SHA256, truncado) para autorizar ver un partido privado sin ser participante. */
export function generateInviteToken(matchId: string): string {
  return createHmac("sha256", getInviteSecret()).update(matchId).digest("hex").slice(0, 16);
}

export function verifyInviteToken(matchId: string, token: string | null | undefined): boolean {
  const provided = String(token ?? "").trim();
  if (!provided) return false;
  const expected = generateInviteToken(matchId);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/** Link para compartir un partido: privado lleva el token de invitación firmado, público va pelado. */
export function buildMatchShareUrl(matchId: string, visibility: string | null | undefined): string {
  const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://padelibre.app";
  const base = `${siteOrigin}/partidos/${matchId}`;
  return isMatchPrivate(visibility) ? `${base}?invite=${generateInviteToken(matchId)}` : base;
}
