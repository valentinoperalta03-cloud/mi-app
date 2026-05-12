"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOwnerAdminContext } from "@/lib/admin/owner-context";
import { DB_TABLES } from "@/lib/db-tables";
import type { TournamentTypeKey } from "@/lib/tournament-constants";
import { createClient } from "@/utils/supabase/server";

export type CreateTournamentState = { ok: boolean; message: string; id?: string };

export async function createTournamentAction(
  _prev: CreateTournamentState,
  formData: FormData
): Promise<CreateTournamentState> {
  void _prev;
  const supabase = await createClient({ allowCookieWrites: true });
  const ctx = await getOwnerAdminContext(supabase);
  if (!ctx?.userId) return { ok: false, message: "Sesión requerida." };
  if (ctx.clubIds.length === 0) return { ok: false, message: "Primero configurá tu club." };

  const clubId = String(formData.get("club_id") ?? ctx.clubIds[0]).trim();
  if (!ctx.clubIds.includes(clubId)) return { ok: false, message: "Club inválido." };

  const name = String(formData.get("name") ?? "").trim();
  const tournamentType = String(formData.get("tournament_type") ?? "").trim() as TournamentTypeKey;
  const description = String(formData.get("description") ?? "").trim() || null;
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const startTime = String(formData.get("start_time") ?? "").trim().slice(0, 8);
  const registrationDeadline = String(formData.get("registration_deadline") ?? "").trim();
  const maxPairs = Number(formData.get("max_pairs") ?? 16);
  const pricePerPair = Number(formData.get("price_per_pair") ?? 0);
  const prize = String(formData.get("prize") ?? "").trim() || null;
  const cancellationHours = Number(formData.get("cancellation_hours") ?? 24);
  const categoryMinRaw = String(formData.get("category_min") ?? "").trim();
  const categoryMaxRaw = String(formData.get("category_max") ?? "").trim();

  if (!name) return { ok: false, message: "Nombre obligatorio." };
  if (!["americano", "eliminacion", "grupos_eliminacion", "mixing"].includes(tournamentType)) {
    return { ok: false, message: "Tipo de torneo inválido." };
  }
  if (!startDate || !endDate || !startTime || !registrationDeadline) {
    return { ok: false, message: "Completá fechas y hora." };
  }
  if (!Number.isFinite(maxPairs) || maxPairs < 2) return { ok: false, message: "Máximo de parejas inválido." };
  if (!Number.isFinite(pricePerPair) || pricePerPair < 0) return { ok: false, message: "Precio inválido." };

  const category_min = categoryMinRaw === "" ? null : Number(categoryMinRaw);
  const category_max = categoryMaxRaw === "" ? null : Number(categoryMaxRaw);
  if (category_min != null && !Number.isFinite(category_min)) return { ok: false, message: "Categoría mínima inválida." };
  if (category_max != null && !Number.isFinite(category_max)) return { ok: false, message: "Categoría máxima inválida." };

  const { data: inserted, error } = await supabase
    .from(DB_TABLES.tournaments)
    .insert({
      club_id: clubId,
      name,
      description,
      tournament_type: tournamentType,
      category_min,
      category_max,
      max_pairs: Math.floor(maxPairs),
      price_per_pair: pricePerPair,
      prize,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      registration_deadline: registrationDeadline,
      cancellation_hours: Number.isFinite(cancellationHours) ? Math.floor(cancellationHours) : 24,
      created_by: ctx.userId,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false, message: error?.message ?? "No se pudo crear el torneo." };

  revalidatePath("/admin/torneos");
  redirect(`/admin/torneos/${(inserted as { id: string }).id}`);
}
