-- ============================================================================
-- Kunden-Einstellungen (09.10.2026): Mail-Einstellungen je Person, Firmenlogo,
-- Vertrags-PDF für den Kunden.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Welche Mitteilungen eine Person per E-Mail bekommt
--    Heute wirkt nur interview_updates (Absage, „bleibt beim alten Termin“,
--    Bestätigung ohne Kalenderdatei; _shared/client-mail-prefs.ts). Die übrigen
--    Spalten sind für Mails vorbereitet, die es noch nicht gibt.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  interview_updates boolean NOT NULL DEFAULT true,
  new_candidate text NOT NULL DEFAULT 'instant' CHECK (new_candidate IN ('instant', 'daily', 'off')),
  decision_reminder boolean NOT NULL DEFAULT true,
  searcher_started boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Eigene Mail-Einstellungen lesen" ON public.client_notification_preferences;
CREATE POLICY "Eigene Mail-Einstellungen lesen" ON public.client_notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Eigene Mail-Einstellungen anlegen" ON public.client_notification_preferences;
CREATE POLICY "Eigene Mail-Einstellungen anlegen" ON public.client_notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Eigene Mail-Einstellungen ändern" ON public.client_notification_preferences;
CREATE POLICY "Eigene Mail-Einstellungen ändern" ON public.client_notification_preferences
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.client_notification_preferences TO authenticated;
GRANT ALL ON public.client_notification_preferences TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Firmenlogo: öffentlicher Bucket, jeder schreibt nur in seinen Ordner.
--    Lovable: INSERT INTO storage.buckets ist im Migrationsweg ggf. gesperrt --
--    dann den Bucket „company-logos“ (öffentlich) vorab über die Storage-API anlegen.
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Firmenlogo lesen (eigener Ordner)" ON storage.objects;
CREATE POLICY "Firmenlogo lesen (eigener Ordner)" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Firmenlogo hochladen" ON storage.objects;
CREATE POLICY "Firmenlogo hochladen" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Firmenlogo ersetzen" ON storage.objects;
CREATE POLICY "Firmenlogo ersetzen" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Firmenlogo löschen" ON storage.objects;
CREATE POLICY "Firmenlogo löschen" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- 3. Der Kunde liest das PDF seines eigenen Rahmenvertrags.
--    Prüfung als SECURITY DEFINER: eine Unterabfrage auf die Vertragstabelle in
--    der Storage-Policy scheitert sonst an deren RLS.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_can_read_agreement_document(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM client_framework_agreements a
     WHERE (a.signed_document_path = p_name OR a.document_path = p_name)
       AND (a.client_user_id = auth.uid()
            OR a.organization_id IN (SELECT o.id FROM organizations o WHERE o.owner_id = auth.uid()))
  );
$$;

REVOKE ALL ON FUNCTION public.client_can_read_agreement_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_can_read_agreement_document(text) TO authenticated;

DROP POLICY IF EXISTS "Kunden lesen eigenen Rahmenvertrag" ON storage.objects;
CREATE POLICY "Kunden lesen eigenen Rahmenvertrag" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'mandate-documents' AND public.client_can_read_agreement_document(name));

COMMIT;
