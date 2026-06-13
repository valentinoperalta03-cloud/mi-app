import { type NextRequest, NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { createParticipantMercadoPagoCheckout } from "@/lib/match-payments";
import { createNotification } from "@/lib/notifications";
import { createClient, createServiceClient } from "@/utils/supabase/server";

function addPlayerToGroup(matchId: string, playerId: string) {
  const service = createServiceClient();
  return service
    .from(DB_TABLES.groupChats)
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle()
    .then(({ data: group }) => {
      const groupId = (group as { id?: string } | null)?.id;
      if (!groupId) return;
      return service.from(DB_TABLES.groupChatMembers).insert({
        group_id: groupId,
        user_id: playerId,
        role: "member",
      });
    });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  const supabase = await createClient({ allowCookieWrites: true });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ redirect: "/login" });

  const formData = await request.formData();
  const paymentMethod = String(formData.get("payment_method") ?? "").trim() as
    | "mercadopago"
    | "cash"
    | "transfer";
  const teamRaw = String(formData.get("team") ?? "");
  const requestedTeam: 1 | 2 | null = teamRaw === "1" ? 1 : teamRaw === "2" ? 2 : null;

  const { data: matchRow } = await supabase
    .from(DB_TABLES.matches)
    .select("id, owner_id, match_status, level_restricted, gender_category, court_id")
    .eq("id", matchId)
    .maybeSingle();

  if (!matchRow) return NextResponse.json({ redirect: "/buscar-partido" });

  const m = matchRow as {
    owner_id: string | null;
    match_status: string | null;
    level_restricted: boolean | null;
    gender_category: string | null;
    court_id: string | null;
  };

  const matchStatus = String(m.match_status ?? "").toLowerCase();
  if (matchStatus === "cancelled" || matchStatus === "full" || matchStatus === "finished") {
    return NextResponse.json({ redirect: `/partidos/${matchId}?join_error=no_disponible` });
  }

  if (m.owner_id === user.id) {
    return NextResponse.json({ redirect: `/partidos/${matchId}` });
  }

  const { count } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id", { count: "exact", head: true })
    .eq("match_id", matchId);

  if ((count ?? 0) >= 4) {
    return NextResponse.json({ redirect: `/partidos/${matchId}?join_error=cupos` });
  }

  const { data: alreadyIn } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("match_id")
    .eq("match_id", matchId)
    .eq("player_id", user.id)
    .maybeSingle();

  if (alreadyIn) return NextResponse.json({ redirect: `/partidos/${matchId}` });

  if (paymentMethod === "cash" || paymentMethod === "transfer") {
    const { error: payErr } = await supabase.from(DB_TABLES.payments).insert({
      match_id: matchId,
      user_id: user.id,
      status: "invited",
      amount: 0,
      payment_method: paymentMethod,
      team_preference: requestedTeam,
    });
    if (payErr) return NextResponse.json({ redirect: `/partidos/${matchId}?join_error=db` });

    const { error: partErr } = await supabase.from(DB_TABLES.matchParticipants).insert({
      match_id: matchId,
      player_id: user.id,
      team: requestedTeam,
    });
    if (partErr) {
      await supabase
        .from(DB_TABLES.payments)
        .delete()
        .eq("match_id", matchId)
        .eq("user_id", user.id)
        .eq("status", "invited");
      return NextResponse.json({ redirect: `/partidos/${matchId}?join_error=db` });
    }

    await addPlayerToGroup(matchId, user.id);

    if (m.owner_id && m.owner_id !== user.id) {
      const { data: joinerProfile } = await supabase
        .from(DB_TABLES.profiles)
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();
      const joinerName = (joinerProfile as { name?: string | null } | null)?.name?.trim() || "Un jugador";
      const methodLabel = paymentMethod === "cash" ? "efectivo" : "transferencia";
      await createNotification(supabase, {
        user_id: m.owner_id,
        type: "player_joined",
        title: "Nuevo jugador",
        body: `${joinerName} se unió a tu partido. Abonará por ${methodLabel}.`,
        match_id: matchId,
      });
    }

    return NextResponse.json({ redirect: `/partidos/${matchId}?join_accepted=1` });
  }

  const mpRes = await createParticipantMercadoPagoCheckout({
    supabase,
    matchId,
    payerUserId: user.id,
    requestedTeam,
  });

  if (!mpRes.ok) {
    return NextResponse.json({ redirect: `/partidos/${matchId}?join_error=pago` });
  }

  await addPlayerToGroup(matchId, user.id);

  if (m.owner_id && m.owner_id !== user.id) {
    const { data: joinerProfile } = await supabase
      .from(DB_TABLES.profiles)
      .select("name")
      .eq("user_id", user.id)
      .maybeSingle();
    const joinerName = (joinerProfile as { name?: string | null } | null)?.name?.trim() || "Un jugador";
    await createNotification(supabase, {
      user_id: m.owner_id,
      type: "player_joined",
      title: "Nuevo jugador",
      body: `${joinerName} se unió a tu partido. Abonará por Mercado Pago.`,
      match_id: matchId,
    });
  }

  return NextResponse.json({ redirect: mpRes.initPoint });
}
