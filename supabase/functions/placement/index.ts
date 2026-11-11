// Einstellung und Rechnung (Paket 4a, 22.10.2026): Admin › Besetzungen (Fahrplan,
// Rechnungen), Rechnung prüfen und freigeben, Zahlung buchen, PDF abrufen.
// Seit Etappe 1 (25.10.2026) auch für Kunden: Seite „Besetzungen“ mit Meldungen
// und Bereich „Rechnungen“ (Belege, Export, Rechnungsdaten). Umbau 11.11.2026:
// Antritt, „Besetzung endet“, Nachbesetzung und Angebot bei Core (K5–K7, J2/J3).
// Logik in _shared/placement-service.ts, besetzung-service.ts, billing-service.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { adminOverview, bookPayment, invoiceFile, invoicePreview, placementCtx, releaseInvoice } from '../_shared/placement-service.ts';
import {
  answerResearchOffer, clientOverview, confirmPosition, endDocument, endResearchForClient, moveStart, reopenJob, reportDeparture,
  reportEndForClient, setPurchaseOrder, startAnswer,
} from '../_shared/besetzung-service.ts';
import { clientInvoices, invoiceFiles, updateBillingSettings } from '../_shared/billing-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const user = await authUser(req);
    const ctx = placementCtx(defaultCtx(serviceClient()));
    switch (body.action) {
      case 'admin_overview': return json(await adminOverview(ctx, user));
      case 'invoice_preview': return json(await invoicePreview(ctx, user, body));
      case 'release_invoice': return json(await releaseInvoice(ctx, user, body));
      case 'book_payment': return json(await bookPayment(ctx, user, body));
      case 'invoice_file': return json(await invoiceFile(ctx, user, body));
      // Kunde: Besetzungen
      case 'client_overview': return json(await clientOverview(ctx, user));
      case 'move_start': return json(await moveStart(ctx, user, body));
      case 'start_answer': return json(await startAnswer(ctx, user, body));
      case 'report_end': return json(await reportEndForClient(ctx, user, body));
      case 'end_document':
      case 'non_start_document': return json(await endDocument(ctx, user, body));
      case 'confirm_research_position': return json(await confirmPosition(ctx, user, body));
      case 'end_research': return json(await endResearchForClient(ctx, user, body));
      case 'answer_research_offer': return json(await answerResearchOffer(ctx, user, body));
      case 'reopen_job': return json(await reopenJob(ctx, user, body));
      case 'report_departure': return json(await reportDeparture(ctx, user, body));
      case 'set_purchase_order': return json(await setPurchaseOrder(ctx, user, body));
      // Kunde: Rechnungen
      case 'client_invoices': return json(await clientInvoices(ctx, user));
      case 'invoice_files': return json(await invoiceFiles(ctx, user, body));
      case 'billing_settings': return json(await updateBillingSettings(ctx, user, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});
