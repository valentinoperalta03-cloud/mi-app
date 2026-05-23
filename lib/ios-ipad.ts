/** Detección iPad por User-Agent (servidor y cliente, sin dependencias nativas). */
export function isIosIpadUserAgent(userAgent: string): boolean {
  return (
    /iPad/i.test(userAgent) ||
    (userAgent.includes("Macintosh") && userAgent.includes("Mobile"))
  );
}
