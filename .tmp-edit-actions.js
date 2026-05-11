const fs = require("fs");
const p = "c:/Users/PC/mi-app/app/(player)/partidos/[id]/actions.ts";
let text = fs.readFileSync(p, "utf8");
text = text.replace('import { pickTeamForMatch } from "@/lib/match-teams";\n', '');
const old1 = `  if (invitedPayment) {
    const { count: countBeforeInvited, error: invitedCountErr } = await supabase
      .from(DB_TABLES.matchParticipants)
      .select("player_id", { count: "exact", head: true })
      .eq("match_id", matchId);
    if (invitedCountErr || (countBeforeInvited ?? 0) >= 4) {
      redirect(\`/partidos/\${matchId}?join_error=cupos\`);
    }

    const pickedTeam = await pickTeamForMatch(supabase, matchId);
    if (pickedTeam == null) {
      redirect(\`/partidos/\${matchId}?join_error=cupos\`);
    }

    const mpRes = await createParticipantMercadoPagoPreference({
`;
text = text.replace(old1, `  if (invitedPayment) {
    const mpRes = await createParticipantMercadoPagoPreference({
`);
const old2 = `
    const { error: invitedParticipantErr } = await supabase.from(DB_TABLES.matchParticipants).insert({
      match_id: matchId,
      player_id: user.id,
      team: pickedTeam,
    });
    if (invitedParticipantErr && invitedParticipantErr.code !== "23505") {
      console.error("[requestToJoin] invited participant", invitedParticipantErr);
      await supabase.from(DB_TABLES.payments).update({ status: "invited", mp_preference_id: null }).eq(
        "id",
        (invitedPayment as { id: string }).id
      );
      redirect(\`/partidos/\${matchId}?join_error=db\`);
    }
`;
text = text.replace(old2, "\n");
const s1 = text.indexOf('  const teamRaw = getField(formData, "team");');
const e1 = text.indexOf("  const { data: existingPay } = await supabase", s1);
text = text.slice(0, s1) + text.slice(e1);
text = text.replace(`  if (!mpRes.ok) {
    await supabase.from(DB_TABLES.matchParticipants).delete().eq("match_id", matchId).eq("player_id", user.id);
    if ((newCount ?? 0) >= 4) {
      await supabase.from(DB_TABLES.matches).update({ match_status: "scheduled" }).eq("id", matchId);
    }
`, `  if (!mpRes.ok) {
`);
const s2 = text.indexOf("  const pickedTeam = await pickTeamForMatch(supabase, matchId);");
const e2 = text.indexOf("  const { error: uErr } = await supabase", s2);
text = text.slice(0, s2) + text.slice(e2);
text = text.replace(`  if (!mpRes.ok) {
    await supabase.from(DB_TABLES.matchParticipants).delete().eq("match_id", matchId).eq("player_id", playerId);
    await supabase
`, `  if (!mpRes.ok) {
    await supabase
`);
const s3 = text.indexOf("export async function confirmCashPayment(");
const e3 = text.indexOf("export async function cancelFixedSlotDay(", s3);
text =
  text.slice(0, s3) +
  `export async function confirmCashPayment(matchId: string): Promise<{ ok?: true; error?: string }> {
  void matchId;
  return { error: "Los turnos fijos se confirman solo con Mercado Pago." };
}

` +
  text.slice(e3);
text = text.replace(`export async function confirmCashPaymentAction(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const res = await confirmCashPayment(matchId);
  if (res.error) redirect(\`/partidos/\${matchId}?cash_error=\${encodeURIComponent(res.error)}\`);
  redirect(\`/partidos/\${matchId}?cash_ok=1\`);
}
`, `export async function confirmCashPaymentAction(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const res = await confirmCashPayment(matchId);
  redirect(\`/partidos/\${matchId}?join_error=\${encodeURIComponent(res.error ?? "pago")}\`);
}
`);
text = text.replace(`export async function cancelFixedSlotDayAction(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const res = await cancelFixedSlotDay(matchId);
  if (res.error) redirect(\`/partidos/\${matchId}?cash_error=\${encodeURIComponent(res.error)}\`);
  redirect(\`/partidos/\${matchId}?cash_cancel_ok=1\`);
}
`, `export async function cancelFixedSlotDayAction(formData: FormData): Promise<void> {
  const matchId = getField(formData, "match_id");
  const res = await cancelFixedSlotDay(matchId);
  if (res.error) redirect(\`/partidos/\${matchId}?cancel_error=\${encodeURIComponent(res.error)}\`);
  redirect(\`/partidos/\${matchId}?cancel_ok=1\`);
}
`);
fs.writeFileSync(p, text);
console.log("updated actions.ts");
