-- ============================================================================
-- @-Mentions in Kandidaten-Kommentaren (Client-Team Phase 4)
-- Speichert, welche Team-Mitglieder in einem Kommentar erwähnt wurden —
-- Benachrichtigung erfolgt appseitig (notifications-Insert beim Kommentieren).
-- ============================================================================

ALTER TABLE public.candidate_comments
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] NOT NULL DEFAULT '{}';
