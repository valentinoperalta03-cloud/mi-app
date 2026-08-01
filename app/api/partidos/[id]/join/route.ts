import { type NextRequest, NextResponse } from "next/server";
import { DB_TABLES } from "@/lib/db-tables";
import { joinMatchAtomic } from "@/lib/join-match-atomic";
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

  const joinResult = await joinMatchAtomic(supabase, matchId, user.id, requestedTeam);
  if (!joinResult.ok) {
    if (joinResult.reason === "already_in") {
      return NextResponse.json({ redirect: `/partidos/${matchId}` });
    }
    if (joinResult.reason === "team_full" || joinResult.reason === "match_full") {
      return NextResponse.json({ redirect: `/partidos/${matchId}?join_error=cupos` });
    }
    if (joinResult.reason === "match_closed") {
      return NextResponse.json({ redirect: `/partidos/${matchId}?join_error=no_disponible` });
    }
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
    await createNotification(supabase, {
      user_id: m.owner_id,
      type: "player_joined",
      title: "Nuevo jugador",
      body: `${joinerName} se unió a tu partido.`,
      match_id: matchId,
    });
  }

  return NextResponse.json({ redirect: `/partidos/${matchId}?join_accepted=1` });
}
