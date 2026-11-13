import i18n from '@/i18n';

/** Fehlertext einer Edge Function: der Grund aus der Antwort, nicht „non-2xx status code“. */
export async function functionError(error: any, data: any, fn = 'recruiter-notify'): Promise<string | null> {
  if (data?.error) return typeof data.error === 'string' ? data.error : data.message ?? i18n.t('errors:sendFailed');
  if (!error) return null;
  try {
    const body = await error.context?.json?.();
    if (body?.error || body?.message) return body.message ?? body.error;
  } catch { /* kein JSON */ }
  return /Failed to send a request/i.test(error.message ?? '')
    ? i18n.t('errors:notDeployed', { fn })
    : error.message ?? i18n.t('errors:sendFailed');
}
