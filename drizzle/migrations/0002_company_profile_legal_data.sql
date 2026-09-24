ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS legal_name          text,
  ADD COLUMN IF NOT EXISTS street              text,
  ADD COLUMN IF NOT EXISTS postal_code         text,
  ADD COLUMN IF NOT EXISTS city                text,
  ADD COLUMN IF NOT EXISTS registration_number text;

COMMENT ON COLUMN public.company_profiles.legal_name IS
  'Vollstaendige Firmierung wie im Handelsregister, z. B. "Bluewater & Bridge GmbH". Steht auf der Vereinbarung.';
COMMENT ON COLUMN public.company_profiles.registration_number IS
  'Handelsregister, z. B. "HRB 288632".';

UPDATE public.company_profiles
   SET street      = COALESCE(street, trim(substring(address from '^(.*?)[,\n]\s*\d{4,5}\s+.+$'))),
       postal_code = COALESCE(postal_code, substring(address from '[,\n]\s*(\d{4,5})\s+.+$')),
       city        = COALESCE(city, trim(substring(address from '[,\n]\s*\d{4,5}\s+(.+)$'))),
       legal_name  = COALESCE(legal_name, company_name)
 WHERE address IS NOT NULL AND address ~ '[,\n]\s*\d{4,5}\s+';