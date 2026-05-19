/** IDs en Supabase (uuid). */
export type Uuid = string;

/** `matches.date` y timestamps ISO 8601. */
export type TimestampIso = string;

/** Columnas actuales de `profiles` en Supabase. */
export type ProfileRow = {
  user_id: Uuid;
  name: string | null;
  gender?: "masculino" | "femenino" | null;
  avatar_url: string | null;
  level?: number | null;
  level_of_play: string | null;
  /** Escala competitiva 0.0–7.0 (fuente de verdad del nivel). */
  technical_score?: number | null;
  age: number | null;
  bio: string | null;
};

export type MatchResultRow = {
  id: Uuid;
  match_id: Uuid;
  created_at?: TimestampIso | null;
  team_a_score?: number | null;
  team_b_score?: number | null;
};

export type PlayerRatingRow = {
  id: Uuid;
  match_id: Uuid;
  rater_id: Uuid;
  rated_id: Uuid;
  rating: number;
};

export type UserFavoriteRow = {
  user_id: Uuid;
  favorite_user_id: Uuid;
};

export type ClubRow = {
  id: Uuid;
  name: string | null;
  location: string | null;
  owner_id?: Uuid | null;
  description?: string | null;
  cover_image_url?: string | null;
  logo_url?: string | null;
  contact_phone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  business_hours?: string | null;
  open_time?: string | null;
  close_time?: string | null;
  cancellation_policy?: string | null;
  gallery_image_1?: string | null;
  gallery_image_2?: string | null;
  gallery_image_3?: string | null;
  gallery_image_4?: string | null;
};

export type CourtRow = {
  id: Uuid;
  club_id: Uuid;
  name: string | null;
  price?: number | null;
  surface?: string | null;
  indoor?: boolean | null;
};

export type CourtScheduleRow = {
  court_id: Uuid;
  /** Horario semanal por día; null en filas de precio por franja (mañana/tarde/noche). */
  day_of_week: number | null;
  open_time: string | null;
  close_time: string | null;
  start_time?: string | null;
  end_time?: string | null;
  range_name?: string | null;
  /** Precio por turno para ese día; opcional en UI admin. */
  price_override?: number | string | null;
};

export type MatchRow = {
  id: Uuid;
  date: TimestampIso;
  court_id: Uuid;
  gender_category?: "masculino" | "femenino" | "mixto" | null;
  owner_id?: Uuid | null;
  is_competitive?: boolean | null;
  /** `amistoso` | `competitivo` (minúsculas). Solo competitivo afecta `technical_score`. */
  match_type?: string | null;
  /** `publico` | `privado` */
  visibility?: "publico" | "privado" | null;
};

export type MatchPlayerRow = {
  match_id: Uuid;
  player_id: Uuid;
};

export type MatchPlayerWithProfile = Pick<MatchPlayerRow, "player_id"> & {
  profiles:
    | Pick<ProfileRow, "user_id" | "name" | "avatar_url" | "level_of_play" | "technical_score">
    | Pick<ProfileRow, "user_id" | "name" | "avatar_url" | "level_of_play" | "technical_score">[]
    | null;
};

export type MatchParticipantRow = {
  match_id: Uuid;
  player_id: Uuid;
};

export type MatchParticipantWithProfile = Pick<MatchParticipantRow, "player_id"> & {
  profiles:
    | Pick<ProfileRow, "user_id" | "name" | "avatar_url" | "level_of_play" | "technical_score">
    | Pick<ProfileRow, "user_id" | "name" | "avatar_url" | "level_of_play" | "technical_score">[]
    | null;
};

/** Fila de `matches` con relaciones tipicas de PostgREST. */
export type MatchWithRelations = MatchRow & {
  courts:
    | (CourtRow & {
        clubs: Pick<ClubRow, "id" | "name" | "location"> | null;
      })
    | null;
  match_players?: MatchPlayerWithProfile[] | null;
  match_participants?: MatchParticipantWithProfile[] | null;
};
