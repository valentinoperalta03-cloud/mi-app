import Link from "next/link";
import { redirect } from "next/navigation";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ChatThread } from "@/components/chat-thread";
import {
  canOpenChatWithPeer,
  fetchThreadMessages,
} from "@/lib/chat-partners";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type PageProps = { params: Promise<{ peerId: string }> };

export default async function ChatPeerPage({ params }: PageProps) {
  const { peerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allowed = await canOpenChatWithPeer(supabase, user.id, peerId);
  if (!allowed) {
    redirect("/comunidad/mensajes");
  }

  const [messages, { data: peer }] = await Promise.all([
    fetchThreadMessages(supabase, user.id, peerId),
    supabase
      .from(DB_TABLES.profiles)
      .select("name, avatar_url")
      .eq("user_id", peerId)
      .maybeSingle(),
  ]);

  const peerRow = peer as { name: string | null; avatar_url: string | null } | null;
  const peerName = peerRow?.name?.trim() || "Jugador";

  return (
    <MotionPage className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col bg-slate-50 px-4 pb-4 pt-6">
      <header className="mb-3 flex shrink-0 items-center gap-3">
        <Link
          href="/comunidad/mensajes"
          className="text-sm font-semibold text-[#0585FC] hover:text-[#0461C4]"
        >
          ←
        </Link>
        <Link href={`/jugador/${peerId}`} className="flex min-w-0 flex-1 items-center gap-2">
          <ProfileAvatar
            avatarUrl={peerRow?.avatar_url ?? null}
            name={peerName}
            size={40}
            ringClassName="ring-2 ring-slate-100"
          />
          <span className="truncate font-semibold text-slate-900">{peerName}</span>
        </Link>
      </header>

      <div className="flex min-h-[calc(100dvh-8rem)] flex-1 flex-col">
        <ChatThread initialMessages={messages} myId={user.id} peerId={peerId} />
      </div>
    </MotionPage>
  );
}
