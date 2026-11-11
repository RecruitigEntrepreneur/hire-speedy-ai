// Stillgelegt (Umbau 11.11.2026): Headhunter werden nicht mehr über Stripe-
// Auszahlungsanträge bezahlt, sondern mit dem monatlichen Gutschriftlauf
// (Admin › Besetzungen › Gutschriften, SEPA). Die Function antwortet nur noch
// mit 410, damit alte Knöpfe oder Skripte nichts mehr auslösen.
import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { fail, preflight } from '../_shared/http.ts';

serve((req) => {
  const pre = preflight(req);
  if (pre) return pre;
  return fail('expired', 'Auszahlungen laufen über Gutschriften. Den Stand siehst du unter Verdienste › Gutschriften.');
});
