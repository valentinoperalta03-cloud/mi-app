import { notFound, redirect } from "next/navigation";
import { DB_TABLES } from "@/lib/db-tables";
import { createClient, createServiceClient } from "@/utils/supabase/server";
import ReservarClient, { type ReservarClub, type ReservarCourt } from "./reservar-client";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ReservarPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=/${slug}/reservar`);
  }

  const { data: clubRow } = await supabase
    .from(DB_TABLES.clubs)
    .select(
      "id,name,slug,logo_url,city,province,business_hours,deposit_type,deposit_value,open_time,close_time,contact_phone,whatsapp,is_active"
    )
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!clubRow) {
    notFound();
  }

  const club = clubRow as ReservarClub & { is_active: boolean };

  const { data: courtsRaw } = await supabase
    .from(DB_TABLES.courts)
    .select("id,name,surface,indoor,price")
    .eq("club_id", club.id)
    .order("name");
  const courts = (courtsRaw ?? []) as ReservarCourt[];

  const { data: clubMpRow } = await createServiceClient()
    .from(DB_TABLES.clubs)
    .select("mp_access_token")
    .eq("id", club.id)
    .maybeSingle();
  const clubAccessToken = (clubMpRow as { mp_access_token?: string | null } | null)?.mp_access_token ?? null;

  const canReserveOnline = Boolean(clubAccessToken) && Number(club.deposit_value ?? 0) > 0;

  return <ReservarClient club={club} courts={courts} canReserveOnline={canReserveOnline} />;
}
