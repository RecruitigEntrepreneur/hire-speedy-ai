-- ============================================================================
-- Angebot über den Headhunter und Empfehlung vor dem Angebot (22.10.2026)
-- ============================================================================
-- Der Kunde macht das Angebot im Bewerberprofil, der Headhunter überbringt es
-- und trägt die Antwort des Kandidaten ein (Zusage, überlegt noch, Gegenwunsch,
-- Absage). Vorher kann der Headhunter eine Empfehlung schicken: was der Kandidat
-- für eine Zusage braucht; er hakt an, was der Kunde sieht.
--
-- offers (vorhanden) bekommt die Felder dieses Ablaufs. Stände in offers.status:
--   with_recruiter  beim Headhunter, der es überbringt
--   considering     Kandidat überlegt noch (bis candidate_response.until)
--   countered       Gegenwunsch des Kandidaten, Kunde entscheidet
--   accepted        Zusage
--   declined        Absage des Kandidaten
--   withdrawn       vom Kunden zurückgezogen
--   superseded      durch ein angepasstes Angebot ersetzt
-- Ältere Stände (draft, sent, viewed, negotiating, rejected, expired) bleiben gültig.
-- Geschrieben wird nur über die Function offer (Service-Role); gelesen über die
-- bestehenden Regeln für Kundenteam, Headhunter und Admin.
-- ============================================================================

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS variable_salary integer;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS response_due date;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS extras text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS work_model text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS message_to_recruiter text;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS candidate_response jsonb;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS responded_at timestamptz;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS responded_by uuid;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS previous_offer_id uuid REFERENCES public.offers(id) ON DELETE SET NULL;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.offers.variable_salary IS 'Variabel bei 100 % Zielerreichung (EUR/Jahr)';
COMMENT ON COLUMN public.offers.response_due IS 'Antwort des Kandidaten bis (Datum)';
COMMENT ON COLUMN public.offers.candidate_response IS 'Antwort, vom Headhunter eingetragen: way, until, wish_*, reason';

-- Empfehlung des Headhunters vor dem Angebot
CREATE TABLE IF NOT EXISTS public.offer_recommendations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  recruiter_id  uuid NOT NULL,
  intro         text,
  items         jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offer_recommendations_submission_idx ON public.offer_recommendations (submission_id, created_at DESC);

ALTER TABLE public.offer_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Headhunter liest eigene Empfehlungen" ON public.offer_recommendations;
CREATE POLICY "Headhunter liest eigene Empfehlungen" ON public.offer_recommendations
  FOR SELECT USING (recruiter_id = auth.uid());

DROP POLICY IF EXISTS "Kundenteam liest Empfehlungen" ON public.offer_recommendations;
CREATE POLICY "Kundenteam liest Empfehlungen" ON public.offer_recommendations
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.submissions s WHERE s.id = offer_recommendations.submission_id AND public.can_access_job(s.job_id)
  ));

DROP POLICY IF EXISTS "Admins lesen Empfehlungen" ON public.offer_recommendations;
CREATE POLICY "Admins lesen Empfehlungen" ON public.offer_recommendations
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.offer_recommendations TO authenticated;
GRANT ALL ON public.offer_recommendations TO service_role;
