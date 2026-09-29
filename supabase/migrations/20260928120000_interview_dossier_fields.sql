-- Kandidateninterview (allgemein, 8 Phasen): neue Angaben im einen
-- Interview-Datensatz je Kandidat. Nur neue, optionale Spalten; bestehende
-- Daten und Policies bleiben unverändert. Das Frontend speichert ohne diese
-- Spalten weiter (alles andere), bis die Migration angewandt ist.

ALTER TABLE public.candidate_interview_notes
  ADD COLUMN IF NOT EXISTS interview_type text,
  ADD COLUMN IF NOT EXISTS leadership_scope text,
  ADD COLUMN IF NOT EXISTS leadership_team_size integer,
  ADD COLUMN IF NOT EXISTS other_applications text,
  ADD COLUMN IF NOT EXISTS other_applications_notes text,
  ADD COLUMN IF NOT EXISTS blocked_companies text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS presentation_consent boolean,
  ADD COLUMN IF NOT EXISTS presentation_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recommendation_level text,
  ADD COLUMN IF NOT EXISTS would_stay_answer text,
  ADD COLUMN IF NOT EXISTS change_readiness text;

ALTER TABLE public.candidate_interview_notes
  DROP CONSTRAINT IF EXISTS candidate_interview_notes_interview_type_check,
  ADD CONSTRAINT candidate_interview_notes_interview_type_check
    CHECK (interview_type IS NULL OR interview_type IN ('phone', 'video', 'onsite')),
  DROP CONSTRAINT IF EXISTS candidate_interview_notes_leadership_scope_check,
  ADD CONSTRAINT candidate_interview_notes_leadership_scope_check
    CHECK (leadership_scope IS NULL OR leadership_scope IN ('none', 'functional', 'disciplinary')),
  DROP CONSTRAINT IF EXISTS candidate_interview_notes_other_applications_check,
  ADD CONSTRAINT candidate_interview_notes_other_applications_check
    CHECK (other_applications IS NULL OR other_applications IN ('none', 'early', 'advanced', 'offer')),
  DROP CONSTRAINT IF EXISTS candidate_interview_notes_recommendation_level_check,
  ADD CONSTRAINT candidate_interview_notes_recommendation_level_check
    CHECK (recommendation_level IS NULL OR recommendation_level IN ('yes', 'rather_yes', 'rather_no', 'no')),
  DROP CONSTRAINT IF EXISTS candidate_interview_notes_would_stay_answer_check,
  ADD CONSTRAINT candidate_interview_notes_would_stay_answer_check
    CHECK (would_stay_answer IS NULL OR would_stay_answer IN ('yes', 'maybe', 'no')),
  DROP CONSTRAINT IF EXISTS candidate_interview_notes_change_readiness_check,
  ADD CONSTRAINT candidate_interview_notes_change_readiness_check
    CHECK (change_readiness IS NULL OR change_readiness IN ('active', 'open', 'passive'));

COMMENT ON COLUMN public.candidate_interview_notes.blocked_companies IS 'Firmen, bei denen der Kandidat nicht vorgestellt werden will (Sperrliste).';
COMMENT ON COLUMN public.candidate_interview_notes.presentation_consent IS 'Mündliches Einverständnis, anonym für passende Positionen vorgestellt zu werden; je Vorstellung wird erneut abgestimmt.';
COMMENT ON COLUMN public.candidate_interview_notes.recommendation_level IS 'Vierstufige Empfehlung; would_recommend bleibt als Ja/Nein-Spiegel erhalten.';
COMMENT ON COLUMN public.candidate_interview_notes.change_readiness IS 'Wechselbereitschaft aktiv/offen/passiv, vom Headhunter gesetzt (bewusst kein berechneter Wert: Profiling-Risiko).';
