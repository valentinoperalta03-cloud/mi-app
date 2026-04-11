/** IDs en Supabase (uuid). */
export type Uuid = string;

/** `matches.date` y timestamps ISO 8601. */
export type TimestampIso = string;

export type ProfileRow = {
  user_id: Uuid;
  name: string | null;
  level: string | null;
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

/** Fila de `matches` con relaciones tipicas de PostgREST. */
export type MatchWithRelations = MatchRow & {
  courts:
    | (CourtRow & {
        clubs: Pick<ClubRow, "id" | "name" | "location"> | null;
      })
    | null;
  match_players: Pick<MatchPlayerRow, "player_id">[] | null;
};
