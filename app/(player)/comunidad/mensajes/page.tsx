import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import MotionPage from "@/components/motion-page";
import { ProfileAvatar } from "@/components/profile-avatar";
import { fetchConversationPreviews } from "@/lib/chat-partners";
import { createClient } from "@/utils/supabase/server";

export default async function MensajesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const conversations = await fetchConversationPreviews(supabase, user.id);

  return (
    <MotionPage className="mx-auto min-h-screen w-full max-w-md bg-slate-50 px-4 pb-32 pt-6">
      <header className="mb-6 space-y-2">
        <Link
          href="/comunidad"
          className="inline-block text-sm font-semibold text-sky-600 hover:text-sky-700"
        >
          ← Comunidad
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mensajes</h1>
        <p className="text-sm text-slate-500">
          Chats con favoritos y compañeros con los que ya hablaste.
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {conversations.map((c) => {
          const when =
            c.lastAt && new Date(c.lastAt).getTime() > 0
              ? formatDistanceToNow(new Date(c.lastAt), { addSuffix: true, locale: es })
              : null;
          return (
            <li key={c.peerId}>
              <Link
                href={`/comunidad/mensajes/${c.peerId}`}
                className="flex items-center gap-4 rounded-[2.5rem] border border-slate-200/80 bg-white p-4 shadow-[0_16px_40px_-28px_rgba(15,23,42,0.15)] transition hover:border-slate-300/90"
              >
                <ProfileAvatar
                  avatarUrl={c.avatar_url}
                  name={c.name}
                  size={52}
                  ringClassName="ring-2 ring-slate-100"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  <p className="line-clamp-1 text-sm text-slate-500">{c.lastPreview}</p>
                  {when ? (
                    <p className="mt-0.5 text-xs font-medium text-slate-400">{when}</p>
                  ) : null}
                </div>
                <span className="text-sky-600">→</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {conversations.length === 0 ? (
        <p className="rounded-[2.5rem] border border-dashed border-slate-200/90 bg-white/90 px-5 py-8 text-center text-sm text-slate-500">
          Agregá jugadores a{" "}
          <Link href="/comunidad/buscar" className="font-semibold text-sky-700 underline">
            favoritos
          </Link>{" "}
          o esperá un mensaje para ver conversaciones acá.
        </p>
      ) : null}
    </MotionPage>
  );
}
