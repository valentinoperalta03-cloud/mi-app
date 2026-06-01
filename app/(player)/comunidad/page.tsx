import { redirect } from "next/navigation";
import { fetchRankingsPreview } from "@/lib/rankings-data";
import { createClient } from "@/utils/supabase/server";
import { ComunidadClient } from "./comunidad-client";

type ComunidadPageProps = {
  searchParams?: Promise<{ tab?: string | string[] }>;
};

export default async function ComunidadPage({ searchParams }: ComunidadPageProps) {
  const sp = searchParams ? await searchParams : {};
  const raw = sp.tab;
  const tabParam = Array.isArray(raw) ? raw[0] : raw;

  if (tabParam === "jugadores") {
    redirect("/comunidad/jugadores");
  }
  if (tabParam === "para-ti") {
    redirect("/comunidad/para-ti");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rankingsPreview = await fetchRankingsPreview(user.id);

  return <ComunidadClient rankingsPreview={rankingsPreview} userId={user.id} />;
}
