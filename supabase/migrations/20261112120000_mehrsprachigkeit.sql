-- Mehrsprachigkeit (12.11.2026): de, de-AT, de-CH, en, sv, nb.
--
-- Die Sprache hängt an der Person (profiles.language) und, solange es noch
-- kein Konto gibt, am Vorgang: Headhunter-Einstieg (recruiter_onboarding_cases)
-- und Kunden-Aufnahme (intake_links, intake_drafts). In dieser Sprache gehen
-- die Mails raus. NULL heißt überall: keine Angabe, also Deutsch wie bisher.
--
-- Dazu der öffentliche Headhunter-Link mit Kennung (recruiter_public_links):
-- ein Link je Kanal, mit eigener Sprache und Zähler. Die Kennung steht am
-- Vorgang (source_key), der über diesen Link entstanden ist.
--
-- Nur Ergänzungen, alles wiederholbar. Keine Daten, keine Transaktion.

-- 1. Sprache der Person. Die Person setzt sie selbst: Die bestehende Policy
--    "Users can update their own profile" erlaubt das für die eigene Zeile,
--    es gibt keine Spalten-Rechte und keine Spalten-Whitelist auf profiles.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text
  CHECK (language IS NULL OR language IN ('de','de-AT','de-CH','en','sv','nb'));
COMMENT ON COLUMN public.profiles.language IS
  'Sprache der Person für Oberfläche und Mails (de, de-AT, de-CH, en, sv, nb). NULL = keine Angabe, Deutsch.';

-- 2. Headhunter-Einstieg: Sprache des Vorgangs und Kennung des öffentlichen Links.
--    Die Wächter auf dieser Tabelle (recruiter_onboarding_guard,
--    recruiter_entry_source_guard) prüfen nur ihre eigenen Spalten; beide neuen
--    Spalten bleiben änderbar, solange die Revision mitzählt.
ALTER TABLE public.recruiter_onboarding_cases
  ADD COLUMN IF NOT EXISTS language text
  CHECK (language IS NULL OR language IN ('de','de-AT','de-CH','en','sv','nb'));
ALTER TABLE public.recruiter_onboarding_cases
  ADD COLUMN IF NOT EXISTS source_key text;
COMMENT ON COLUMN public.recruiter_onboarding_cases.language IS
  'Sprache des Vorgangs: in ihr gehen Code-Mail, Einladung und Willkommensmail raus. NULL = Deutsch.';
COMMENT ON COLUMN public.recruiter_onboarding_cases.source_key IS
  'Kennung des öffentlichen Links (recruiter_public_links.key), über den der Vorgang entstand. Wird nie überschrieben.';
CREATE INDEX IF NOT EXISTS recruiter_onboarding_cases_source_key
  ON public.recruiter_onboarding_cases (source_key) WHERE source_key IS NOT NULL;

-- 3. Kunden-Aufnahme: Sprache des Links und des Entwurfs (nutzt die Kundenseite).
ALTER TABLE public.intake_links
  ADD COLUMN IF NOT EXISTS language text
  CHECK (language IS NULL OR language IN ('de','de-AT','de-CH','en','sv','nb'));
ALTER TABLE public.intake_drafts
  ADD COLUMN IF NOT EXISTS language text
  CHECK (language IS NULL OR language IN ('de','de-AT','de-CH','en','sv','nb'));
COMMENT ON COLUMN public.intake_links.language IS
  'Sprache, in der der Aufnahme-Link begrüßt. NULL = automatisch (Browser entscheidet).';
COMMENT ON COLUMN public.intake_drafts.language IS
  'Sprache, die der Kunde in der Aufnahme gewählt hat. NULL = keine Angabe, Deutsch.';

-- 4. Öffentliche Headhunter-Links mit Kennung. Zugriff nur über die Edge
--    Functions (service_role), wie bei recruiter_onboarding_cases: RLS an,
--    keine Policy, keine Rechte für anon und authenticated.
CREATE TABLE IF NOT EXISTS public.recruiter_public_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9-]{3,40}$'),
  label text NOT NULL,
  language text CHECK (language IS NULL OR language IN ('de','de-AT','de-CH','en','sv','nb')),
  expires_at timestamptz,
  revoked_at timestamptz,
  opened_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.recruiter_public_links IS
  'Öffentliche Einstiegslinks für Headhunter mit Kennung (?via=…). language NULL = automatisch. created_by ist die Nutzer-ID des Admins, bewusst ohne Fremdschlüssel.';

GRANT ALL ON public.recruiter_public_links TO service_role;
REVOKE ALL ON public.recruiter_public_links FROM anon, authenticated;
ALTER TABLE public.recruiter_public_links ENABLE ROW LEVEL SECURITY;

-- 5. Link öffnen: prüfen und zählen in einer Anweisung, damit gleichzeitige
--    Aufrufe keinen Zähler verlieren. Liefert eine Zeile, wenn der Link gilt,
--    sonst keine. Aufruf nur durch die Function recruiter-onboarding.
CREATE OR REPLACE FUNCTION public.recruiter_public_link_open(_key text)
RETURNS TABLE (link_key text, link_language text)
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.recruiter_public_links l
     SET opened_count = l.opened_count + 1
   WHERE l.key = _key
     AND l.revoked_at IS NULL
     AND (l.expires_at IS NULL OR l.expires_at > now())
  RETURNING l.key, l.language;
$$;
REVOKE ALL ON FUNCTION public.recruiter_public_link_open(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recruiter_public_link_open(text) TO service_role;
