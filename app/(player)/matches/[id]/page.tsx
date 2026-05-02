import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function MatchRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/partidos/${id}`);
}
