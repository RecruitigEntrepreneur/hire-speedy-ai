/** Envelope-level Connect reuses the customer's HMAC key. No change to the
 * customer's account-level listener is necessary. Without HMAC, use API sync. */
export function recruiterConnect(env = (key: string) => Deno.env.get(key)) {
  if (!env('DOCUSIGN_HMAC_KEY')) return undefined;
  const base = env('SUPABASE_URL')?.replace(/\/+$/, '');
  if (!base || !/^https:\/\/[a-z0-9.-]+$/i.test(base)) throw new Error('Supabase-URL für DocuSign Connect fehlt.');
  return {
    url: `${base}/functions/v1/recruiter-docusign-webhook`,
    includeHMAC: 'true', requireAcknowledgment: 'true', loggingEnabled: 'true',
    deliveryMode: 'SIM',
    events: ['recipient-completed', 'recipient-declined', 'envelope-completed', 'envelope-declined', 'envelope-voided'],
    eventData: { version: 'restv2.1', format: 'json', includeData: ['recipients'] },
  };
}
