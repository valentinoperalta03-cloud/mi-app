import OpenMatchesBoard from "@/components/open-matches-board";

type PageProps = {
  searchParams?: Promise<{
    message?: string;
    kind?: string;
  }>;
};

export default function PartidosAbiertosPage({ searchParams }: PageProps) {
  return (
    <OpenMatchesBoard
      searchParams={searchParams}
      kicker="Partidos"
      title="Partidos abiertos"
      description="Unite a los próximos partidos según tu nivel y disponibilidad."
    />
  );
}
