-- ============================================================================
-- Auth-Härtung: Privilege-Escalation schließen
-- Kontext: Godmode-Analyse 2026-06-08 (siehe MATCHUNT_GODMODE_ANALYSIS.md, Kap. 04)
--
-- Zwei zusammenwirkende Lücken erlaubten jedem Nutzer, sich selbst 'admin' zu geben:
--   (1) handle_new_user() übernahm `role` ungeprüft aus den client-kontrollierten
--       Signup-Metadaten (raw_user_meta_data ->> 'role').
--   (2) Policy "Users can insert their own role" prüfte nur user_id = auth.uid(),
--       NICHT den Rollenwert -> beliebige Rolle per einzelnem INSERT setzbar.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Fix 1: Rolle bei Signup auf selbst-wählbare Werte whitelisten.
--        'admin' kann NIE über die Registrierung vergeben werden.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role text := NEW.raw_user_meta_data ->> 'role';
  safe_role app_role;
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')
  );

  -- Nur 'client'/'recruiter' dürfen selbst gewählt werden; alles andere
  -- (inkl. 'admin' oder ungültige Werte) fällt sicher auf 'client' zurück.
  safe_role := CASE
    WHEN requested_role IN ('client', 'recruiter') THEN requested_role::app_role
    ELSE 'client'::app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, safe_role);

  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- Fix 2: Self-Insert-Policy entfernen.
--        Rollen werden ab jetzt ausschließlich gesetzt durch
--          (a) den SECURITY DEFINER Trigger handle_new_user (umgeht RLS), und
--          (b) Admins via bestehende Policy "Admins can manage all roles".
--        Es gibt keinen legitimen user-facing INSERT-Pfad in user_roles.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;

-- ----------------------------------------------------------------------------
-- HINWEIS (manuell, nicht Teil dieser Migration):
-- Bereits bestehende, evtl. unrechtmäßig vergebene 'admin'-Rollen werden hier
-- NICHT angefasst (Löschen von Admins ist zu riskant für eine Auto-Migration).
-- Bitte im Supabase SQL-Editor prüfen:
--   SELECT ur.user_id, ur.role, p.email, ur.created_at
--   FROM public.user_roles ur LEFT JOIN public.profiles p USING (user_id)
--   WHERE ur.role = 'admin' ORDER BY ur.created_at;
-- und unerwartete Einträge gezielt entfernen.
-- ----------------------------------------------------------------------------
