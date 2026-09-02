BEGIN;

ALTER TABLE public.commercial_mandates
  DROP CONSTRAINT IF EXISTS commercial_mandates_confirmed_needs_package;
ALTER TABLE public.commercial_mandates
  ADD CONSTRAINT commercial_mandates_confirmed_needs_package
  CHECK (client_confirmed_at IS NULL
         OR (package_key IS NOT NULL
             AND package_version IS NOT NULL
             AND pricing_snapshot IS NOT NULL
             AND pricing_snapshot_sha256 IS NOT NULL));

COMMENT ON CONSTRAINT commercial_mandates_confirmed_needs_package
  ON public.commercial_mandates IS
  'Ein bestaetigtes Angebot braucht Paket und Preis-Snapshot -- den Prozentsatz. Der Betrag gehoert NICHT dazu: er steht erst mit dem unterzeichneten Arbeitsvertrag fest, die Zahl auf der Paketkarte war eine Schaetzung.';

COMMIT;