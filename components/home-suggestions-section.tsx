import Link from "next/link";
import { Users } from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { HomeSuggestionPlus } from "@/components/home-suggestion-plus";
import { formatProfileNivelFromRow, splitOfficialCategoryLine } from "@/lib/profile-display";
import { fetchSuggestedPlayers } from "@/lib/suggested-players";
import { createClient } from "@/utils/supabase/server";

export async function HomeSuggestionsSection({
  userId,
  context = "home",
}: {
  userId: string;
  context?: "home" | "comunidad";
}) {
  const supabase = await createClient();
  const list = await fetchSuggestedPlayers(supabase, userId);

  if (list.length === 0) {
    if (context === "comunidad") {
      return (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-5 py-5 shadow-[var(--shadow-card)] dark:border-slate-700/80">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Jugadores con los que podrías jugar
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Jugá más partidos para ver sugerencias de tu nivel acá.
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200/80 bg-[var(--bg-card)] px-5 py-6 text-center shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)] dark:border-slate-700/80">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0585FC]/12">
          <Users className="h-6 w-6 text-[#0585FC]" strokeWidth={1.75} aria-hidden />
        </div>
        <h3 className="mt-4 text-base font-bold tracking-tight text-[var(--text-primary)]">
          Encontrá jugadores de tu nivel
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          Completá tu perfil para ver jugadores parecidos a vos
        </p>
        <Link
          href="/perfil"
          className="btn-primary-gradient mt-5 inline-flex w-full max-w-[240px] items-center justify-center rounded-2xl py-3 text-sm font-semibold transition hover:brightness-95 active:scale-[0.99]"
        >
          Completar perfil
        </Link>
      </div>
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
            className="w-[10rem] shrink-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.08)]"
          >
            <Link href={`/jugador/${p.user_id}`} className="block text-center">
              <div className="mx-auto w-fit">
                <ProfileAvatar
                  avatarUrl={p.avatar_url}
                  name={label}
                  size={56}
                  ringClassName="ring-2 ring-[var(--border-subtle)]"
                />
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">{label}</p>
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

export async function HomeSuggestedClubs() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, location, logo_url, image_url")
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(6);

  if (error || !data?.length) return null;

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
      {(data as Array<{
        id: string;
        name: string | null;
        location: string | null;
        logo_url: string | null;
        image_url: string | null;
      }>).map((club) => {
        const label = club.name?.trim() || "Club";
        const imgUrl = club.logo_url ?? club.image_url ?? null;
        return (
          <div
            key={club.id}
            className="w-[10rem] shrink-0 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]"
          >
            <Link href={`/clubes/${club.id}`} className="block text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[#0585FC]/10">
                {imgUrl ? (
                  <img src={imgUrl} alt={label} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-[#0585FC]">
                    {label.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">{label}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-tertiary)]">{club.location ?? ""}</p>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
