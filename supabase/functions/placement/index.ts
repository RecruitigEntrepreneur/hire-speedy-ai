// Einstellung und Rechnung (Paket 4a, 22.10.2026): Admin › Besetzungen (Fahrplan,
// Rechnungen), Rechnung prüfen und freigeben, Zahlung buchen, PDF abrufen.
// Seit Etappe 1 (25.10.2026) auch für Kunden: Seite „Besetzungen“ mit Meldungen
// und Bereich „Rechnungen“ (Belege, Export, Rechnungsdaten).
// Logik in _shared/placement-service.ts, besetzung-service.ts, billing-service.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { adminOverview, bookPayment, invoiceFile, invoicePreview, placementCtx, releaseInvoice } from '../_shared/placement-service.ts';
import { clientOverview, moveStart, nonStartDocument, reportDeparture, setPurchaseOrder } from '../_shared/besetzung-service.ts';
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
      case 'non_start_document': return json(await nonStartDocument(ctx, user, body));
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
