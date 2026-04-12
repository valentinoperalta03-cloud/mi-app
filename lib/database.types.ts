/** IDs en Supabase (uuid). */
export type Uuid = string;

/** `matches.date` y timestamps ISO 8601. */
export type TimestampIso = string;

export type ProfileRow = {
  user_id: Uuid;
  name: string | null;
  /** Nivel numérico (1–7 u otra escala) o legado texto. */
  level: string | number | null;
  /** Categoría de torneo (ej. 6ta). */
  category: string | null;
  matches_played: number | null;
  wins: number | null;
  avatar_url: string | null;
  is_leveled?: boolean | null;
  base_level?: string | null;
  dominant_hand?: string | null;
  play_position?: string | null;
  play_schedule?: string | null;
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
  owner_id: Uuid | null;
};

export type CourtRow = {
  id: Uuid;
  club_id: Uuid;
  name: string | null;
  price?: number | null;
};

export type CourtScheduleRow = {
  court_id: Uuid;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
};

export type MatchRow = {
  id: Uuid;
  date: TimestampIso;
  court_id: Uuid;
  created_by?: Uuid | null;
  is_competitive?: boolean | null;
};

export type MatchPlayerRow = {
  match_id: Uuid;
  player_id: Uuid;
};

export type MatchPlayerWithProfile = Pick<MatchPlayerRow, "player_id"> & {
  profiles:
    | Pick<ProfileRow, "user_id" | "name" | "avatar_url" | "category" | "level">
    | Pick<ProfileRow, "user_id" | "name" | "avatar_url" | "category" | "level">[]
    | null;
};

/** Fila de `matches` con relaciones tipicas de PostgREST. */
export type MatchWithRelations = MatchRow & {
  courts:
    | (CourtRow & {
        clubs: Pick<ClubRow, "id" | "name" | "location"> | null;
      })
    | null;
  match_players: MatchPlayerWithProfile[] | null;
};
