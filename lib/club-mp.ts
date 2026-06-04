/** Club con OAuth MP listo para cobrar con split (token + user id del vendedor). */
export function isClubMercadoPagoConnected(
  club: { mp_access_token?: string | null; mp_user_id?: string | null } | null | undefined
): boolean {
  return Boolean(String(club?.mp_access_token ?? "").trim() && String(club?.mp_user_id ?? "").trim());
}
