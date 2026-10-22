// Rechnung als PDF (Paket 4a, 22.10.2026). Pflichtangaben nach § 14 Abs. 4 UStG:
// Name und Anschrift beider Seiten, USt-IdNr. des Ausstellers, Datum, fortlaufende
// Nummer, Leistung, Leistungszeitpunkt, Entgelt, Steuersatz und -betrag bzw.
// Hinweis auf die Steuerschuldnerschaft des Leistungsempfängers.
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
  recipient: { name: string; street: string | null; city: string | null; vatId: string | null };
  reference: string | null;
  correctsNumber?: string | null;
  lines: InvoiceLine[];
  netCents: number;
  vatRate: number;
  vatCents: number;
  totalCents: number;
  reverseCharge: boolean;
}

export const eur = (cents: number) => `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} €`;
const day = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Berlin' }) : '');

export async function renderInvoicePdf(d: InvoiceDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${d.kind === 'cancellation' ? 'Stornorechnung' : 'Rechnung'} ${d.number ?? 'Entwurf'}`);
  pdf.setAuthor(ISSUER.name);
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.42, 0.42, 0.47);
  const text = (p: PDFPage, s: string, x: number, y: number, size = 10, f: PDFFont = font, color = ink) => p.drawText(s, { x, y, size, font: f, color });
  const right = (p: PDFPage, s: string, xRight: number, y: number, size = 10, f: PDFFont = font, color = ink) => p.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y, size, font: f, color });

  if (d.draft) {
    page.drawText('ENTWURF', { x: 150, y: 380, size: 96, font: bold, color: rgb(0.93, 0.93, 0.95), rotate: degrees(30) });
  }

  // Kopf
  text(page, 'Matchunt', 60, 780, 20, bold);
  text(page, ISSUER.brand, 60, 764, 8, font, muted);
  text(page, `${ISSUER.name} · ${ISSUER.street} · ${ISSUER.city}`, 60, 712, 7, font, muted);
  let y = 696;
  for (const l of [d.recipient.name, d.recipient.street, d.recipient.city].filter(Boolean) as string[]) { text(page, l, 60, y, 10); y -= 14; }

  // Rechnungsdaten rechts
  const title = d.kind === 'cancellation' ? 'Stornorechnung' : 'Rechnung';
  right(page, title, 535, 712, 18, bold);
  const meta: [string, string][] = [
    [`${title}snummer`, d.number ?? 'wird bei Freigabe vergeben'],
    ['Rechnungsdatum', day(d.issuedOn)],
    ...(d.serviceOn ? [['Leistungsdatum', day(d.serviceOn)] as [string, string]] : []),
    ...(d.dueOn && d.kind === 'invoice' ? [['Zahlbar bis', day(d.dueOn)] as [string, string]] : []),
    ...(d.recipient.vatId ? [['Ihre USt-IdNr.', d.recipient.vatId] as [string, string]] : []),
    ...(d.reference ? [['Auftrag', d.reference] as [string, string]] : []),
    ...(d.correctsNumber ? [['Storniert Rechnung', d.correctsNumber] as [string, string]] : []),
  ];
  let my = 690;
  for (const [k, v] of meta) { text(page, k, 345, my, 9, font, muted); right(page, v, 535, my, 9); my -= 14; }

  // Positionen
  y = 560;
  text(page, 'Leistung', 60, y, 9, bold, muted); right(page, 'Betrag', 535, y, 9, bold, muted);
  page.drawLine({ start: { x: 60, y: y - 6 }, end: { x: 535, y: y - 6 }, thickness: 0.5, color: muted });
  y -= 24;
  for (const l of d.lines) {
    text(page, l.title, 60, y, 10, bold); right(page, eur(l.amountCents), 535, y, 10);
    y -= 15;
    for (const det of l.details) { text(page, det, 60, y, 9, font, muted); y -= 13; }
    y -= 8;
  }
  page.drawLine({ start: { x: 300, y }, end: { x: 535, y }, thickness: 0.5, color: muted });
  y -= 18;
  text(page, 'Nettobetrag', 300, y, 10); right(page, eur(d.netCents), 535, y, 10); y -= 16;
  if (d.reverseCharge) {
    text(page, 'Umsatzsteuer', 300, y, 10); right(page, eur(0), 535, y, 10); y -= 16;
  } else {
    text(page, `Umsatzsteuer ${d.vatRate} %`, 300, y, 10); right(page, eur(d.vatCents), 535, y, 10); y -= 16;
  }
  text(page, 'Gesamtbetrag', 300, y, 11, bold); right(page, eur(d.totalCents), 535, y, 11, bold);
  y -= 34;

  const note = (s: string) => { text(page, s, 60, y, 9, font, ink); y -= 13; };
  if (d.reverseCharge) note('Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, § 13b UStG).');
  if (d.kind === 'invoice') {
    note(`Bitte überweisen Sie den Gesamtbetrag ohne Abzug bis ${day(d.dueOn)}.`);
    note(`Verwendungszweck: ${d.number ?? 'Rechnungsnummer'}`);
    y -= 6;
    note(`Kontoinhaber: ${BANK.holder || '–'}`);
    note(`IBAN: ${BANK.iban || '–'}${BANK.bic ? ` · BIC: ${BANK.bic}` : ''}${BANK.bank ? ` · ${BANK.bank}` : ''}`);
  } else {
    note('Der Betrag wird mit offenen Forderungen verrechnet oder erstattet.');
  }

  // Fuß
  const foot = [`${ISSUER.name} · ${ISSUER.street} · ${ISSUER.city} · ${ISSUER.email} · Tel. ${ISSUER.phone}`,
    `Geschäftsführer: ${ISSUER.managingDirector} · ${ISSUER.register} · USt-IdNr. ${ISSUER.vatId}`];
  text(page, foot[0], 60, 60, 7, font, muted);
  text(page, foot[1], 60, 50, 7, font, muted);
  return await pdf.save();
}
