// Unterschrift über Matchunt (23.10.2026): Seite /unterschrift/:token ohne Konto.
// Der persönliche Link ist der Zugang (nur sein Hash liegt in der Datenbank).
// Stand, eingebettete Unterschrift starten, Rücksprung, neuer Link, Kopie als PDF.
// Logik in _shared/contract-service.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { contractCtx, linkDocument, linkPeek, linkRenew, linkReturned, linkStart } from '../_shared/contract-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const ctx = contractCtx(defaultCtx(serviceClient()));
    switch (body.action) {
      case 'peek': return json(await linkPeek(ctx, body));
      case 'start': return json(await linkStart(ctx, body));
      case 'returned': return json(await linkReturned(ctx, body));
      case 'renew': return json(await linkRenew(ctx, body));
      case 'document': return json(await linkDocument(ctx, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});
