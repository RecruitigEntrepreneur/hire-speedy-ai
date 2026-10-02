// Rücksprung von Microsoft nach Anmeldung bzw. Firmen-Freigabe durch die IT.
// verify_jwt = false: Microsoft ruft ohne Supabase-Sitzung auf; geschützt
// über den einmaligen, kurzlebigen state aus calendar_oauth_states.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { defaultCtx } from '../_shared/interview-service.ts';
import { handleCallback } from '../_shared/calendar-connect-service.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';

serve(async (req) => {
  let target = `${getPublicAppUrl()}/dashboard/settings?kalender=fehler#kalender`;
  try {
    target = await handleCallback(defaultCtx(serviceClient()), new URL(req.url).searchParams);
  } catch (e) {
    console.error('[calendar-oauth-callback]', e instanceof Error ? e.message : e);
  }
  return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store' } });
});
