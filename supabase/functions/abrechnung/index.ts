// Headhunter: Verdienste, Gutschriften, Abrechnungsdaten (Umbau 11.11.2026).
// H1/H2 Konditionen zustimmen, H3–H6 Verdienst an Stellen, H7 Antritt und Halbzeit,
// H8–H10 Verdienste und Besetzungs-Fenster, H11 Gutschriften und Einwand,
// H13 Abrechnungsdaten und geschützter Kontowechsel, F2 Kunde melden.
// Nur für angemeldete Headhunter und nur eigene Daten. Logik in
// _shared/abrechnung-service.ts, Ansicht in _shared/abrechnung-view.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { placementCtx } from '../_shared/placement-service.ts';
import {
  abrechnungCtx, accountChangeCancel, accountChangeConfirm, accountChangeRequest, billingProfile, clientReport, conditions, consent,
  creditNoteFile, creditNotes, creditNotesExport, halfway, jobTerms, objection, overview, placementView, reportStart,
  saveBillingProfile, selfBillingObjection, statement,
} from '../_shared/abrechnung-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const user = await authUser(req);
    const ctx = abrechnungCtx(placementCtx(defaultCtx(serviceClient())));
    switch (body.action) {
      // H8–H10, J5
      case 'overview': return json(await overview(ctx, user, body));
      case 'placement': return json(await placementView(ctx, user, body));
      // H7
      case 'report_start': return json(await reportStart(ctx, user, body));
      case 'halfway': return json(await halfway(ctx, user, body));
      case 'statement': return json(await statement(ctx, user, body));
      // H3–H6
      case 'job_terms': return json(await jobTerms(ctx, user, body));
      // H1/H2
      case 'conditions': return json(await conditions(ctx, user, body));
      case 'consent': return json(await consent(ctx, user, body));
      // H11
      case 'credit_notes': return json(await creditNotes(ctx, user, body));
      case 'credit_note_file': return json(await creditNoteFile(ctx, user, body));
      case 'credit_notes_export': return json(await creditNotesExport(ctx, user, body));
      case 'objection': return json(await objection(ctx, user, body));
      // H13
      case 'billing_profile': return json(body.save ? await saveBillingProfile(ctx, user, body) : await billingProfile(ctx, user));
      case 'account_change_request': return json(await accountChangeRequest(ctx, user, body));
      case 'account_change_confirm': return json(await accountChangeConfirm(ctx, user, body));
      case 'account_change_cancel': return json(await accountChangeCancel(ctx, user));
      case 'self_billing_objection': return json(await selfBillingObjection(ctx, user));
      // F2
      case 'client_report': return json(await clientReport(ctx, user, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});
