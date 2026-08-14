import { redirect } from "next/navigation";
import OpenMatchesBoard from "@/components/open-matches-board";
import { CreateMatchFab } from "@/components/create-match-fab";
import { isOnboardingComplete } from "@/lib/onboarding-check";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    message?: string;
    kind?: string;
  }>;
};

export default async function BuscarPartidoPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const complete = await isOnboardingComplete(supabase, user.id);
  if (!complete) redirect("/completar-perfil");

  return (
    <div className="mx-auto min-h-screen w-full max-w-md bg-[var(--bg-app)] pb-24">
      <OpenMatchesBoard
        searchParams={searchParams}
        title="Buscar partido"
        description="Revisá partidos disponibles y unite en segundos."
        backHref="/home"
        backLabel="Volver al inicio"
        emptyTitle="No hay partidos abiertos cerca tuyo"
        emptySubtitle="Todavía no hay partidos disponibles en este momento."
        emptyCtaLabel=""
        emptyCtaHref=""
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
