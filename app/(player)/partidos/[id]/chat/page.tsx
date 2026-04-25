import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { MatchChat } from "@/components/match-chat";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: { name: string | null; avatar_url: string | null } | null;
};

type Participant = {
  player_id: string;
  name: string | null;
  avatar_url: string | null;
};

export default async function MatchChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: participation } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id")
    .eq("match_id", id)
    .eq("player_id", user.id)
    .maybeSingle();

  if (!participation) redirect(`/partidos/${id}`);

  const { data: participantsRaw } = await supabase
    .from(DB_TABLES.matchParticipants)
    .select("player_id, profiles(name, avatar_url)")
    .eq("match_id", id);

  const participants = ((participantsRaw ?? []) as Array<{
    player_id: string;
    profiles:
      | { name: string | null; avatar_url: string | null }
      | { name: string | null; avatar_url: string | null }[]
      | null;
  }>).map((p) => {
    const profile = Array.isArray(p.profiles) ? p.profiles[0] ?? null : p.profiles;
    return {
      player_id: p.player_id,
      name: profile?.name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    } satisfies Participant;
  });

  const { data: messagesRaw } = await supabase
    .from(DB_TABLES.matchMessages)
    .select("id, match_id, sender_id, content, created_at")
    .eq("match_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  const messages = ((messagesRaw ?? []) as Message[]).map((m) => ({
    ...m,
    profiles: null,
  }));

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md px-4 pb-24 pt-6 space-y-4">
      <header className="space-y-1">
        <Link href={`/partidos/${id}`} className="text-sm font-semibold text-[#0585FC]">
          ← Volver al partido
        </Link>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">
          Chat del partido
        </h1>
      </header>

      <MatchChat
        matchId={id}
        currentUserId={user.id}
        participants={participants}
        initialMessages={messages}
      />
    </MotionPage>
  );
}
