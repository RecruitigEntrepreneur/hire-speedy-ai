// Admin-Buchhaltung (Umbau 11.11.2026): Besetzungen mit Fahrplan, Rechnungen,
// Zahlungen, Gutschriften, Fällen und Export (A1–A9), Pakete & Konditionen
// (A10, J6), Joker-Entscheidung (J1) und faire Zusammenarbeit je Kunde (F1).
// Nur für Matchunt (jede Aktion prüft die Admin-Rolle). verify_jwt = true.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { placementCtx } from '../_shared/placement-service.ts';
import { requireAdminUser } from '../_shared/buchhaltung-kern.ts';
import {
  cancelOrCorrect, correctionPreview, invoiceCheck, invoiceUrl, manualPayment, overview, releaseChecked, resendInvoice,
} from '../_shared/buchhaltung-service.ts';
import { dunningPreview, sendDunning } from '../_shared/mahnwesen.ts';
import {
  bookSafeSuggestions, bookTransaction, hiddenTransactions, hideTransaction, importStatement, paymentsOverview,
} from '../_shared/buchhaltung-zahlungen.ts';
import { createCreditRun, creditNotePreview, creditNoteUrl, creditRunOverview, resolveObjection, sepaFile } from '../_shared/buchhaltung-gutschriften.ts';
import {
  caseDetail, caseDocument, casesList, decideCase, decideJokerAction, endResearchAction, handleReport, jokerDetail, researchDetail, resolveStart, startDetail,
} from '../_shared/buchhaltung-faelle.ts';
import { exportBookings, exportDocuments, exportOpenItems, exportOverview, lockPeriod } from '../_shared/buchhaltung-export.ts';
import { announceConditions, conditionsOverview, setConditionsDate } from '../_shared/buchhaltung-konditionen.ts';
import { cooperationAction, cooperationDetail, cooperationList } from '../_shared/buchhaltung-zusammenarbeit.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const user = await authUser(req);
    const ctx = placementCtx(defaultCtx(serviceClient()));
    await requireAdminUser(ctx, user);
    switch (body.action) {
      // A1/A2 Fahrplan und Rechnungen
      case 'overview': return json(await overview(ctx, user));
      case 'invoice_check': return json(await invoiceCheck(ctx, user, body));
      case 'invoice_release': return json(await releaseChecked(ctx, user, body));
      case 'invoice_pdf': return json(await invoiceUrl(ctx, user, body));
      case 'invoice_resend': return json(await resendInvoice(ctx, user, body));
      case 'invoice_manual_payment': return json(await manualPayment(ctx, user, body));
      case 'correction_preview': return json(await correctionPreview(ctx, user, body));
      case 'invoice_correct': return json(await cancelOrCorrect(ctx, user, body));
      // A4 Mahnen
      case 'dunning_preview': return json(await dunningPreview(ctx, user, body));
      case 'dunning_send': return json(await sendDunning(ctx, user, body));
      // A6 Zahlungen
      case 'payments': return json(await paymentsOverview(ctx, user));
      case 'statement_import': return json(await importStatement(ctx, user, body));
      case 'transaction_book': return json(await bookTransaction(ctx, user, body));
      case 'transactions_book_safe': return json(await bookSafeSuggestions(ctx, user));
      case 'transaction_hide': return json(await hideTransaction(ctx, user, body));
      case 'transactions_hidden': return json(await hiddenTransactions(ctx, user));
      // A7 Gutschriften
      case 'credit_run': return json(await creditRunOverview(ctx, user, body));
      case 'credit_note_preview': return json(await creditNotePreview(ctx, user, body));
      case 'credit_run_create': return json(await createCreditRun(ctx, user, body));
      case 'credit_run_sepa': return json(await sepaFile(ctx, user, body));
      case 'credit_note_pdf': return json(await creditNoteUrl(ctx, user, body));
      case 'objection_resolve': return json(await resolveObjection(ctx, user, body));
      // A8 Fälle, J1
      case 'cases': return json(await casesList(ctx, user));
      case 'case_detail': return json(await caseDetail(ctx, user, body));
      case 'case_decide': return json(await decideCase(ctx, user, body));
      case 'case_document': return json(await caseDocument(ctx, user, body));
      case 'joker_detail': return json(await jokerDetail(ctx, user, body));
      case 'joker_decide': return json(await decideJokerAction(ctx, user, body));
      case 'start_detail': return json(await startDetail(ctx, user, body));
      case 'start_resolve': return json(await resolveStart(ctx, user, body));
      case 'research_detail': return json(await researchDetail(ctx, user, body));
      case 'research_end': return json(await endResearchAction(ctx, user, body));
      case 'report_handled': return json(await handleReport(ctx, user, body));
      // A9 Export
      case 'export_overview': return json(await exportOverview(ctx, user, body));
      case 'export_bookings': return json(await exportBookings(ctx, user, body));
      case 'export_documents': return json(await exportDocuments(ctx, user, body));
      case 'export_open_items': return json(await exportOpenItems(ctx, user));
      case 'period_lock': return json(await lockPeriod(ctx, user, body));
      // A10, J6
      case 'conditions': return json(await conditionsOverview(ctx, user));
      case 'conditions_date': return json(await setConditionsDate(ctx, user, body));
      case 'conditions_announce': return json(await announceConditions(ctx, user));
      // F1 Zusammenarbeit
      case 'cooperation_list': return json(await cooperationList(ctx, user, body));
      case 'cooperation_detail': return json(await cooperationDetail(ctx, user, body));
      case 'cooperation_action': return json(await cooperationAction(ctx, user, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});
