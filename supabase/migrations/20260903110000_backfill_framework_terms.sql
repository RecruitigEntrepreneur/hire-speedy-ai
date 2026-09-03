-- ============================================================================
-- Konditionen an bestehende Rahmenvertraege nachziehen
-- ============================================================================
-- Vertraege, die vor dem 03.09.2026 zustande kamen, entstanden im Modell "ein
-- Vertrag je Position": Rahmenvertrag und Einzelauftrag wurden in einem
-- Durchgang unterschrieben, und die vereinbarte Kondition landete am
-- EINZELAUFTRAG. Die Spalten am Rahmenvertrag gab es damals noch nicht.
--
-- Fuer den neuen Ablauf ist das ein Problem: active_framework_for_draft findet
-- den Vertrag zwar, aber intake-submit verwirft ihn als Grundlage, weil ohne
-- package_key niemand sagen kann, zu welchem Satz die naechste Position laeuft.
-- Der Kunde wuerde ein zweites Mal unterschreiben -- genau das, was abgestellt
-- werden sollte.
--
-- Diese Migration holt die Kondition von dort, wo sie steht: aus dem
-- unterschriebenen Einzelauftrag, der an genau diesem Rahmenvertrag haengt.
-- Sie fuellt ausschliesslich NULL-Spalten. Ein Rahmenvertrag, der bereits
-- Konditionen traegt, wird nicht angefasst.
-- ============================================================================

BEGIN;

WITH quelle AS (
  SELECT DISTINCT ON (m.framework_agreement_id)
         m.framework_agreement_id AS rv_id,
         m.package_key,
         m.package_version,
         m.pricing_snapshot,
         m.pricing_snapshot_sha256,
         m.package_selected_at,
         m.mandate_number
    FROM public.commercial_mandates m
    JOIN public.client_framework_agreements rv
      ON rv.id = m.framework_agreement_id
   WHERE m.framework_agreement_id IS NOT NULL
     AND m.package_key      IS NOT NULL
     AND m.pricing_snapshot IS NOT NULL
     -- Nur aus einem Auftrag, den der Kunde tatsaechlich unterschrieben hat.
     -- Ein verworfenes Angebot ist keine Vereinbarung.
     AND m.customer_signed_at IS NOT NULL
     AND m.status IN ('accepted', 'client_confirmed')
     AND rv.status = 'active'
     AND rv.package_key IS NULL
   ORDER BY m.framework_agreement_id, m.customer_signed_at DESC
)
UPDATE public.client_framework_agreements rv
   SET package_key             = q.package_key,
       package_version         = q.package_version,
       pricing_snapshot        = q.pricing_snapshot,
       pricing_snapshot_sha256 = q.pricing_snapshot_sha256,
       -- Vereinbart wurde die Kondition mit dem Auftrag, in dem sie steht.
       package_selected_at     = COALESCE(q.package_selected_at, rv.countersigned_at),
       updated_at              = now()
  FROM quelle q
 WHERE rv.id = q.rv_id
   AND rv.package_key IS NULL;

-- Was nicht nachgezogen werden konnte, soll sichtbar sein statt still zu
-- scheitern: ein aktiver Rahmenvertrag ohne Kondition schickt den Kunden bei
-- der naechsten Position erneut in die Unterschrift.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
    FROM public.client_framework_agreements
   WHERE status = 'active' AND package_key IS NULL;
  IF n > 0 THEN
    RAISE WARNING 'Nachziehen unvollstaendig: % aktive(r) Rahmenvertrag/-vertraege ohne Kondition. '
                  'Diese Kunden unterschreiben bei der naechsten Position erneut.', n;
  END IF;
END $$;

COMMIT;
