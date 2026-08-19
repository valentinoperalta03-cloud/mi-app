import { notFound, redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient } from "@/utils/supabase/server";
import PartidosClient, {
  type OpenMatchParticipant,
  type OpenMatchRow,
  type PartidosClub,
  type PartidosCourt,
} from "./partidos-client";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type RawParticipant = {
  player_id: string | null;
  team: number | null;
  guest_name: string | null;
  profiles: { name: string | null; avatar_url: string | null; category: string | null } | Array<{
    name: string | null;
    avatar_url: string | null;
    category: string | null;
  }> | null;
};

type RawCourtEmbed = {
  id: string;
  name: string | null;
  surface: string | null;
  indoor: boolean | null;
  club_id: string;
};

type RawMatchRow = {
  id: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  duration_minutes: number | null;
  gender_category: "masculino" | "femenino" | "mixto" | null;
  category_range: string[] | null;
  created_by_club: boolean | null;
  court_id: string;
  courts: RawCourtEmbed | RawCourtEmbed[] | null;
  match_participants: RawParticipant[] | null;
};

function firstParticipantCategory(participants: OpenMatchParticipant[]): string | null {
  const owner = participants.find((p) => p.team === 1);
  if (owner?.category) return owner.category;
  return participants.find((p) => p.category)?.category ?? null;
}

export default async function ClubPartidosPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/${slug}/partidos`);
  }

  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select("id,name,slug,logo_url,city,province,business_hours,is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!clubRow) {
    notFound();
  }

  const club = clubRow as PartidosClub & { is_active: boolean };

  const { data: courtsRaw } = await supabase
    .from(DB_TABLES.courts)
    .select("id,name,surface,indoor,price")
    .eq("club_id", club.id)
    .order("name");
  const courts = (courtsRaw ?? []) as PartidosCourt[];

  const { data: profileRow } = await supabase
    .from(DB_TABLES.profiles)
    .select("category, gender")
    .eq("user_id", user.id)
    .maybeSingle();
  const profile = profileRow as { category: string | null; gender: string | null } | null;

  const { data: matchesRaw } = await supabase
    .from(DB_TABLES.matches)
    .select(
      "id, scheduled_date, scheduled_time, duration_minutes, gender_category, category_range, created_by_club, court_id, courts!inner(id,name,surface,indoor,club_id), match_participants(player_id,team,guest_name,profiles(name,avatar_url,category))"
    )
    .eq("match_type", "amistoso")
    .neq("match_status", "cancelled")
    .gt("date", new Date().toISOString())
    .eq("courts.club_id", club.id)
    .order("scheduled_date", { ascending: true });

  const openMatches: OpenMatchRow[] = ((matchesRaw ?? []) as unknown as RawMatchRow[]).map((row) => {
    const courtEmbed = Array.isArray(row.courts) ? row.courts[0] ?? null : row.courts;
    const participants: OpenMatchParticipant[] = ((row.match_participants ?? []) as RawParticipant[]).map((p) => {
      const prof = Array.isArray(p.profiles) ? p.profiles[0] ?? null : p.profiles;
      return {
        player_id: p.player_id,
        team: p.team ?? null,
        name: p.guest_name?.trim() || prof?.name || null,
        avatar_url: p.guest_name ? null : (prof?.avatar_url ?? null),
        category: prof?.category ?? null,
      };
    });
    return {
      id: row.id,
      scheduled_date: row.scheduled_date,
      scheduled_time: row.scheduled_time,
      duration_minutes: row.duration_minutes,
      gender_category: row.gender_category,
      categoryRange: row.category_range ?? null,
      createdByClub: Boolean(row.created_by_club),
      court_name: courtEmbed?.name ?? null,
      court_surface: courtEmbed?.surface ?? null,
      category: firstParticipantCategory(participants),
      participants,
    };
  });

  return (
    <PartidosClient
      club={club}
      courts={courts}
      playerCategory={profile?.category ?? null}
      playerGender={profile?.gender ?? null}
      openMatches={openMatches}
    />
  );
}
