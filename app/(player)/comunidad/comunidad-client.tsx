import Link from "next/link";
import { Suspense } from "react";
import { HomeSuggestedClubs, HomeSuggestionsSection } from "@/components/home-suggestions-section";
import { HomeSuggestionsSkeleton } from "@/components/home-loading-skeletons";
import { MessageCircle, Sparkles, Trophy, Users } from "lucide-react";
import MotionPage from "@/components/motion-page";
import type { RankingsPreview } from "@/lib/rankings-data";

type TileVisual = {
  id: string;
  label: string;
  Icon: typeof Sparkles;
  accent: string;
  accentBg: string;
};

const tileVisuals: TileVisual[] = [
  {
    id: "para-ti",
    label: "Para Ti",
    Icon: Sparkles,
    accent: "#0585FC",
    accentBg: "rgba(5,133,252,0.1)",
  },
  {
    id: "jugadores",
    label: "Jugadores",
    Icon: Users,
    accent: "#0585FC",
    accentBg: "rgba(5,133,252,0.1)",
  },
  {
    id: "mensajes",
    label: "Mensajes",
    Icon: MessageCircle,
    accent: "#0585FC",
    accentBg: "rgba(5,133,252,0.1)",
  },
  {
    id: "rankings",
    label: "Rankings",
    Icon: Trophy,
    accent: "#0585FC",
    accentBg: "rgba(5,133,252,0.1)",
  },
];

const hrefs: Record<string, string> = {
  "para-ti": "/comunidad/para-ti",
  jugadores: "/comunidad/jugadores",
  mensajes: "/comunidad/mensajes",
  rankings: "/comunidad/rankings",
};

function ComunidadNavTile({ tile, href, hero = false }: { tile: TileVisual; href: string; hero?: boolean }) {
  if (hero) {
    return (
      <Link
        href={href}
        prefetch
        aria-label={`Ir a ${tile.label}`}
        className="flex items-center gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] transition active:scale-[0.98]"
      >
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "linear-gradient(135deg, #0585FC 0%, #0461C4 100%)" }}
        >
          <tile.Icon size={22} style={{ color: "#CCFF00" }} strokeWidth={2.1} aria-hidden />
        </div>
        <div className="flex-1">
          <p className="text-base font-bold text-[var(--text-primary)]">{tile.label}</p>
          <p className="text-xs text-[var(--text-tertiary)]">Recomendado para vos</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: "#CCFF00", color: "#000" }}
        >
          Nuevo
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      aria-label={`Ir a ${tile.label}`}
      className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-3.5 shadow-[var(--shadow-card)] transition active:scale-[0.96]"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: tile.accentBg }}
      >
        <tile.Icon size={18} style={{ color: tile.accent }} strokeWidth={2.1} aria-hidden />
      </div>
      <p className="text-xs font-bold text-[var(--text-primary)]">{tile.label}</p>
    </Link>
  );
}

export function ComunidadClient({
  rankingsPreview,
  userId,
}: {
  rankingsPreview: RankingsPreview;
  userId: string;
}) {
  return (
    <MotionPage className="mx-auto min-h-screen w-full min-w-0 max-w-md overflow-x-hidden bg-transparent pb-32 pt-5">
      <header className="mx-4 mb-6 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Comunidad</h1>
        <p className="text-sm text-[var(--text-tertiary)]">Conectate con otros jugadores</p>
        {rankingsPreview.myGlobalPosition != null && rankingsPreview.totalRankedPlayers > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--bg-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
            <span>
              Tu ranking global:{" "}
              <Link
                href="/comunidad/rankings"
                prefetch
                className="font-bold text-[#0585FC] underline-offset-2 hover:underline"
              >
                #{rankingsPreview.myGlobalPosition}
              </Link>{" "}
              de {rankingsPreview.totalRankedPlayers} jugadores
            </span>
            {rankingsPreview.weeklyFirstName ? (
              <span className="text-[var(--text-tertiary)]">· Líder de la semana: {rankingsPreview.weeklyFirstName}</span>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-3 px-4">
        <ComunidadNavTile
          tile={tileVisuals[0]}
          href={hrefs["para-ti"] ?? "/comunidad"}
          hero
        />
        <div className="grid grid-cols-3 gap-3">
          {tileVisuals.slice(1).map((tile) => (
            <ComunidadNavTile key={tile.id} tile={tile} href={hrefs[tile.id] ?? "/comunidad"} />
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-5 px-4">
        <section className="space-y-3">
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
            Jugadores con los que podrías jugar
          </h2>
          <Suspense fallback={<HomeSuggestionsSkeleton />}>
            <HomeSuggestionsSection userId={userId} context="comunidad" />
          </Suspense>
        </section>
        <section className="space-y-3">
          <h2 className="text-base font-bold tracking-tight text-[var(--text-primary)]">Clubes cerca tuyo</h2>
          <Suspense fallback={<HomeSuggestionsSkeleton />}>
            <HomeSuggestedClubs />
          </Suspense>
        </section>
      </div>
    </MotionPage>
  );
}
