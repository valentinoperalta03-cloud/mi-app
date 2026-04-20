import OpenMatchesBoard from "@/components/open-matches-board";
import { CreateMatchFab } from "@/components/create-match-fab";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    message?: string;
    kind?: string;
  }>;
};

export default function BuscarPartidoPage({ searchParams }: PageProps) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-slate-50 pb-24">
      <OpenMatchesBoard
        searchParams={searchParams}
        kicker="Comunidad"
        title="Buscar partido"
        description="Revisa partidos disponibles y crea uno nuevo en segundos."
        emptyTitle="No hay partidos abiertos cerca tuyo"
        emptySubtitle="Todavía no hay partidos disponibles en este momento."
        emptyCtaLabel="Sé el primero en organizar uno"
        emptyCtaHref="/crear-partido"
        mobileFirst
      />
      <div className="pointer-events-none fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2">
        <div className="pointer-events-auto relative h-full w-full">
          <div className="absolute bottom-28 right-4">
            <CreateMatchFab href="/crear-partido" />
          </div>
        </div>
      </div>
    </div>
  );
}
