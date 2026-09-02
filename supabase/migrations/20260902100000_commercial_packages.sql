-- ============================================================================
-- Nachlauf der Aufnahme · Die drei Pakete (1/3)
-- ----------------------------------------------------------------------------
-- BEFUND: Die Kondition lebt an vier Orten mit vier Wahrheiten.
--   jobs.fee_percentage / recruiter_fee_percentage tragen die Spalten-Defaults
--   20.00 / 15.00 aus der Urmigration. JobApprovalDialog.tsx setzt sie ueber
--   einen freien Slider von 15 bis 30 Prozent. process-offer-response rechnet
--   den Recruiter-Anteil als Quote des Honorars, AdminPlacements zieht statt-
--   dessen pauschal 20 Prozent Plattformanteil ab. commercial_terms_templates
--   (20260901100200) fuehrte dazu ein Bandmodell ein: eine Vorlage mit
--   Mindest- und Hoechstsatz, Abweichung je Link innerhalb des Bandes.
--
-- ENTSCHEIDUNG (2026-09-02) -- loest das Bandmodell ab:
--   Es gibt genau drei Pakete. Keine Verhandlung, kein Slider, keine
--   individuellen Konditionen, kein viertes Paket. Der Admin kann fuer eine
--   einzelne Anfrage keinen abweichenden Prozentsatz eintragen. Damit ist die
--   Bandbreite gegenstandslos: min/max bleiben als Spalten bestehen, werden
--   aber nicht mehr gelesen, und der Trigger auf intake_links faellt weg
--   (Migration 2/3).
--
-- Alle Prozentsaetze sind PROZENTPUNKTE DES BRUTTOJAHRESZIELGEHALTS, nicht
-- Anteile am Matchunt-Honorar. Bei 100.000 Euro und Continuity 90 sind die
-- 10 Prozent Initialtranche also 10.000 Euro, nicht 10 Prozent von 23.000.
-- Diese Verwechslung ist der teuerste denkbare Fehler in diesem Modell,
-- deshalb steht sie als Kommentar an jeder betroffenen Spalte.
--
-- Die beiden Invarianten sind CHECK-Constraints, nicht Konvention:
--   (1) ohne Claim:  Honorar = Initial + Retention + Matchunt
--   (2) mit Claim:   Honorar = Initial + Bounty    + Matchunt-bei-Claim
-- Ohne (2) koennte eine spaetere Preisaenderung eine Auslobung erzeugen, die
-- aus dem einen Kundenhonorar gar nicht bezahlbar waere.
--
-- Spiegel von src/lib/pricing/packages.ts. Die Tests in pricing.test.ts pruefen
-- dieselben Invarianten auf der Anwendungsseite; test_commercial_packages.sql
-- prueft sie hier.
-- ============================================================================

BEGIN;

-- Postgres verbietet Subqueries in CHECK-Constraints. Die Pruefung "kein Grund
-- ist gleichzeitig anspruchsbegruendend und ausgeschlossen" betrifft nur die
-- eigene Zeile, also traegt sie eine IMMUTABLE-Funktion.
CREATE OR REPLACE FUNCTION public.jsonb_text_arrays_disjoint(a jsonb, b jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT
SET search_path = public
AS $fn$
  SELECT NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(a) AS x WHERE b ? x
  );
$fn$;

CREATE TABLE IF NOT EXISTS public.commercial_packages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_key   text    NOT NULL CHECK (package_key IN ('core', 'continuity_90', 'continuity_180')),
  version       integer NOT NULL DEFAULT 1,
  is_active     boolean NOT NULL DEFAULT true,

  -- ---- Was der Kunde sieht -------------------------------------------------
  public_name   text NOT NULL,
  summary       text NOT NULL,
  bullets       jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order    integer NOT NULL,

  -- ---- Preis ---------------------------------------------------------------
  client_fee_pct numeric(5,2) NOT NULL CHECK (client_fee_pct > 0 AND client_fee_pct <= 100),
  fee_basis      text NOT NULL DEFAULT 'gross_annual_target_compensation'
                   CHECK (fee_basis = 'gross_annual_target_compensation'),
  payment_terms_days integer NOT NULL DEFAULT 14 CHECK (payment_terms_days > 0),

  -- ---- Continuity ----------------------------------------------------------
  continuity_days        integer CHECK (continuity_days IS NULL OR continuity_days > 0),
  claim_notice_days      integer NOT NULL DEFAULT 14 CHECK (claim_notice_days > 0),
  research_max_active_days integer CHECK (research_max_active_days IS NULL OR research_max_active_days > 0),

  -- ---- Innenaufteilung (nie an den Kunden) ---------------------------------
  recruiter_initial_pct   numeric(5,2) NOT NULL CHECK (recruiter_initial_pct   >= 0),
  recruiter_retention_pct numeric(5,2) NOT NULL CHECK (recruiter_retention_pct >= 0),
  matchunt_pct            numeric(5,2) NOT NULL CHECK (matchunt_pct            >= 0),
  research_bounty_pct     numeric(5,2) NOT NULL CHECK (research_bounty_pct     >= 0),
  matchunt_on_claim_pct   numeric(5,2) NOT NULL CHECK (matchunt_on_claim_pct   >= 0),

  -- ---- Anspruchsgruende ----------------------------------------------------
  eligible_claim_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  excluded_claim_categories jsonb NOT NULL DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT commercial_packages_key_version_key UNIQUE (package_key, version),

  -- (1) Ohne Claim geht die Verteilung exakt auf.
  CONSTRAINT commercial_packages_split_without_claim
    CHECK (recruiter_initial_pct + recruiter_retention_pct + matchunt_pct = client_fee_pct),

  -- (2) Mit Claim ebenso. Die verfallene Tranche wird Teil der Auslobung,
  --     der Kunde zahlt kein zweites Honorar.
  CONSTRAINT commercial_packages_split_with_claim
    CHECK (recruiter_initial_pct + research_bounty_pct + matchunt_on_claim_pct = client_fee_pct),

  -- Ein Paket ohne Continuity hat weder Retention noch Auslobung noch
  -- Anspruchsgruende -- sonst entstuende ein Anspruch ohne Deckung.
  CONSTRAINT commercial_packages_core_has_no_continuity
    CHECK (continuity_days IS NOT NULL
           OR (recruiter_retention_pct = 0
               AND research_bounty_pct = 0
               AND research_max_active_days IS NULL
               AND eligible_claim_categories = '[]'::jsonb)),

  -- Umgekehrt: mit Continuity muss es eine Auslobung und eine Frist geben.
  CONSTRAINT commercial_packages_continuity_is_funded
    CHECK (continuity_days IS NULL
           OR (research_bounty_pct > 0
               AND research_max_active_days IS NOT NULL
               AND jsonb_array_length(eligible_claim_categories) > 0)),

  -- Kein Grund darf gleichzeitig anspruchsbegruendend und ausgeschlossen sein.
  CONSTRAINT commercial_packages_categories_disjoint
    CHECK (public.jsonb_text_arrays_disjoint(
             eligible_claim_categories, excluded_claim_categories))
);

-- Genau eine aktive Fassung je Paket (Muster matching_config).
CREATE UNIQUE INDEX IF NOT EXISTS commercial_packages_active_key_idx
  ON public.commercial_packages (package_key) WHERE is_active;

COMMENT ON TABLE public.commercial_packages IS
  'Die drei buchbaren Pakete. Genau drei, keine Verhandlung, kein individueller '
  'Prozentsatz je Anfrage. Versioniert: eine Preisaenderung erzeugt eine neue '
  'Zeile, die alte geht auf is_active = false. Bestehende Auftraege rechnen '
  'weiter aus ihrem pricing_snapshot, nicht aus dieser Tabelle.';

COMMENT ON COLUMN public.commercial_packages.client_fee_pct IS
  'PROZENTPUNKTE DES BRUTTOJAHRESZIELGEHALTS. Bei 100.000 Euro sind 23,00 hier '
  '23.000 Euro Kundenhonorar.';
COMMENT ON COLUMN public.commercial_packages.recruiter_initial_pct IS
  'PROZENTPUNKTE DES BRUTTOJAHRESZIELGEHALTS, nicht Anteil am Kundenhonorar. '
  'Bei 100.000 Euro und Continuity 90 sind 10,00 hier 10.000 Euro -- nicht '
  '10 Prozent von 23.000 Euro. Faellig nach vollstaendigem Zahlungseingang.';
COMMENT ON COLUMN public.commercial_packages.recruiter_retention_pct IS
  'PROZENTPUNKTE DES BRUTTOJAHRESZIELGEHALTS. Einbehalten bis Continuity- und '
  'Meldefrist abgelaufen sind. Verfaellt bei gueltigem Claim und finanziert '
  'dann einen Teil der Auslobung.';
COMMENT ON COLUMN public.commercial_packages.matchunt_pct IS
  'PROZENTPUNKTE DES BRUTTOJAHRESZIELGEHALTS. Was Matchunt verbleibt, wenn kein '
  'Continuity-Fall eintritt.';
COMMENT ON COLUMN public.commercial_packages.research_bounty_pct IS
  'PROZENTPUNKTE DES BRUTTOJAHRESZIELGEHALTS. Auslobung fuer den erneuten '
  'Suchlauf, faellig nur bei erfolgreicher Ersatzvermittlung. Setzt sich '
  'zusammen aus der verfallenen Retention und dem Continuity-Aufpreis.';
COMMENT ON COLUMN public.commercial_packages.matchunt_on_claim_pct IS
  'PROZENTPUNKTE DES BRUTTOJAHRESZIELGEHALTS. Was Matchunt bei erfolgreicher '
  'Ersatzvermittlung verbleibt -- in jedem Paket 5,00.';
COMMENT ON COLUMN public.commercial_packages.research_max_active_days IS
  'Aktive Suchtage fuer den erneuten Suchlauf. Aktiv heisst: der Kunde wirkt '
  'mit. Tage ohne Rueckmeldung des Kunden zaehlen nicht.';
COMMENT ON COLUMN public.commercial_packages.bullets IS
  'Kundenseitige Formulierungen. Duerfen keine Innenaufteilung nennen -- weder '
  'Recruiter-Anteil noch Marge noch Auslobung.';

-- ----------------------------------------------------------------------------
-- Die drei Pakete
-- ----------------------------------------------------------------------------
INSERT INTO public.commercial_packages (
  package_key, version, is_active, public_name, summary, bullets, sort_order,
  client_fee_pct, continuity_days, claim_notice_days, research_max_active_days,
  recruiter_initial_pct, recruiter_retention_pct, matchunt_pct,
  research_bounty_pct, matchunt_on_claim_pct,
  eligible_claim_categories, excluded_claim_categories
) VALUES
-- Core: 20 = 15 + 0 + 5, und 20 = 15 + 0 + 5.
('core', 1, true,
 'Matchunt Core',
 'Erfolgshonorar ohne Continuity-Leistung.',
 '["20 % des Bruttojahreszielgehalts, fällig erst bei erfolgreicher Vermittlung",
   "Keine Fixkosten, kein Retainer",
   "Kein erneuter Suchlauf bei späterem Ausscheiden"]'::jsonb,
 1,
 20.00, NULL, 14, NULL,
 15.00, 0.00, 5.00,
 0.00, 5.00,
 '[]'::jsonb,
 '["redundancy","restructuring","position_eliminated","economic_dismissal",
   "role_materially_changed","client_breach","payment_default",
   "client_non_cooperation","salary_below_agreement"]'::jsonb),

-- Continuity 90: 23 = 10 + 5 + 8, und 23 = 10 + 8 + 5.
('continuity_90', 1, true,
 'Matchunt Continuity 90',
 'Erfolgshonorar mit einmaligem erneutem Suchlauf in den ersten 90 Tagen.',
 '["23 % des Bruttojahreszielgehalts, fällig erst bei erfolgreicher Vermittlung",
   "Einmaliger erneuter Suchlauf, wenn die Person in den ersten 90 Tagen ausscheidet",
   "Kein zweites Vermittlungshonorar für den erneuten Suchlauf",
   "Keine Garantie, dass eine Ersatzbesetzung zustande kommt"]'::jsonb,
 2,
 23.00, 90, 14, 60,
 10.00, 5.00, 8.00,
 8.00, 5.00,
 '["no_show","candidate_resigned","candidate_terminated_probation",
   "employer_performance","employer_fit","employer_terminated_probation",
   "mutual_separation_probation"]'::jsonb,
 '["redundancy","restructuring","position_eliminated","economic_dismissal",
   "role_materially_changed","client_breach","payment_default",
   "client_non_cooperation","salary_below_agreement"]'::jsonb),

-- Continuity 180: 26 = 10 + 5 + 11, und 26 = 10 + 11 + 5.
('continuity_180', 1, true,
 'Matchunt Continuity 180',
 'Erfolgshonorar mit einmaligem erneutem Suchlauf in den ersten 180 Tagen.',
 '["26 % des Bruttojahreszielgehalts, fällig erst bei erfolgreicher Vermittlung",
   "Einmaliger erneuter Suchlauf, wenn die Person in den ersten 180 Tagen ausscheidet",
   "Kein zweites Vermittlungshonorar für den erneuten Suchlauf",
   "Keine Garantie, dass eine Ersatzbesetzung zustande kommt"]'::jsonb,
 3,
 26.00, 180, 14, 90,
 10.00, 5.00, 11.00,
 11.00, 5.00,
 '["no_show","candidate_resigned","candidate_terminated_probation",
   "employer_performance","employer_fit","employer_terminated_probation",
   "mutual_separation_probation"]'::jsonb,
 '["redundancy","restructuring","position_eliminated","economic_dismissal",
   "role_materially_changed","client_breach","payment_default",
   "client_non_cooperation","salary_below_agreement"]'::jsonb)
ON CONFLICT (package_key, version) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Kein viertes Paket
-- ----------------------------------------------------------------------------
-- Der CHECK auf package_key laesst nur die drei Schluessel zu. Diese Funktion
-- schuetzt zusaetzlich davor, dass jemand einen vierten Schluessel per
-- Migration nachtraegt und die Auswahl damit still erweitert.
CREATE OR REPLACE FUNCTION public.commercial_packages_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE aktive integer;
BEGIN
  SELECT count(*) INTO aktive FROM public.commercial_packages WHERE is_active;
  IF aktive > 3 THEN
    RAISE EXCEPTION 'Es darf nur drei aktive Pakete geben, gefunden: %. Eine Preisaenderung setzt die alte Fassung auf is_active = false.', aktive
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_packages_max_three ON public.commercial_packages;
CREATE CONSTRAINT TRIGGER trg_packages_max_three
  AFTER INSERT OR UPDATE ON public.commercial_packages
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.commercial_packages_guard();

DROP TRIGGER IF EXISTS trg_packages_touch ON public.commercial_packages;
CREATE TRIGGER trg_packages_touch
  BEFORE UPDATE ON public.commercial_packages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
-- Die Preise sind veroeffentlichte Regel, kein Geheimnis -- die Innenaufteilung
-- schon. Postgres-RLS kennt keine Spaltenrechte, deshalb liest der Kunde nicht
-- die Tabelle, sondern die View darunter.
ALTER TABLE public.commercial_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage packages" ON public.commercial_packages;
CREATE POLICY "Admins manage packages"
  ON public.commercial_packages FOR ALL TO authenticated
  USING      (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Die kundenseitige Sicht. Enthaelt bewusst weder recruiter_*, matchunt_*
-- noch research_bounty_pct. security_invoker bleibt AUS: die View ist die
-- Spaltenrechte-Ersatzkonstruktion, sie muss ueber die RLS der Basistabelle
-- hinweg lesen duerfen.
CREATE OR REPLACE VIEW public.commercial_packages_public AS
  SELECT package_key, version, public_name, summary, bullets, sort_order,
         client_fee_pct, fee_basis, payment_terms_days,
         continuity_days, claim_notice_days,
         eligible_claim_categories, excluded_claim_categories
    FROM public.commercial_packages
   WHERE is_active;

COMMENT ON VIEW public.commercial_packages_public IS
  'Kundenseitige Paketansicht. Zeigt Honorarsatz, Dauer und Fristen -- niemals '
  'Recruiter-Anteil, Marge, Retention oder Auslobung. Kein security_invoker: '
  'die View ersetzt die in Postgres fehlenden Spaltenrechte.';

GRANT SELECT ON public.commercial_packages_public TO anon, authenticated;

COMMIT;
