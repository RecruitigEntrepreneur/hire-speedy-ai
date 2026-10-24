// Arbeitsvertrag und Unterschrift (Paket 3, 22.10.2026): Stand, selbst verschicken,
// digital über DocuSign, melden, bestätigen, rückgängig, Gegenprobe, abgesprungen.
// Logik in _shared/contract-service.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import {
  adminCases, changeSigner, check, confirm, contractContext, contractCtx, drop, refreshDigital, report, resendDigital, resendLink, sendDigital, sendSelf,
  signedDocument, signUrl, undo, voidDigital,
} from '../_shared/contract-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const user = await authUser(req);
    const ctx = contractCtx(defaultCtx(serviceClient()));
    switch (body.action) {
      case 'context': return json(await contractContext(ctx, user, body));
      case 'send_self': return json(await sendSelf(ctx, user, body));
      case 'send_digital': return json(await sendDigital(ctx, user, body));
      case 'void_digital': return json(await voidDigital(ctx, user, body));
      case 'resend': return json(await resendDigital(ctx, user, body));
      // Unterschrift über Matchunt (23.10.2026)
      case 'sign_url': return json(await signUrl(ctx, user, body));
      case 'resend_link': return json(await resendLink(ctx, user, body));
      case 'change_signer': return json(await changeSigner(ctx, user, body));
      case 'refresh': return json(await refreshDigital(ctx, user, body));
      case 'report': return json(await report(ctx, user, body));
      case 'confirm': return json(await confirm(ctx, user, body));
      case 'undo': return json(await undo(ctx, user, body));
      case 'check': return json(await check(ctx, user, body));
      case 'drop': return json(await drop(ctx, user, body));
      case 'document': return json(await signedDocument(ctx, user, body));
      case 'admin_cases': return json(await adminCases(ctx, user));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});
