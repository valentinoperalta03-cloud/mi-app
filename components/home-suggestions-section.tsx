import Link from "next/link";
import { ProfileAvatar } from "@/components/profile-avatar";
import { HomeSuggestionPlus } from "@/components/home-suggestion-plus";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { fetchSuggestedPlayers } from "@/lib/suggested-players";
import { createClient } from "@/utils/supabase/server";

export async function HomeSuggestionsSection({ userId }: { userId: string }) {
  const supabase = await createClient();
  const list = await fetchSuggestedPlayers(supabase, userId);

  if (list.length === 0) {
    return (
      <p className="rounded-[2rem] border border-dashed border-slate-200/90 bg-white/80 px-4 py-5 text-center text-sm text-slate-500">
        Completá tu nivel de juego en el perfil para ver jugadores parecidos a vos.
      </p>
    );
  }

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
      {list.map((p) => {
        const label = p.name?.trim() || "Jugador";
        const nivelLine = formatProfileNivelFromRow(p);
        const nivelParts = splitOfficialCategoryLine(nivelLine);
        return (
          <div
            key={p.user_id}
            className="w-[10rem] shrink-0 rounded-[2rem] border border-slate-200/80 bg-white p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]"
          >
            <Link href={`/jugador/${p.user_id}`} className="block text-center">
              <div className="mx-auto w-fit">
                <ProfileAvatar
                  avatarUrl={p.avatar_url}
                  name={label}
                  size={56}
                  ringClassName="ring-2 ring-slate-100"
                />
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-semibold text-slate-900">{label}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-[#0461C4]">
                <span className="font-bold">{nivelParts.category || "—"}</span>
                {nivelParts.description ? (
                  <span className="font-medium">{" - "}{nivelParts.description}</span>
                ) : null}
              </p>
            </Link>
            <div className="mt-3 flex justify-center">
              <HomeSuggestionPlus targetUserId={p.user_id} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
