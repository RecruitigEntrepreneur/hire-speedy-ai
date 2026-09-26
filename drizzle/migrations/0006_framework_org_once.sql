CREATE OR REPLACE FUNCTION public.framework_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $fn$
DECLARE
  erlaubt text[];
BEGIN
  erlaubt := CASE OLD.status
    WHEN 'draft'           THEN ARRAY['draft','pending_release','voided']
    WHEN 'pending_release' THEN ARRAY['pending_release','sent','draft','voided']
    WHEN 'sent'            THEN ARRAY['sent','customer_signed','declined','expired','voided']
    WHEN 'customer_signed' THEN ARRAY['customer_signed','active','voided']
    WHEN 'active'          THEN ARRAY['active','superseded','terminated']
    ELSE ARRAY[OLD.status]
  END;

  IF NOT (NEW.status = ANY (erlaubt)) THEN
    RAISE EXCEPTION 'Rahmenvertrag %: Uebergang % -> % ist nicht vorgesehen.',
      OLD.agreement_number, OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.countersigned_at IS NOT NULL AND NEW.customer_signed_at IS NULL THEN
    RAISE EXCEPTION 'Rahmenvertrag %: Matchunt zeichnet zuletzt -- ohne Kundenunterschrift keine Gegenzeichnung.',
      OLD.agreement_number USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.customer_signed_at IS NOT NULL THEN
    IF NEW.snapshot_sha256    IS DISTINCT FROM OLD.snapshot_sha256
    OR NEW.snapshot           IS DISTINCT FROM OLD.snapshot
    OR NEW.template_id        IS DISTINCT FROM OLD.template_id
    OR NEW.template_version   IS DISTINCT FROM OLD.template_version
    OR NEW.agb_version        IS DISTINCT FROM OLD.agb_version
    OR NEW.document_sha256    IS DISTINCT FROM OLD.document_sha256
    OR NEW.customer_signed_at IS DISTINCT FROM OLD.customer_signed_at
    OR NEW.customer_signer_email IS DISTINCT FROM OLD.customer_signer_email
    OR (OLD.organization_id IS NOT NULL
        AND NEW.organization_id IS DISTINCT FROM OLD.organization_id)
    THEN
      RAISE EXCEPTION 'Rahmenvertrag % ist vom Kunden unterzeichnet und unveraenderlich. Fuer eine Aenderung die Fassung beenden und eine neue zur erneuten Unterschrift anlegen.',
        OLD.agreement_number USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.status = 'terminated' AND NEW.terminated_at IS NULL THEN
    NEW.terminated_at := now();
  END IF;
  IF NEW.status = 'declined' AND NEW.declined_at IS NULL THEN
    NEW.declined_at := now();
  END IF;

  RETURN NEW;
END;
$fn$;