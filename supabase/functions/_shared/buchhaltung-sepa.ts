// SEPA-Sammelüberweisung für den Gutschriftlauf (A7, Umbau 11.11.2026).
// pain.001.001.09 (ISO 20022, DK-Anlage 3 ab Version 3.7). Reine Funktionen
// ohne Importe; getestet in src/lib/buchhaltungSepa.test.ts.

export interface SepaParty {
  name: string;
  iban: string;
  bic?: string | null;
}

export interface SepaPayment extends SepaParty {
  /** Ende-zu-Ende-Referenz, hier die Gutschriftnummer (erscheint im Auszug) */
  endToEndId: string;
  amountCents: number;
  /** Verwendungszweck (unstrukturiert, max. 140 Zeichen) */
  remittance: string;
}

export interface Pain001Input {
  msgId: string;
  paymentInfoId: string;
  /** Zeitpunkt der Erstellung (ISO) */
  createdAt: string;
  /** gewünschtes Ausführungsdatum YYYY-MM-DD */
  executionDate: string;
  debtor: SepaParty;
  payments: SepaPayment[];
  batchBooking?: boolean;
}

/** IBAN-Prüfziffer (Modulo 97). */
export function ibanValid(raw: string | null | undefined): boolean {
  const iban = String(raw ?? '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('DE') && iban.length !== 22) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

export const bicValid = (raw: string | null | undefined) => /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(raw ?? '').replace(/\s+/g, '').toUpperCase());

/** „DE89 •••• 3000“ */
export function maskIban(raw: string | null | undefined): string | null {
  const iban = String(raw ?? '').replace(/\s+/g, '').toUpperCase();
  if (iban.length < 8) return null;
  return `${iban.slice(0, 4)} •••• ${iban.slice(-4)}`;
}

/** Zeichensatz der Deutschen Kreditwirtschaft: Umlaute umschreiben, Unerlaubtes durch Leerzeichen. */
export function sepaText(raw: string | null | undefined, max: number): string {
  const s = String(raw ?? '')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/đ/g, 'd').replace(/ø/g, 'o').replace(/Ø/g, 'O')
    .replace(/[„“”"]/g, '').replace(/[‚‘’`´]/g, "'").replace(/[–—]/g, '-')
    .replace(/[^A-Za-z0-9/\-?:().,'+& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.slice(0, max).trim();
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const amount = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
const id35 = (s: string) => sepaText(s, 35).replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, '').replace(/\s+/g, '-');

function agent(bic: string | null | undefined, indent: string): string {
  const b = String(bic ?? '').replace(/\s+/g, '').toUpperCase();
  return bicValid(b)
    ? `${indent}<FinInstnId><BICFI>${b}</BICFI></FinInstnId>`
    : `${indent}<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>`;
}

/** Datei für das Online-Banking (Sammelüberweisung). Wirft bei ungültigen Angaben. */
export function buildPain001(input: Pain001Input): string {
  const debtorIban = input.debtor.iban.replace(/\s+/g, '').toUpperCase();
  if (!sepaText(input.debtor.name, 70)) throw new Error('Kontoinhaber von Matchunt fehlt.');
  if (!ibanValid(debtorIban)) throw new Error('Die IBAN von Matchunt ist ungültig.');
  if (!input.payments.length) throw new Error('Keine Überweisung in der Datei.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.executionDate)) throw new Error('Ausführungsdatum fehlt.');
  for (const p of input.payments) {
    if (!(Number.isInteger(p.amountCents) && p.amountCents > 0)) throw new Error(`Betrag für ${p.endToEndId} ist ungültig.`);
    if (!ibanValid(p.iban)) throw new Error(`IBAN für ${p.endToEndId} ist ungültig.`);
    if (!sepaText(p.name, 70)) throw new Error(`Empfänger für ${p.endToEndId} fehlt.`);
  }
  const total = input.payments.reduce((a, p) => a + p.amountCents, 0);
  const created = input.createdAt.slice(0, 19);
  const tx = input.payments.map((p) => {
    const bic = String(p.bic ?? '').replace(/\s+/g, '').toUpperCase();
    return [
      '      <CdtTrfTxInf>',
      `        <PmtId><EndToEndId>${xml(id35(p.endToEndId))}</EndToEndId></PmtId>`,
      `        <Amt><InstdAmt Ccy="EUR">${amount(p.amountCents)}</InstdAmt></Amt>`,
      ...(bicValid(bic) ? [`        <CdtrAgt><FinInstnId><BICFI>${bic}</BICFI></FinInstnId></CdtrAgt>`] : []),
      `        <Cdtr><Nm>${xml(sepaText(p.name, 70))}</Nm></Cdtr>`,
      `        <CdtrAcct><Id><IBAN>${p.iban.replace(/\s+/g, '').toUpperCase()}</IBAN></Id></CdtrAcct>`,
      `        <RmtInf><Ustrd>${xml(sepaText(p.remittance, 140))}</Ustrd></RmtInf>`,
      '      </CdtTrfTxInf>',
    ].join('\n');
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09 pain.001.001.09.xsd">',
    '  <CstmrCdtTrfInitn>',
    '    <GrpHdr>',
    `      <MsgId>${xml(id35(input.msgId))}</MsgId>`,
    `      <CreDtTm>${created}</CreDtTm>`,
    `      <NbOfTxs>${input.payments.length}</NbOfTxs>`,
    `      <CtrlSum>${amount(total)}</CtrlSum>`,
    `      <InitgPty><Nm>${xml(sepaText(input.debtor.name, 70))}</Nm></InitgPty>`,
    '    </GrpHdr>',
    '    <PmtInf>',
    `      <PmtInfId>${xml(id35(input.paymentInfoId))}</PmtInfId>`,
    '      <PmtMtd>TRF</PmtMtd>',
    `      <BtchBookg>${input.batchBooking === false ? 'false' : 'true'}</BtchBookg>`,
    `      <NbOfTxs>${input.payments.length}</NbOfTxs>`,
    `      <CtrlSum>${amount(total)}</CtrlSum>`,
    '      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>',
    `      <ReqdExctnDt><Dt>${input.executionDate}</Dt></ReqdExctnDt>`,
    `      <Dbtr><Nm>${xml(sepaText(input.debtor.name, 70))}</Nm></Dbtr>`,
    `      <DbtrAcct><Id><IBAN>${debtorIban}</IBAN></Id></DbtrAcct>`,
    `      <DbtrAgt>${agent(input.debtor.bic, '').trim()}</DbtrAgt>`,
    '      <ChrgBr>SLEV</ChrgBr>',
    ...tx,
    '    </PmtInf>',
    '  </CstmrCdtTrfInitn>',
    '</Document>',
    '',
  ].join('\n');
}
