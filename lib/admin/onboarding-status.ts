import type { SupabaseClient } from "@supabase/supabase-js";
import { DB_TABLES } from "@/lib/db-tables";
import { createServiceClient } from "@/utils/supabase/server";

export type AdminOnboardingPhase = {
  id: string;
  phase: number;
  title: string;
  description: string;
  completed: boolean;
  href: string;
};

export type AdminOnboardingStatus = {
  allComplete: boolean;
  completedCount: number;
  totalCount: number;
  phases: AdminOnboardingPhase[];
  clubId: string;
  clubName: string;
};

type ClubOnboardingRow = {
  name: string | null;
  description: string | null;
  city: string | null;
  business_hours: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  cancellation_hours: number | null;
  deposit_value: number | null;
  deposit_type: string | null;
  instagram: string | null;
  whatsapp: string | null;
  facebook: string | null;
  tiktok: string | null;
  services: string[] | null;
};

export async function checkAdminOnboardingStatus(
  supabase: SupabaseClient,
  clubId: string
): Promise<AdminOnboardingStatus> {
  const { data: courtRows } = await supabase
    .from(DB_TABLES.courts)
    .select("id, price")
    .eq("club_id", clubId);
  const courtIds = ((courtRows ?? []) as { id: string }[]).map((c) => c.id);

  const [clubRes, timeRangesRes, mpRes, trainingBlocksRes] = await Promise.all([
    supabase
      .from(DB_TABLES.clubs)
      .select(
        "name, description, city, business_hours, cover_image_url, logo_url, cancellation_hours, deposit_value, deposit_type, instagram, whatsapp, facebook, tiktok, services"
      )
      .eq("id", clubId)
      .maybeSingle(),
    courtIds.length
      ? supabase.from(DB_TABLES.courtTimeRanges).select("id").in("court_id", courtIds).limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
    // mp_access_token esta revocada para anon/authenticated: se lee aparte con service client.
    createServiceClient().from(DB_TABLES.clubs).select("mp_access_token").eq("id", clubId).maybeSingle(),
    supabase.from(DB_TABLES.trainingBlocks).select("id").eq("club_id", clubId).limit(1),
  ]);

  const club = clubRes.data as ClubOnboardingRow | null;
  const hasCourts = courtIds.length > 0;
  const hasTimeRanges = ((timeRangesRes.data ?? []) as { id: string }[]).length > 0;
  const hasMp = Boolean(
    (mpRes.data as { mp_access_token?: string | null } | null)?.mp_access_token?.trim()
  );
  const hasDeposit = Number(club?.deposit_value ?? 0) > 0;
  const hasServices = (club?.services ?? []).length > 0;
  const hasSocials = Boolean(club?.instagram || club?.whatsapp || club?.facebook || club?.tiktok);
  const hasTrainingBlocks = ((trainingBlocksRes.data ?? []) as { id: string }[]).length > 0;

  const phases: AdminOnboardingPhase[] = [
    {
      id: "info",
      phase: 1,
      title: "Información del club",
      description: "Nombre, descripción, ubicación, horarios y fotos",
      completed: Boolean(
        club?.description?.trim() &&
          club?.city?.trim() &&
          club?.business_hours?.trim() &&
          club?.cover_image_url?.trim()
      ),
      href: "/admin/config/informacion",
    },
    {
      id: "canchas",
      phase: 2,
      title: "Canchas",
      description: "Agregá al menos una cancha con precio",
      completed: hasCourts,
      href: "/admin/canchas",
    },
    {
      id: "horarios",
      phase: 3,
      title: "Horarios y precios",
      description: "Configurá los horarios disponibles por cancha",
      completed: hasTimeRanges,
      href: "/admin/canchas",
    },
    {
      id: "cancelacion",
      phase: 4,
      title: "Política de cancelación",
      description: "Definí cuántas horas antes puede cancelar un jugador",
      completed: club?.cancellation_hours != null,
      href: "/admin/config/informacion",
    },
    {
      id: "entrenamientos",
      phase: 5,
      title: "Entrenamientos y clases",
      description: "Configurá los bloques fijos que bloquean canchas",
      completed: hasTrainingBlocks,
      href: "/admin/clases",
    },
    {
      id: "mp",
      phase: 6,
      title: "Conectar Mercado Pago",
      description: "Necesario para recibir señas online",
      completed: hasMp,
      href: "/admin/config/mp-connect",
    },
    {
      id: "sena",
      phase: 7,
      title: "Configurar seña",
      description: "Definí el monto o porcentaje de seña para reservas",
      completed: hasDeposit,
      href: "/admin/config/pagos",
    },
    {
      id: "servicios",
      phase: 8,
      title: "Servicios del club",
      description: "Seleccioná los servicios que aparecen en tu página pública",
      completed: hasServices,
      href: "/admin/config/servicios",
    },
    {
      id: "identidad",
      phase: 9,
      title: "Redes sociales",
      description: "Agregá tus redes para que los jugadores te encuentren",
      completed: hasSocials,
      href: "/admin/config/informacion",
    },
  ];

  const completedCount = phases.filter((p) => p.completed).length;

  return {
    allComplete: completedCount === phases.length,
    completedCount,
    totalCount: phases.length,
    phases,
    clubId,
    clubName: club?.name ?? "Tu club",
  };
}
