// Kalender verbinden (Kunde, angemeldet): status, connect, disconnect, it_request.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { connect, disconnect, itRequest, status } from '../_shared/calendar-connect-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const user = await authUser(req);
    const ctx = defaultCtx(serviceClient());
    switch (body.action) {
      case 'status': return json(await status(ctx, user));
      case 'connect': return json(await connect(ctx, user, body));
      case 'disconnect': return json(await disconnect(ctx, user));
      case 'it_request': return json(await itRequest(ctx, user, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});
