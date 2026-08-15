import type { Metadata } from "next";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

type MetaClubRow = {
  name: string | null;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  province: string | null;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("name,description,logo_url,city,province")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  const club = clubRow as MetaClubRow | null;
  if (!club) {
    return { title: "Club no encontrado — PadeLibre" };
  }

  const clubName = club.name ?? "Club";
  const locationSuffix = [club.city, club.province].filter(Boolean).join(", ");
  const description = `${club.description ?? `Reservá canchas en ${clubName}`}${
    locationSuffix ? ` · ${locationSuffix}` : ""
  }`;
  const ogImage = club.logo_url ?? "/og-image.png";

  return {
    title: `${clubName} — PadeLibre`,
    description,
    openGraph: {
      title: `${clubName} — PadeLibre`,
      description: `Reservá canchas de pádel en ${clubName}`,
      images: [{ url: ogImage }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${clubName} — PadeLibre`,
      images: [ogImage],
    },
  };
}

export default function ClubSlugLayout({ children }: LayoutProps) {
  return <>{children}</>;
}
