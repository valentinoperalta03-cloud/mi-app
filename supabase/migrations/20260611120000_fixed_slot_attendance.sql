-- Add global confirmation deadline (hours) to clubs for fixed slots
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS fixed_slot_confirmation_hours integer NOT NULL DEFAULT 24;

-- Add attendance confirmation status per player per match (null = pending, confirmed, declined)
ALTER TABLE match_participants
  ADD COLUMN IF NOT EXISTS attendance_status text;
