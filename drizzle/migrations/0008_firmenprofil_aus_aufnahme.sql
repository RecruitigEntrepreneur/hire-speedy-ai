ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS employer_selling_points jsonb,
  ADD COLUMN IF NOT EXISTS target_companies        text[],
  ADD COLUMN IF NOT EXISTS excluded_companies      text[],
  ADD COLUMN IF NOT EXISTS intake_source           jsonb;

COMMENT ON COLUMN public.company_profiles.intake_source IS
  'Welche Felder aus welcher Aufnahme übernommen wurden: {draft_id, at, fields[]}. '
  'Die Einstellungsseite markiert sie mit "aus Aufnahme", bis der Kunde sie ändert.';

WITH quelle AS (
  SELECT DISTINCT ON (j.client_id)
    j.client_id AS user_id,
    d.id        AS draft_id,
    nullif(btrim(d.company_name), '') AS company_name,
    COALESCE(
      nullif(btrim(d.company_legal_name), ''),
      CASE WHEN d.company_name ~ '(^|[[:space:],(])(GmbH|gGmbH|mbH|UG|AG|SE|KGaA|KG|OHG|GbR|e\.[[:space:]]?K\.|e\.[[:space:]]?V\.|eG|PartG|Ltd\.?|Limited|Inc\.?|LLC|plc|B\.V\.|N\.V\.|S\.A\.|S\.r\.l\.|S\.p\.A\.|A/S|AB|Oy|SARL|SAS)($|[[:space:],.;)])'
           THEN btrim(d.company_name) END
    ) AS legal_name,
    nullif(btrim(d.company_street), '')              AS street,
    nullif(btrim(d.company_postal_code), '')         AS postal_code,
    nullif(btrim(d.company_city), '')                AS city,
    nullif(btrim(d.company_registration_number), '') AS registration_number,
    nullif(btrim(d.company_vat_id), '')              AS tax_id,
    COALESCE(nullif(btrim(d.company_website), ''), nullif(btrim(d.company_domain), '')) AS website,
    nullif(btrim(d.company_industry), '')            AS industry,
    COALESCE(nullif(btrim(d.billing_email), ''), nullif(btrim(d.contact_email), '')) AS billing_email,
    CASE WHEN (d.dyn #>> '{catalog,known,company_headcount,value}') ~ '^[0-9]+$'
         THEN (d.dyn #>> '{catalog,known,company_headcount,value}')::integer END AS headcount
  FROM public.intake_drafts d
  JOIN public.jobs j ON j.id = d.job_id
  WHERE d.review_state = 'accepted'
    AND j.client_id IS NOT NULL
    AND nullif(btrim(d.company_name), '') IS NOT NULL
  ORDER BY j.client_id, d.submitted_at DESC NULLS LAST, d.created_at DESC
)
INSERT INTO public.company_profiles AS p (
  user_id, company_name, legal_name, street, postal_code, city, registration_number,
  tax_id, website, industry, billing_email, headcount, address, intake_source
)
SELECT
  q.user_id, q.company_name, q.legal_name, q.street, q.postal_code, q.city, q.registration_number,
  q.tax_id, q.website, q.industry, q.billing_email, q.headcount,
  nullif(concat_ws(', ', q.street, nullif(concat_ws(' ', q.postal_code, q.city), '')), ''),
  jsonb_build_object('draft_id', q.draft_id, 'at', now(), 'fields', to_jsonb(array_remove(ARRAY[
    'company_name',
    CASE WHEN q.legal_name IS NOT NULL THEN 'legal_name' END,
    CASE WHEN q.street IS NOT NULL THEN 'street' END,
    CASE WHEN q.postal_code IS NOT NULL THEN 'postal_code' END,
    CASE WHEN q.city IS NOT NULL THEN 'city' END,
    CASE WHEN q.registration_number IS NOT NULL THEN 'registration_number' END,
    CASE WHEN q.tax_id IS NOT NULL THEN 'tax_id' END,
    CASE WHEN q.website IS NOT NULL THEN 'website' END,
    CASE WHEN q.industry IS NOT NULL THEN 'industry' END,
    CASE WHEN q.billing_email IS NOT NULL THEN 'billing_email' END,
    CASE WHEN q.headcount IS NOT NULL THEN 'headcount' END
  ]::text[], NULL)))
FROM quelle q
ON CONFLICT (user_id) DO UPDATE SET
  legal_name          = COALESCE(nullif(btrim(p.legal_name), ''), EXCLUDED.legal_name),
  street              = COALESCE(nullif(btrim(p.street), ''), EXCLUDED.street),
  postal_code         = COALESCE(nullif(btrim(p.postal_code), ''), EXCLUDED.postal_code),
  city                = COALESCE(nullif(btrim(p.city), ''), EXCLUDED.city),
  registration_number = COALESCE(nullif(btrim(p.registration_number), ''), EXCLUDED.registration_number),
  tax_id              = COALESCE(nullif(btrim(p.tax_id), ''), EXCLUDED.tax_id),
  website             = COALESCE(nullif(btrim(p.website), ''), EXCLUDED.website),
  industry            = COALESCE(nullif(btrim(p.industry), ''), EXCLUDED.industry),
  billing_email       = COALESCE(nullif(btrim(p.billing_email), ''), EXCLUDED.billing_email),
  headcount           = COALESCE(p.headcount, EXCLUDED.headcount),
  address             = COALESCE(nullif(btrim(p.address), ''), EXCLUDED.address),
  intake_source       = COALESCE(p.intake_source, jsonb_build_object(
    'draft_id', EXCLUDED.intake_source->'draft_id', 'at', now(), 'fields', to_jsonb(array_remove(ARRAY[
      CASE WHEN nullif(btrim(p.legal_name), '') IS NULL AND EXCLUDED.legal_name IS NOT NULL THEN 'legal_name' END,
      CASE WHEN nullif(btrim(p.street), '') IS NULL AND EXCLUDED.street IS NOT NULL THEN 'street' END,
      CASE WHEN nullif(btrim(p.postal_code), '') IS NULL AND EXCLUDED.postal_code IS NOT NULL THEN 'postal_code' END,
      CASE WHEN nullif(btrim(p.city), '') IS NULL AND EXCLUDED.city IS NOT NULL THEN 'city' END,
      CASE WHEN nullif(btrim(p.registration_number), '') IS NULL AND EXCLUDED.registration_number IS NOT NULL THEN 'registration_number' END,
      CASE WHEN nullif(btrim(p.tax_id), '') IS NULL AND EXCLUDED.tax_id IS NOT NULL THEN 'tax_id' END,
      CASE WHEN nullif(btrim(p.website), '') IS NULL AND EXCLUDED.website IS NOT NULL THEN 'website' END,
      CASE WHEN nullif(btrim(p.industry), '') IS NULL AND EXCLUDED.industry IS NOT NULL THEN 'industry' END,
      CASE WHEN nullif(btrim(p.billing_email), '') IS NULL AND EXCLUDED.billing_email IS NOT NULL THEN 'billing_email' END,
      CASE WHEN p.headcount IS NULL AND EXCLUDED.headcount IS NOT NULL THEN 'headcount' END
    ]::text[], NULL))));