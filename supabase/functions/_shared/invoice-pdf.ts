// Belege als PDF (Paket 4a, 22.10.2026; erweitert im Umbau 11.11.2026).
//
// Rechnung und Stornorechnung: Pflichtangaben nach § 14 Abs. 4 UStG – Name und
// Anschrift beider Seiten, USt-IdNr. des Ausstellers, Datum, fortlaufende
// Nummer, Leistung, Leistungszeitpunkt, Entgelt, Steuersatz und -betrag bzw.
// Hinweis auf Reverse Charge oder „nicht im Inland steuerbar“.
// Gutschrift (H12): Matchunt stellt sie für den Headhunter aus (§ 14 Abs. 2
// Satz 2 UStG). Leistender ist der Headhunter: seine Anschrift und Steuernummer
// bzw. USt-IdNr. stehen darauf, dazu das Wort „Gutschrift“.
// Mahnung (A4): Schreiben mit offenem Betrag, Zinsen, Pauschale und Frist.
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';
import { BANK, ISSUER } from './billing-config.ts';

export interface InvoiceLine { title: string; details: string[]; amountCents: number }

export interface InvoiceDoc {
  kind: 'invoice' | 'cancellation';
  draft: boolean;
  number: string | null;
  issuedOn: string;
  dueOn: string | null;
  serviceOn: string | null;
  recipient: { name: string; street: string | null; city: string | null; vatId: string | null; country?: string | null };
  reference: string | null;
  /** Bestellnummer und Kostenstelle des Kunden (Etappe 1, 25.10.2026) */
  purchaseOrder?: string | null;
  costCenter?: string | null;
  /** Bestellnummer fehlt noch, Rechnung trotzdem gestellt (K12, ab Tag 7) */
  poFollows?: boolean;
  /** Stornorechnung: storniert diese Nummer; korrigierte Rechnung: ersetzt diese Nummer */
  correctsNumber?: string | null;
  correctsLabel?: string | null;
  /** Grund der Stornierung/Korrektur (Pflicht, steht auf dem Beleg) */
  reason?: string | null;
  lines: InvoiceLine[];
  netCents: number;
  vatRate: number;
  vatCents: number;
  totalCents: number;
  reverseCharge: boolean;
  /** Steuerfall (domestic | reverse_charge | not_taxable) mit Hinweistext */
  taxCase?: string | null;
  taxNote?: string | null;
}

export const eur = (cents: number) => `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} €`.replace(/−/g, '-');
const day = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }) : '');

// ---------------------------------------------------------------------------
// Schrift: Helvetica kennt nur WinAnsi. „Aydın“, „−“, „→“ würden das PDF
// sonst abbrechen lassen.
// ---------------------------------------------------------------------------

const WIN_ANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
const SPECIAL: Record<string, string> = { 'ı': 'i', 'İ': 'I', 'ł': 'l', 'Ł': 'L', 'đ': 'd', 'Đ': 'D', '−': '-', '→': '->', '←': '<-', '≥': '>=', '≤': '<=', ' ': ' ', ' ': ' ', '​': '' };
export function pdfSafe(input: string): string {
  let out = '';
  for (const ch of String(input ?? '')) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(ch)) { out += ch; continue; }
    if (ch === '\n' || ch === '\t') { out += ' '; continue; }
    if (SPECIAL[ch] != null) { out += SPECIAL[ch]; continue; }
    const base = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '');
    out += [...base].every((c) => { const n = c.codePointAt(0)!; return n >= 0x20 && n <= 0x7e; }) && base ? base : '?';
  }
  return out;
}

const COUNTRY: Record<string, string> = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', NL: 'Niederlande', BE: 'Belgien', FR: 'Frankreich', IT: 'Italien', ES: 'Spanien', PL: 'Polen', LU: 'Luxemburg', DK: 'Dänemark', SE: 'Schweden', GB: 'Vereinigtes Königreich', US: 'USA', LI: 'Liechtenstein' };
const countryLine = (c: string | null | undefined) => {
  const v = String(c ?? '').trim().toUpperCase();
  return v && v !== 'DE' ? (COUNTRY[v] ?? v) : null;
};

/** Gemeinsames Blatt: Seitenumbruch, rechtsbündig, Fuß. */
async function sheet(title: string) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(pdfSafe(title));
  pdf.setAuthor(ISSUER.name);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.42, 0.42, 0.47);
  let page = pdf.addPage([595, 842]);
  const pages: PDFPage[] = [page];
  const text = (s: string, x: number, y: number, size = 10, f: PDFFont = font, color = ink) => page.drawText(pdfSafe(s), { x, y, size, font: f, color });
  const right = (s: string, xRight: number, y: number, size = 10, f: PDFFont = font, color = ink) => {
    const v = pdfSafe(s);
    page.drawText(v, { x: xRight - f.widthOfTextAtSize(v, size), y, size, font: f, color });
  };
  const line = (x1: number, y: number, x2: number) => page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: 0.5, color: muted });
  /** Text umbrechen auf Breite */
  const wrap = (s: string, width: number, size = 9, f: PDFFont = font): string[] => {
    const words = pdfSafe(s).split(/\s+/);
    const out: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > width && cur) { out.push(cur); cur = w; } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  const newPage = () => { page = pdf.addPage([595, 842]); pages.push(page); return 780; };
  const ensure = (y: number, need: number) => (y - need < 110 ? newPage() : y);
  const foot = () => {
    const f1 = `${ISSUER.name} · ${ISSUER.street} · ${ISSUER.city} · ${ISSUER.email} · Tel. ${ISSUER.phone}`;
    const f2 = `Geschäftsführer: ${ISSUER.managingDirector} · ${ISSUER.register} · USt-IdNr. ${ISSUER.vatId}`;
    pages.forEach((p, i) => {
      p.drawText(pdfSafe(f1), { x: 60, y: 60, size: 7, font, color: muted });
      p.drawText(pdfSafe(f2), { x: 60, y: 50, size: 7, font, color: muted });
      if (pages.length > 1) p.drawText(`Seite ${i + 1} von ${pages.length}`, { x: 480, y: 50, size: 7, font, color: muted });
    });
  };
  const head = () => {
    text('Matchunt', 60, 780, 20, bold);
    text(ISSUER.brand, 60, 764, 8, font, muted);
  };
  /** Angaben rechts oben: Spalte so weit links, dass nichts überlappt; gibt das y darunter zurück. */
  const meta = (rows: [string, string][], top: number) => {
    const wl = Math.max(0, ...rows.map(([k]) => font.widthOfTextAtSize(pdfSafe(k), 9)));
    const wv = Math.max(0, ...rows.map(([, v]) => font.widthOfTextAtSize(pdfSafe(v), 9)));
    const x = Math.max(300, Math.min(345, 535 - wv - wl - 14));
    let y = top;
    for (const [k, v] of rows) { text(k, x, y, 9, font, muted); right(v, 535, y, 9); y -= 14; }
    return y;
  };
  return { pdf, font, bold, ink, muted, text, right, line, wrap, ensure, foot, head, meta, get page() { return page; } };
}

// ---------------------------------------------------------------------------
// Rechnung und Stornorechnung
// ---------------------------------------------------------------------------

export async function renderInvoicePdf(d: InvoiceDoc): Promise<Uint8Array> {
  const title = d.kind === 'cancellation' ? 'Stornorechnung' : 'Rechnung';
  const s = await sheet(`${title} ${d.number ?? 'Entwurf'}`);
  const { text, right, line, wrap, ensure, bold, font, muted } = s;
  if (d.draft) s.page.drawText('ENTWURF', { x: 150, y: 380, size: 96, font: bold, color: rgb(0.93, 0.93, 0.95), rotate: degrees(30) });
  s.head();
  text(`${ISSUER.name} · ${ISSUER.street} · ${ISSUER.city}`, 60, 712, 7, font, muted);
  let y = 696;
  for (const l of [d.recipient.name, d.recipient.street, d.recipient.city, countryLine(d.recipient.country)].filter(Boolean) as string[]) { text(l, 60, y, 10); y -= 14; }

  right(title, 535, 712, 18, bold);
  const meta: [string, string][] = [
    [`${title}snummer`, d.number ?? 'wird bei Freigabe vergeben'],
    [`${title === 'Rechnung' ? 'Rechnungs' : 'Storno'}datum`, day(d.issuedOn)],
    ...(d.serviceOn ? [['Leistungsdatum', day(d.serviceOn)] as [string, string]] : []),
    ...(d.dueOn && d.kind === 'invoice' ? [['Zahlbar bis', day(d.dueOn)] as [string, string]] : []),
    ...(d.recipient.vatId ? [['Ihre USt-IdNr.', d.recipient.vatId] as [string, string]] : []),
    ...(d.reference ? [['Auftrag', d.reference] as [string, string]] : []),
    ...(d.purchaseOrder ? [['Ihre Bestellnummer', d.purchaseOrder] as [string, string]] : d.poFollows ? [['Ihre Bestellnummer', 'folgt'] as [string, string]] : []),
    ...(d.costCenter ? [['Kostenstelle', d.costCenter] as [string, string]] : []),
    ...(d.correctsNumber ? [[d.correctsLabel ?? (d.kind === 'cancellation' ? 'Storniert Rechnung' : 'Ersetzt Rechnung'), d.correctsNumber] as [string, string]] : []),
  ];
  const my = s.meta(meta, 690);

  y = Math.min(560, my - 20);
  if (d.reason) {
    for (const l of wrap(`${d.kind === 'cancellation' ? 'Grund der Stornierung' : 'Grund der Korrektur'}: ${d.reason}`, 475, 9)) { text(l, 60, y, 9); y -= 13; }
    y -= 10;
  }
  text('Leistung', 60, y, 9, bold, muted); right('Betrag', 535, y, 9, bold, muted);
  line(60, y - 6, 535);
  y -= 24;
  for (const l of d.lines) {
    y = ensure(y, 40 + l.details.length * 13);
    const titleLines = wrap(l.title, 380, 10, bold);
    titleLines.forEach((t, i) => { s.text(t, 60, y, 10, bold); if (i === 0) s.right(eur(l.amountCents), 535, y, 10); y -= 14; });
    y -= 1;
    for (const det of l.details) for (const w of wrap(det, 400, 9)) { s.text(w, 60, y, 9, font, muted); y -= 13; }
    y -= 8;
  }
  y = ensure(y, 90);
  s.line(300, y, 535);
  y -= 18;
  s.text('Nettobetrag', 300, y, 10); s.right(eur(d.netCents), 535, y, 10); y -= 16;
  const noVat = d.reverseCharge || d.taxCase === 'reverse_charge' || d.taxCase === 'not_taxable';
  s.text(noVat ? 'Umsatzsteuer' : `Umsatzsteuer ${d.vatRate} %`, 300, y, 10); s.right(eur(noVat ? 0 : d.vatCents), 535, y, 10); y -= 16;
  s.text('Gesamtbetrag', 300, y, 11, bold); s.right(eur(d.totalCents), 535, y, 11, bold);
  y -= 34;

  const note = (t: string) => { for (const w of wrap(t, 475, 9)) { y = ensure(y, 14); s.text(w, 60, y, 9); y -= 13; } };
  const taxNote = d.taxNote ?? (d.taxCase === 'not_taxable' ? 'Nicht im Inland steuerbare Leistung (§ 3a Abs. 2 UStG). Steuerschuldnerschaft des Leistungsempfängers.' : (d.reverseCharge || d.taxCase === 'reverse_charge') ? 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG).' : null);
  if (taxNote) note(taxNote);
  if (d.kind === 'invoice') {
    if (d.poFollows && !d.purchaseOrder) note('Ihre Bestellnummer lag bei Rechnungsstellung noch nicht vor und folgt.');
    note(`Bitte überweisen Sie den Gesamtbetrag ohne Abzug bis ${day(d.dueOn)}.`);
    note(`Verwendungszweck: ${d.number ?? 'Rechnungsnummer'}`);
    y -= 6;
    note(`Kontoinhaber: ${BANK.holder || '–'}`);
    note(`IBAN: ${BANK.iban || '–'}${BANK.bic ? ` · BIC: ${BANK.bic}` : ''}${BANK.bank ? ` · ${BANK.bank}` : ''}`);
  } else {
    note(`Diese Stornorechnung hebt die Rechnung ${d.correctsNumber ?? ''} vollständig auf.`);
    note('Ein bereits gezahlter Betrag wird mit der neuen Rechnung verrechnet.');
  }
  s.foot();
  return await s.pdf.save();
}

// ---------------------------------------------------------------------------
// Gutschrift an den Headhunter (H12)
// ---------------------------------------------------------------------------

export interface CreditNoteLine { title: string; details: string[]; amountCents: number }

export interface CreditNoteDoc {
  number: string;
  issuedOn: string;
  /** „November 2026“ */
  periodLabel: string;
  payUntil: string;
  recipient: { name: string; street: string | null; city: string | null; country?: string | null; vatId: string | null; taxNumber: string | null };
  taxMode: 'standard' | 'small_business' | 'foreign';
  lines: CreditNoteLine[];
  netCents: number;
  vatRate: number;
  vatCents: number;
  totalCents: number;
  ibanMasked: string | null;
}

export async function renderCreditNotePdf(d: CreditNoteDoc): Promise<Uint8Array> {
  const s = await sheet(`Gutschrift ${d.number}`);
  const { text, right, wrap, font, bold, muted } = s;
  s.head();
  text(`${ISSUER.name} · ${ISSUER.street} · ${ISSUER.city}`, 60, 712, 7, font, muted);
  let y = 696;
  for (const l of [d.recipient.name, d.recipient.street, d.recipient.city, countryLine(d.recipient.country)].filter(Boolean) as string[]) { text(l, 60, y, 10); y -= 14; }
  if (d.recipient.vatId) { text(`USt-IdNr.: ${d.recipient.vatId}`, 60, y, 9, font, muted); y -= 13; }
  if (d.recipient.taxNumber) { text(`Steuernummer: ${d.recipient.taxNumber}`, 60, y, 9, font, muted); y -= 13; }

  right('Gutschrift', 535, 712, 18, bold);
  const meta: [string, string][] = [
    ['Gutschriftnummer', d.number],
    ['Datum', day(d.issuedOn)],
    ['Leistungszeitraum', d.periodLabel],
    ['Zahlung bis', day(d.payUntil)],
    ['Leistungsempfänger', ISSUER.name],
    ['USt-IdNr. Leistungsempfänger', ISSUER.vatId],
  ];
  const my = s.meta(meta, 690);

  y = Math.min(y - 24, my - 24, 560);
  text('Leistung', 60, y, 9, bold, muted); right('Betrag', 535, y, 9, bold, muted);
  s.line(60, y - 6, 535);
  y -= 24;
  for (const l of d.lines) {
    y = s.ensure(y, 40 + l.details.length * 13);
    wrap(l.title, 380, 10, bold).forEach((t, i) => { s.text(t, 60, y, 10, bold); if (i === 0) s.right(eur(l.amountCents), 535, y, 10); y -= 14; });
    y -= 1;
    for (const det of l.details) for (const w of wrap(det, 400, 9)) { s.text(w, 60, y, 9, font, muted); y -= 13; }
    y -= 8;
  }
  y = s.ensure(y, 90);
  s.line(300, y, 535);
  y -= 18;
  s.text('Netto', 300, y, 10); s.right(eur(d.netCents), 535, y, 10); y -= 16;
  if (d.taxMode === 'standard') { s.text(`zzgl. ${d.vatRate} % USt`, 300, y, 10); s.right(eur(d.vatCents), 535, y, 10); y -= 16; }
  s.text('Auszahlung', 300, y, 11, bold); s.right(eur(d.totalCents), 535, y, 11, bold);
  y -= 34;
  const note = (t: string) => { for (const w of wrap(t, 475, 9)) { y = s.ensure(y, 14); s.text(w, 60, y, 9); y -= 13; } };
  if (d.taxMode === 'small_business') note('Kein Ausweis der Umsatzsteuer (§ 19 UStG).');
  if (d.taxMode === 'foreign') note('Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG). Die Umsatzsteuer schuldet die Bluewater & Bridge GmbH.');
  note(`Gutschrift im Sinne von § 14 Abs. 2 Satz 2 UStG. Zahlung bis ${day(d.payUntil)}${d.ibanMasked ? ` auf ${d.ibanMasked}` : ''}. Einwände binnen 30 Tagen.`);
  s.foot();
  return await s.pdf.save();
}

// ---------------------------------------------------------------------------
// Mahnung (A4)
// ---------------------------------------------------------------------------

export interface DunningDoc {
  level: 1 | 2;
  issuedOn: string;
  recipient: { name: string; street: string | null; city: string | null; country?: string | null };
  invoiceNumber: string;
  invoiceDate: string | null;
  dueOn: string | null;
  totalCents: number;
  paidCents: number;
  openCents: number;
  interest?: { cents: number; ratePct: number; days: number; basePct: number } | null;
  feeCents: number;
  payUntil: string;
  reminderOn: string | null;
  /** Kandidat und Stelle (wie in der Erinnerung) */
  subject: string | null;
}

export async function renderDunningPdf(d: DunningDoc): Promise<Uint8Array> {
  const title = `${d.level}. Mahnung`;
  const s = await sheet(`${title} ${d.invoiceNumber}`);
  const { text, right, wrap, font, bold, muted } = s;
  s.head();
  text(`${ISSUER.name} · ${ISSUER.street} · ${ISSUER.city}`, 60, 712, 7, font, muted);
  let y = 696;
  for (const l of [d.recipient.name, d.recipient.street, d.recipient.city, countryLine(d.recipient.country)].filter(Boolean) as string[]) { text(l, 60, y, 10); y -= 14; }
  right(title, 535, 712, 18, bold);
  const my = s.meta([['Datum', day(d.issuedOn)], ['Rechnung', d.invoiceNumber], ['Rechnungsdatum', day(d.invoiceDate)], ['Fällig seit', day(d.dueOn)]], 690);
  y = Math.min(y - 24, my - 24, 560);
  const para = (t: string) => { for (const w of wrap(t, 475, 10)) { y = s.ensure(y, 14); s.text(w, 60, y, 10); y -= 14; } y -= 6; };
  para('Guten Tag,');
  para(d.level === 1
    ? `trotz unserer Erinnerung${d.reminderOn ? ` vom ${day(d.reminderOn)}` : ''} ist die Rechnung ${d.invoiceNumber}${d.subject ? ` (${d.subject})` : ''} noch nicht vollständig bezahlt. Bitte überweisen Sie den offenen Betrag bis ${day(d.payUntil)}.`
    : `die Rechnung ${d.invoiceNumber}${d.subject ? ` (${d.subject})` : ''} ist trotz unserer 1. Mahnung noch offen. Seit dem Tag nach der Fälligkeit befinden Sie sich in Verzug. Wir berechnen deshalb Verzugszinsen (§ 288 Abs. 2 BGB) und die Pauschale nach § 288 Abs. 5 BGB. Bitte überweisen Sie den Gesamtbetrag bis ${day(d.payUntil)}.`);
  y -= 4;
  s.line(60, y, 535); y -= 18;
  const row = (k: string, v: number, strong = false) => { s.text(k, 60, y, 10, strong ? bold : font); s.right(eur(v), 535, y, 10, strong ? bold : font); y -= 16; };
  row('Rechnungsbetrag', d.totalCents);
  if (d.paidCents > 0) row('bereits gezahlt', -d.paidCents);
  row('offen', d.openCents);
  if (d.interest && d.interest.cents > 0) row(`Verzugszinsen ${String(d.interest.ratePct).replace('.', ',')} % p. a. (Basiszinssatz ${String(d.interest.basePct).replace('.', ',')} % + 9 Prozentpunkte), ${d.interest.days} Tage`, d.interest.cents);
  if (d.feeCents > 0) row('Pauschale nach § 288 Abs. 5 BGB', d.feeCents);
  y -= 4;
  s.line(300, y + 13, 535);
  row('Gesamt', d.openCents + (d.interest?.cents ?? 0) + d.feeCents, true);
  y -= 16;
  para(`Verwendungszweck: ${d.invoiceNumber}`);
  if (BANK.iban) para(`Kontoinhaber: ${BANK.holder} · IBAN: ${BANK.iban}${BANK.bic ? ` · BIC: ${BANK.bic}` : ''}`);
  para('Haben Sie inzwischen bezahlt, betrachten Sie dieses Schreiben bitte als gegenstandslos.');
  para('Mit freundlichen Grüßen');
  para('Ihr Matchunt-Team');
  s.foot();
  return await s.pdf.save();
}
