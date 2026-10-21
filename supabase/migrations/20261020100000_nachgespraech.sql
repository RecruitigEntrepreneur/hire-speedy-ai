-- Nachgespräch mit dem Kandidaten nach dem Interview (20.10.2026).
--
-- Ersetzt das „Debrief“ in interview_feedback. Das war ein Bewertungsbogen für die
-- Interviewer beim Kunden (Kommunikation, Kultur, Technik …), und das Kundenteam
-- durfte ihn lesen (can_access_job). Hier hält der Headhunter fest, was der
-- Kandidat ihm sagt: Bauchgefühl, Ansprechpartner, Gehalt, wie ein
-- Angebot aussehen müsste, Starttermin, ob er weiter will. Lesen dürfen nur der
-- Headhunter selbst und Matchunt, nie der Kunde.

CREATE TABLE IF NOT EXISTS public.interview_nachgespraeche (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id uuid NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  recruiter_id uuid NOT NULL DEFAULT auth.uid(),
  verlauf text CHECK (verlauf IS NULL OR length(verlauf) <= 8000),
  bauchgefuehl text CHECK (bauchgefuehl IN ('gut', 'gemischt', 'schlecht')),
  zusammenarbeit text CHECK (zusammenarbeit IN ('ja', 'unsicher', 'nein')),
  ansprechpartner text CHECK (ansprechpartner IS NULL OR length(ansprechpartner) <= 1000),
  gehalt_besprochen boolean,
  gehalt_kandidat integer CHECK (gehalt_kandidat IS NULL OR gehalt_kandidat BETWEEN 0 AND 10000000),
  gehalt_firma integer CHECK (gehalt_firma IS NULL OR gehalt_firma BETWEEN 0 AND 10000000),
  angebot_fix_min integer CHECK (angebot_fix_min IS NULL OR angebot_fix_min BETWEEN 0 AND 10000000),
  angebot_punkte text[] NOT NULL DEFAULT '{}',
  angebot_text text CHECK (angebot_text IS NULL OR length(angebot_text) <= 4000),
  start_art text CHECK (start_art IN ('sofort', 'nach_frist', 'fester_tag')),
  start_datum date,
  will_weiter text CHECK (will_weiter IN ('ja', 'unsicher', 'nein')),
  bedenken text CHECK (bedenken IS NULL OR length(bedenken) <= 4000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (interview_id, recruiter_id)
);

CREATE INDEX IF NOT EXISTS interview_nachgespraeche_recruiter_idx
  ON public.interview_nachgespraeche (recruiter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS interview_nachgespraeche_submission_idx
  ON public.interview_nachgespraeche (submission_id);

-- Einreichung und Kandidat kommen immer aus dem Interview, nie aus dem Browser.
CREATE OR REPLACE FUNCTION public.nachgespraech_zuordnen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub uuid;
  v_cand uuid;
  v_rec uuid;
BEGIN
  SELECT s.id, s.candidate_id, s.recruiter_id
    INTO v_sub, v_cand, v_rec
    FROM public.interviews i
    JOIN public.submissions s ON s.id = i.submission_id
   WHERE i.id = NEW.interview_id;
  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Interview nicht gefunden.';
  END IF;
  IF v_rec IS DISTINCT FROM NEW.recruiter_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Nur der Headhunter dieser Einreichung kann das Nachgespräch festhalten.';
  END IF;
  NEW.submission_id := v_sub;
  NEW.candidate_id := v_cand;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS nachgespraech_zuordnen ON public.interview_nachgespraeche;
CREATE TRIGGER nachgespraech_zuordnen
  BEFORE INSERT OR UPDATE ON public.interview_nachgespraeche
  FOR EACH ROW EXECUTE FUNCTION public.nachgespraech_zuordnen();

ALTER TABLE public.interview_nachgespraeche ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Headhunter liest eigene Nachgespraeche" ON public.interview_nachgespraeche;
CREATE POLICY "Headhunter liest eigene Nachgespraeche"
  ON public.interview_nachgespraeche FOR SELECT
  USING (recruiter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Headhunter legt eigene Nachgespraeche an" ON public.interview_nachgespraeche;
CREATE POLICY "Headhunter legt eigene Nachgespraeche an"
  ON public.interview_nachgespraeche FOR INSERT
  WITH CHECK (recruiter_id = auth.uid());

DROP POLICY IF EXISTS "Headhunter aendert eigene Nachgespraeche" ON public.interview_nachgespraeche;
CREATE POLICY "Headhunter aendert eigene Nachgespraeche"
  ON public.interview_nachgespraeche FOR UPDATE
  USING (recruiter_id = auth.uid())
  WITH CHECK (recruiter_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.interview_nachgespraeche TO authenticated;
