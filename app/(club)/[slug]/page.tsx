import { notFound, permanentRedirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { isOnboardingComplete } from "@/lib/onboarding-check";
import { createClient } from "@/utils/supabase/server";
import ClubPublicPage, { type PublicClub, type PublicCourt } from "./club-public-page";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ClubSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: redirectRow } = await supabase
    .from(DB_TABLES.clubSlugRedirects)
    .select("club_id")
    .eq("old_slug", slug)
    .maybeSingle();

  if (redirectRow) {
    const { club_id: clubId } = redirectRow as { club_id: string };
    const { data: targetClub } = await supabase
      .from(DB_TABLES.clubs)
      .select("slug")
      .eq("id", clubId)
      .maybeSingle();
    const newSlug = (targetClub as { slug?: string | null } | null)?.slug;
    if (newSlug) permanentRedirect(`/${newSlug}`);
  }

  console.log("[slug page] buscando slug:", slug);

  const { data: clubRow, error: clubError } = await supabase
    .from(DB_TABLES.clubs)
    .select(
      "id,name,slug,description,logo_url,cover_image_url,location,city,province,business_hours,services,instagram,whatsapp,facebook,tiktok,is_active"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  console.log("[slug page] club:", clubRow, "error:", clubError);

  if (!clubRow) {
    console.log("[slug page] notFound() disparado");
    notFound();
  }

  const club = clubRow as PublicClub & { is_active: boolean };

  const { data: courtsRaw } = await supabase
    .from(DB_TABLES.courts)
    .select("id,name,surface,indoor,price")
    .eq("club_id", club.id)
    .order("name");

  const courts = (courtsRaw ?? []) as PublicCourt[];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLoggedIn = Boolean(user);

  let playerName = "";
  let profileComplete = true;
  if (user) {
    const { data: profileRow } = await supabase
      .from(DB_TABLES.profiles)
      .select("name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();
    const p = profileRow as { name?: string | null; avatar_url?: string | null } | null;
    playerName = p?.name?.trim() ?? "";
    profileComplete = await isOnboardingComplete(supabase, user.id);
  }

  return (
    <ClubPublicPage
      club={club}
      courts={courts}
      isLoggedIn={isLoggedIn}
      playerName={playerName}
      profileComplete={profileComplete}
    />
  );
}
