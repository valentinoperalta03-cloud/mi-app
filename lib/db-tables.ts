/**
 * Tablas sociales esperadas en Supabase (ajustá nombres de columnas si difieren):
 * - `match_results`: match_id, created_at (o renombrá en la query), team_a_score?, team_b_score?
 * - `player_ratings`: match_id, rater_id, rated_id, rating (1–7), UNIQUE(match_id, rater_id, rated_id)
 * - `user_favorites`: user_id, favorite_user_id, UNIQUE(user_id, favorite_user_id)
 * - `posts`: user_id, content, match_id?, created_at — ver migración SQL
 * - `messages`: sender_id, receiver_id, content, created_at — habilitar Realtime en Dashboard
 */
export const DB_TABLES = {
  profiles: "profiles",
  clubs: "clubs",
  clubClosedDays: "club_closed_days",
  clubScheduleBlocks: "club_schedule_blocks",
  courts: "courts",
  courtSchedules: "court_schedules",
  courtBlocks: "court_blocks",
  matches: "matches",
  matchPlayers: "match_players",
  matchParticipants: "match_participants",
  matchJoinRequests: "match_join_requests",
  matchJoinVotes: "match_join_votes",
  matchResults: "match_results",
  matchResultConfirmations: "match_result_confirmations",
  matchMessages: "match_messages",
  playerRatings: "player_ratings",
  userFavorites: "user_favorites",
  friendRequests: "friend_requests",
  posts: "posts",
  messages: "messages",
  groupChats: "group_chats",
  groupChatMembers: "group_chat_members",
  groupChatMessages: "group_chat_messages",
  levelEvolution: "level_evolution",
  payments: "payments",
  clubDebts: "club_debts",
  superadmins: "superadmins",
  supportTickets: "support_tickets",
  blockedUsers: "blocked_users",
  fixedSlots: "fixed_slots",
  fixedSlotPlayers: "fixed_slot_players",
  fixedSlotExceptions: "fixed_slot_exceptions",
  notifications: "notifications",
  rateLimits: "rate_limits",
  tournaments: "tournaments",
  tournamentRegistrations: "tournament_registrations",
  tournamentMatches: "tournament_matches",
  practiceCoaches: "practice_coaches",
  practices: "practices",
  practiceSessions: "practice_sessions",
  practiceRegistrations: "practice_registrations",
} as const;
