import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';
import { preflight, json, fail } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';

/**
 * generate-mandate-pdf — die Vermittlungsvereinbarung als Dokument.
 *
 * Erzeugt aus dem unveraenderlichen Snapshot des Mandats das Dokument, das der
 * Admin ueber DocuSign zur Unterschrift versendet. Quelle ist ausschliesslich
 * commercial_mandates.snapshot -- also genau das, was der Kunde gesehen und
 * bestaetigt hat, nicht der heutige Stand irgendeiner Tabelle. Deshalb steht
 * die Pruefsumme des Snapshots mit im Dokument.
 *
 * pdf-lib ist im Repo bereits im Einsatz (generate-cv-pdf/index.ts:3).
 *
 * Die Signaturmarke /sig1/ ist als Ankertext eingebettet: DocuSign kann das
 * Unterschriftsfeld daran ausrichten (anchorString), und eine spaetere
 * API-Anbindung braucht das Dokument nicht zu aendern.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 56;
const LINE = 14;

const eur = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const date = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' }) : '—';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const supabase = serviceClient();
    const admin = await requireAdmin(req, supabase);
    if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');

    const body = await req.json().catch(() => ({}));
    const mandateId = String(body?.mandate_id ?? '');
    if (!mandateId) return fail('invalid_request', 'mandate_id fehlt.');

    const { data: m, error } = await supabase
      .from('commercial_mandates').select('*').eq('id', mandateId).maybeSingle();
    if (error) return fail('internal_error', error.message);
    if (!m) return fail('not_found', 'Vereinbarung nicht gefunden.');
    if (!m.client_confirmed_at) {
      return fail('conflict', 'Die Konditionen wurden vom Kunden noch nicht bestätigt.');
    }

    const snap = (m.snapshot ?? {}) as Record<string, any>;
    const client = (snap.client ?? {}) as Record<string, any>;
    const position = (snap.position ?? {}) as Record<string, any>;
    const terms = (snap.terms ?? {}) as Record<string, any>;
    const agb = (snap.agb ?? {}) as Record<string, any>;

    // Der Vertragspartner. Matchunt ist eine Marke der Bluewater & Bridge GmbH;
    // die Angaben entsprechen dem Impressum. Als Vorgabe fest im Code, damit ein
    // fehlendes Secret nicht zu einem Vertrag ohne Firmierung fuehrt — per
    // Umgebungsvariable weiterhin uebersteuerbar, etwa bei einem Sitzwechsel.
    const vendorName = Deno.env.get('MANDATE_VENDOR_NAME') ?? 'Bluewater & Bridge GmbH';
    const vendorAddress = Deno.env.get('MANDATE_VENDOR_ADDRESS')
      ?? 'Adlzreiterstraße 2, 80337 München';
    const vendorRegister = Deno.env.get('MANDATE_VENDOR_REGISTER')
      ?? 'Amtsgericht München, HRB 288632 · USt-IdNr. DE365690081';

    // ---- Dokument ---------------------------------------------------------
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    let page = pdf.addPage(A4);
    let y = A4[1] - MARGIN;

    const newPage = () => { page = pdf.addPage(A4); y = A4[1] - MARGIN; };
    const space = (h: number) => { if (y - h < MARGIN + 40) newPage(); };

    const write = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number } = {}) => {
      const size = opts.size ?? 10;
      const f = opts.bold ? bold : font;
      const maxWidth = A4[0] - 2 * MARGIN - (opts.indent ?? 0);
      // Zeilenumbruch von Hand: pdf-lib bricht nicht selbst um.
      for (const paragraph of String(text).split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (words.length === 0) { space(LINE); y -= LINE * 0.6; continue; }
        let line = '';
        for (const word of words) {
          const candidate = line ? `${line} ${word}` : word;
          if (f.widthOfTextAtSize(candidate, size) > maxWidth && line) {
            space(LINE);
            page.drawText(line, { x: MARGIN + (opts.indent ?? 0), y, size, font: f,
              color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])) });
            y -= LINE;
            line = word;
          } else {
            line = candidate;
          }
        }
        if (line) {
          space(LINE);
          page.drawText(line, { x: MARGIN + (opts.indent ?? 0), y, size, font: f,
            color: rgb(...(opts.color ?? [0.1, 0.1, 0.12])) });
          y -= LINE;
        }
      }
    };

    const row = (label: string, value: string) => {
      space(LINE);
      page.drawText(label, { x: MARGIN, y, size: 10, font, color: rgb(0.42, 0.45, 0.5) });
      const maxWidth = A4[0] - 2 * MARGIN - 175;
      const words = String(value || '—').split(/\s+/);
      let line = '';
      let first = true;
      for (const word of words) {
        const candidate = line ? `${line} ${word}` : word;
        if (bold.widthOfTextAtSize(candidate, 10) > maxWidth && line) {
          page.drawText(line, { x: MARGIN + 175, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.12) });
          y -= LINE; space(LINE); line = word; first = false;
        } else line = candidate;
      }
      page.drawText(line, { x: MARGIN + 175, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.12) });
      y -= LINE;
      void first;
    };

    const rule = () => {
      space(12);
      page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: A4[0] - MARGIN, y: y + 4 },
        thickness: 0.6, color: rgb(0.85, 0.86, 0.88) });
      y -= 12;
    };

    const heading = (text: string) => { space(26); y -= 8; write(text, { size: 12, bold: true }); y -= 4; };

    // Kopf
    write('Matchunt', { size: 9, bold: true, color: [0.42, 0.45, 0.5] });
    y -= 6;
    write('Vermittlungsvereinbarung', { size: 18, bold: true });
    y -= 4;
    write(`Vorgangsnummer ${m.mandate_number}`, { size: 10, color: [0.42, 0.45, 0.5] });
    rule();

    heading('Vertragsparteien');
    row('Auftragnehmer', vendorName);
    if (vendorAddress) row('', vendorAddress);
    if (vendorRegister) row('Register', vendorRegister);
    row('Marke', 'Matchunt');
    y -= 6;
    row('Auftraggeber', client.company_legal_name || client.company_name || '—');
    const addr = [client.company_street, [client.company_postal_code, client.company_city].filter(Boolean).join(' '), client.company_country]
      .filter(Boolean).join(', ');
    if (addr) row('Anschrift', addr);
    if (client.company_vat_id) row('USt-IdNr.', client.company_vat_id);
    if (client.company_registration_number) row('Handelsregister', client.company_registration_number);
    row('Ansprechpartner', [client.contact_name, client.contact_role].filter(Boolean).join(', ') || '—');
    row('E-Mail', client.contact_email || '—');
    if (client.contact_phone) row('Telefon', client.contact_phone);

    rule();
    heading('Gegenstand');
    row('Position', position.title || '—');
    if (position.location) row('Standort', position.location);
    row('Art', position.employment_type === 'freelance' ? 'Contracting / Freiberuflich' : 'Festanstellung');
    y -= 4;
    write(
      'Der Auftragnehmer wird für den Auftraggeber geeignete Kandidatinnen und Kandidaten für die vorstehend bezeichnete Position identifizieren, ansprechen, vorauswählen und vorstellen. Ein Anspruch auf das Zustandekommen einer Vermittlung besteht nicht.',
      { size: 10 },
    );

    rule();
    heading('Konditionen');
    row(
      'Erfolgshonorar',
      `${eur(terms.fee_percentage)} % ${terms.fee_basis === 'annual_target_salary' ? 'des Zieljahresgehalts' : 'des Jahresbruttogehalts'}`,
    );
    row('Fällig', 'ausschließlich im Erfolgsfall, mit Unterzeichnung des Anstellungsvertrags');
    row('Zahlungsziel', `${terms.payment_terms_days ?? 14} Tage netto ohne Abzug`);
    if (terms.guarantee_days) row('Nachbesetzung', `${terms.guarantee_days} Tage`);
    row('Fixkosten', 'keine — kein Retainer, keine Grundgebühr');
    if (terms.vat_note) { y -= 4; write(String(terms.vat_note), { size: 9, color: [0.42, 0.45, 0.5] }); }

    if (terms.refund_rule) {
      y -= 6;
      write('Nachbesetzung und Erstattung', { size: 10, bold: true });
      write(String(terms.refund_rule), { size: 10 });
    }

    if (terms.body_md) {
      rule();
      heading('Vereinbarte Konditionen im Wortlaut');
      // Markdown-Auszeichnung entfernen: das PDF setzt seine eigene Typografie.
      write(String(terms.body_md).replace(/^#+\s*/gm, '').replace(/\*\*/g, ''), { size: 10 });
    }

    rule();
    heading('Allgemeine Geschäftsbedingungen');
    write(
      `Ergänzend gelten die Allgemeinen Geschäftsbedingungen des Auftragnehmers in der Fassung ${agb.version ?? '—'}, abrufbar unter ${agb.url ?? `${getPublicAppUrl()}/agb`}. Der Auftraggeber hat sie am ${date(m.agb_accepted_at)} in der Plattform bestätigt.`,
      { size: 10 },
    );

    rule();
    heading('Zustandekommen und Nachweis');
    write(
      `Der Auftraggeber hat die vorstehenden Konditionen am ${date(m.client_confirmed_at)} elektronisch bestätigt und damit die Beauftragung angefragt. Bestätigt durch ${client.signer_name ?? client.contact_name ?? '—'} (${m.client_confirmed_email ?? '—'}).`,
      { size: 10 },
    );
    y -= 4;
    write(
      `Der Auftragnehmer hat die Beauftragung am ${date(m.accepted_at)} angenommen. Prüfsumme des bestätigten Konditionsstands (SHA-256): ${m.snapshot_sha256}.`,
      { size: 9, color: [0.42, 0.45, 0.5] },
    );

    // ---- Unterschriftsblock ------------------------------------------------
    space(120);
    y -= 24;
    rule();
    heading('Unterschriften');
    y -= 8;
    const sigY = y;
    page.drawText('/sig1/', { x: MARGIN, y: sigY, size: 9, font, color: rgb(1, 1, 1) });
    page.drawLine({ start: { x: MARGIN, y: sigY - 26 }, end: { x: MARGIN + 200, y: sigY - 26 },
      thickness: 0.8, color: rgb(0.6, 0.62, 0.65) });
    page.drawText('Auftraggeber', { x: MARGIN, y: sigY - 40, size: 9, font, color: rgb(0.42, 0.45, 0.5) });
    page.drawText(String(client.company_legal_name || client.company_name || ''), {
      x: MARGIN, y: sigY - 52, size: 9, font, color: rgb(0.42, 0.45, 0.5),
    });

    const rightX = A4[0] / 2 + 20;
    page.drawLine({ start: { x: rightX, y: sigY - 26 }, end: { x: rightX + 200, y: sigY - 26 },
      thickness: 0.8, color: rgb(0.6, 0.62, 0.65) });
    page.drawText('Auftragnehmer', { x: rightX, y: sigY - 40, size: 9, font, color: rgb(0.42, 0.45, 0.5) });
    page.drawText(vendorName, { x: rightX, y: sigY - 52, size: 9, font, color: rgb(0.42, 0.45, 0.5) });

    // Fusszeile auf jeder Seite
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
      p.drawText(`${m.mandate_number} · Seite ${i + 1} von ${pages.length}`, {
        x: MARGIN, y: 32, size: 8, font, color: rgb(0.6, 0.62, 0.65),
      });
    });

    const bytes = await pdf.save();

    // ---- Ablegen -----------------------------------------------------------
    const path = `${m.id}/${m.mandate_number}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('mandate-documents')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      console.error('[generate-mandate-pdf] Upload:', upErr.message);
      return fail('internal_error', `Dokument konnte nicht abgelegt werden: ${upErr.message}`);
    }

    // Echter SHA-256 ueber das vollstaendige Dokument. Ein Hash ueber die
    // ersten Kilobytes wuerde die Spalte document_sha256 zur Falschaussage
    // machen -- gerade bei einem Vertragsdokument.
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const documentSha = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await supabase.from('commercial_mandates')
      .update({ document_path: path, document_sha256: documentSha }).eq('id', m.id);

    const { data: signed } = await supabase.storage
      .from('mandate-documents').createSignedUrl(path, 60 * 30);

    return json({
      ok: true,
      path,
      // 30 Minuten: lang genug zum Herunterladen und in DocuSign hochladen,
      // kurz genug, dass eine weitergegebene URL wertlos wird.
      url: signed?.signedUrl ?? null,
      mandate_number: m.mandate_number,
      pages: pages.length,
    });
  } catch (e) {
    console.error('[generate-mandate-pdf]', e);
    return fail('internal_error', 'Das Dokument konnte nicht erzeugt werden.');
  }
});
