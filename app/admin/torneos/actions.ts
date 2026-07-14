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
  const requiresDeposit = formData.get("requires_deposit") === "true";
  const depositTypeRaw = String(formData.get("deposit_type") ?? "").trim();
  const depositType = depositTypeRaw === "percentage" || depositTypeRaw === "fixed" ? depositTypeRaw : null;
  const depositValueRaw = String(formData.get("deposit_value") ?? "").trim();
  const depositValue = depositValueRaw ? Number(depositValueRaw) : 0;

  if (!name) return { ok: false, message: "Nombre obligatorio." };
  if (!["americano", "eliminacion", "grupos_eliminacion", "mixing"].includes(tournamentType)) {
    return { ok: false, message: "Tipo de torneo inválido." };
  }
  if (!startDate || !endDate || !startTime || !registrationDeadline) {
    return { ok: false, message: "Completá fechas y hora." };
  }
  if (!Number.isFinite(maxPairs) || maxPairs < 2) return { ok: false, message: "Máximo de parejas inválido." };
  if (!Number.isFinite(pricePerPair) || pricePerPair < 0) return { ok: false, message: "Precio inválido." };
  if (startDate > endDate) return { ok: false, message: "La fecha de inicio debe ser anterior o igual a la fecha de fin." };
  if (registrationDeadline.slice(0, 10) > startDate) return { ok: false, message: "El cierre de inscripción debe ser anterior o en la misma fecha que el inicio del torneo." };

  const category_min = categoryMinRaw === "" ? null : Number(categoryMinRaw);
  const category_max = categoryMaxRaw === "" ? null : Number(categoryMaxRaw);
  if (category_min != null && !Number.isFinite(category_min)) return { ok: false, message: "Categoría mínima inválida." };
  if (category_max != null && !Number.isFinite(category_max)) return { ok: false, message: "Categoría máxima inválida." };

  if (requiresDeposit) {
    if (depositType !== "percentage" && depositType !== "fixed") {
      return { ok: false, message: "Elegí el tipo de seña." };
    }
    if (!Number.isFinite(depositValue)) return { ok: false, message: "Monto de seña inválido." };
    if (depositType === "percentage" && (depositValue < 1 || depositValue > 100)) {
      return { ok: false, message: "El porcentaje de seña debe estar entre 1 y 100." };
    }
    if (depositType === "fixed" && depositValue <= 0) {
      return { ok: false, message: "El monto fijo de seña debe ser mayor a 0." };
    }
  }

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
      requires_deposit: requiresDeposit,
      deposit_type: requiresDeposit ? depositType : null,
      deposit_value: requiresDeposit ? depositValue : 0,
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
