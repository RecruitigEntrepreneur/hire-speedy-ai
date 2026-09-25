/** Envelope-level Connect reuses the customer's HMAC key. No change to the
 * customer's account-level listener is necessary. Without HMAC, use API sync. */
function docusignConnect(listener: string, env: (key: string) => string | undefined) {
  if (!env('DOCUSIGN_HMAC_KEY')) return undefined;
  const base = env('SUPABASE_URL')?.replace(/\/+$/, '');
  if (!base || !/^https:\/\/[a-z0-9.-]+$/i.test(base)) throw new Error('Supabase-URL für DocuSign Connect fehlt.');
  return {
    url: `${base}/functions/v1/${listener}`,
    includeHMAC: 'true', requireAcknowledgment: 'true', loggingEnabled: 'true',
    deliveryMode: 'SIM',
    events: ['recipient-completed', 'recipient-declined', 'envelope-completed', 'envelope-declined', 'envelope-voided'],
    eventData: { version: 'restv2.1', format: 'json', includeData: ['recipients'] },
  };
}

export const recruiterConnect = (env = (key: string) => Deno.env.get(key)) => docusignConnect('recruiter-docusign-webhook', env);

/** Customer contracts (docusign-send) report to docusign-webhook; docusign-sync covers lost events. */
export const clientConnect = (env = (key: string) => Deno.env.get(key)) => docusignConnect('docusign-webhook', env);
