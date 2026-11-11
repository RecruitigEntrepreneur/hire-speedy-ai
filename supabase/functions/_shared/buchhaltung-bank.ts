// Kontoauszug lesen und Zahlungen zuordnen (A6, Umbau 11.11.2026).
//
// Reine Funktionen ohne Importe: laufen in der Edge Function (Deno) und in den
// Tests der Web-App (vitest, src/lib/buchhaltungBank.test.ts).
//
//   parseStatement   CAMT.053 (XML, alle gängigen Fassungen .001.02–.001.08)
//                    oder CSV aus dem Online-Banking (Sparkasse, Volksbank,
//                    Deutsche Bank, Postbank, Commerzbank, ING, DKB, Qonto …):
//                    Trennzeichen, Kopfzeile, deutsches Zahlenformat, Soll/Haben.
//   fingerprintKey   gleiche Buchung = gleicher Schlüssel (kein Doppelimport)
//   suggestFor       Vorschlag je Buchung: Rechnungsnummer im Verwendungszweck +
//                    Betrag, Teilzahlung, Auszahlung einer Gutschrift („GS-…“).
//                    Gebucht wird nie von selbst.

export interface BankRow {
  bookedOn: string; // YYYY-MM-DD
  amountCents: number; // + Eingang, − Ausgang
  counterparty: string | null;
  counterpartyIban: string | null;
  purpose: string | null;
  /** Referenz der Bank (nur zur Anzeige, nicht im Schlüssel) */
  reference: string | null;
  currency: string;
}

export interface ParsedStatement {
  format: 'camt053' | 'csv';
  rows: BankRow[];
  periodFrom: string | null;
  periodTo: string | null;
  /** Zeilen, die nicht gelesen werden konnten (z. B. Summenzeilen) */
  skipped: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Zahlen und Datum
// ---------------------------------------------------------------------------

/** „1.234,56“, „-2.400,00“, „45160.50“, „1.234,56-“, „+20.000,00 €“ → Cent. */
export function parseAmountDe(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[\s  ]/g, '').replace(/€|EUR/gi, '').replace(/−/g, '-');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);
  s = s.replace(/'/g, '');
  if (!/^\d[\d.,]*$/.test(s) && !/^[.,]\d+$/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  let dec: ',' | '.' | null = null;
  if (lastComma >= 0 && lastDot >= 0) dec = lastComma > lastDot ? ',' : '.';
  else if (lastComma >= 0) {
    const tail = s.length - lastComma - 1;
    const many = s.indexOf(',') !== lastComma;
    dec = !many && tail > 0 && tail !== 3 ? ',' : null;
    if (!many && tail === 3) dec = null; // „1,234“ = 1234 (Tausender)
  } else if (lastDot >= 0) {
    const tail = s.length - lastDot - 1;
    const many = s.indexOf('.') !== lastDot;
    dec = !many && tail > 0 && tail !== 3 ? '.' : null;
  }
  let intPart = s;
  let frac = '';
  if (dec) {
    const at = s.lastIndexOf(dec);
    intPart = s.slice(0, at);
    frac = s.slice(at + 1);
  }
  intPart = intPart.replace(/[.,]/g, '');
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(frac)) return null;
  const whole = intPart ? Number(intPart) : 0;
  let cents = 0;
  if (frac) {
    const f = (frac + '00').slice(0, 3);
    cents = Number(f.slice(0, 2)) + (Number(f[2]) >= 5 && frac.length > 2 ? 1 : 0);
  }
  const value = whole * 100 + cents;
  if (!Number.isFinite(value)) return null;
  return neg ? -value : value;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
function validDate(y: number, m: number, d: number): string | null {
  if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/** „03.11.2026“, „03.11.26“, „2026-11-03“, „2026-11-03T10:00:00“, „03/11/2026“ → 2026-11-03. */
export function parseDateDe(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return validDate(y, Number(m[2]), Number(m[1]));
  }
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(s);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return validDate(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (m) return validDate(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

const clean = (s: string | null | undefined): string | null => {
  const v = String(s ?? '').replace(/\s+/g, ' ').trim();
  return v || null;
};
const cleanIban = (s: string | null | undefined): string | null => {
  const v = String(s ?? '').replace(/\s+/g, '').toUpperCase();
  return /^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(v) ? v : null;
};

function period(rows: BankRow[]) {
  const dates = rows.map((r) => r.bookedOn).sort();
  return { periodFrom: dates[0] ?? null, periodTo: dates[dates.length - 1] ?? null };
}

// ---------------------------------------------------------------------------
// Format erkennen
// ---------------------------------------------------------------------------

export function detectFormat(text: string, fileName?: string | null): 'camt053' | 'csv' | null {
  const head = text.replace(/^﻿/, '').trimStart().slice(0, 2000);
  if (/^<\?xml|<Document[\s>]|<BkToCstmrStmt/i.test(head) || /camt\.05[23]/i.test(head)) return 'camt053';
  if (fileName && /\.xml$/i.test(fileName)) return 'camt053';
  if (/[;,\t]/.test(head)) return 'csv';
  return null;
}

export function parseStatement(text: string, fileName?: string | null): ParsedStatement {
  const fmt = detectFormat(text, fileName);
  if (fmt === 'camt053') return parseCamt053(text);
  if (fmt === 'csv') return parseBankCsv(text);
  throw new Error('Die Datei ist weder ein CAMT.053-Auszug (XML) noch eine CSV-Datei aus dem Online-Banking.');
}

// ---------------------------------------------------------------------------
// CAMT.053 (XML) ohne XML-Bibliothek: Blöcke je Buchung (Ntry) und Einzelumsatz (TxDtls)
// ---------------------------------------------------------------------------

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** Alle Blöcke <tag …>…</tag> (nicht verschachtelt gleichnamig). */
function blocks(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}
function first(xml: string | null | undefined, tag: string): string | null {
  if (!xml) return null;
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`);
  const m = re.exec(xml);
  return m ? m[1] : null;
}
function firstWithAttr(xml: string, tag: string): { body: string; attrs: string } | null {
  const re = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`);
  const m = re.exec(xml);
  return m ? { attrs: m[1] ?? '', body: m[2] } : null;
}
const textOf = (xml: string | null | undefined) => (xml == null ? null : clean(decodeXml(xml.replace(/<[^>]+>/g, ' '))));
const path = (xml: string | null | undefined, ...tags: string[]) => {
  let cur: string | null | undefined = xml;
  for (const t of tags) { cur = first(cur, t); if (cur == null) return null; }
  return cur;
};

function camtAmount(xml: string): { cents: number; ccy: string } | null {
  const a = firstWithAttr(xml, 'Amt');
  if (!a) return null;
  const v = Number(decodeXml(a.body).trim());
  if (!Number.isFinite(v)) return null;
  const ccy = /Ccy\s*=\s*"([A-Z]{3})"/.exec(a.attrs)?.[1] ?? 'EUR';
  return { cents: Math.round(v * 100), ccy };
}

function partyName(party: string | null): string | null {
  if (!party) return null;
  return textOf(path(party, 'Pty', 'Nm') ?? first(party, 'Nm'));
}

export function parseCamt053(input: string): ParsedStatement {
  const xml = input.replace(/^﻿/, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1');
  if (!/<BkToCstmrStmt[\s>]/.test(xml) && !/<Ntry[\s>]/.test(xml)) {
    throw new Error('In der XML-Datei steht kein Kontoauszug (CAMT.053).');
  }
  const rows: BankRow[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let from: string | null = null;
  let to: string | null = null;
  const stmts = blocks(xml, 'Stmt');
  for (const stmt of stmts.length ? stmts : [xml]) {
    const fr = parseDateDe(textOf(path(stmt, 'FrToDt', 'FrDtTm')) ?? '');
    const tt = parseDateDe(textOf(path(stmt, 'FrToDt', 'ToDtTm')) ?? '');
    if (fr && (!from || fr < from)) from = fr;
    if (tt && (!to || tt > to)) to = tt;
    for (const ntry of blocks(stmt, 'Ntry')) {
      const cut = ntry.indexOf('<NtryDtls');
      const head = cut >= 0 ? ntry.slice(0, cut) : ntry;
      const status = (textOf(first(head, 'Sts')) ?? 'BOOK').toUpperCase();
      if (status !== 'BOOK') { skipped += 1; continue; }
      const amt = camtAmount(head);
      const dir = (textOf(first(head, 'CdtDbtInd')) ?? 'CRDT').toUpperCase();
      const booked = parseDateDe(textOf(path(head, 'BookgDt', 'Dt')) ?? textOf(path(head, 'BookgDt', 'DtTm')) ?? textOf(path(head, 'ValDt', 'Dt')) ?? '');
      if (!amt || !booked) { skipped += 1; continue; }
      const entryRef = textOf(first(head, 'AcctSvcrRef'));
      const entryInfo = textOf(first(ntry, 'AddtlNtryInf'));
      const txs = blocks(ntry, 'TxDtls');
      const list = txs.length ? txs : [''];
      list.forEach((tx, i) => {
        let cents = amt.cents;
        let ccy = amt.ccy;
        let txDir = dir;
        if (tx && list.length > 1) {
          // Sammelbuchung: Betrag je Einzelumsatz
          const own = camtAmount(tx.replace(/<AmtDtls>[\s\S]*?<\/AmtDtls>/, '')) ?? camtAmount(path(tx, 'AmtDtls', 'TxAmt') ?? '') ?? camtAmount(path(tx, 'AmtDtls', 'InstdAmt') ?? '');
          if (own) { cents = own.cents; ccy = own.ccy; }
          txDir = (textOf(first(tx, 'CdtDbtInd')) ?? dir).toUpperCase();
        }
        const incoming = txDir !== 'DBIT';
        const parties = first(tx, 'RltdPties');
        const other = incoming ? first(parties, 'Dbtr') ?? first(parties, 'UltmtDbtr') : first(parties, 'Cdtr') ?? first(parties, 'UltmtCdtr');
        const otherAcct = incoming ? first(parties, 'DbtrAcct') : first(parties, 'CdtrAcct');
        const ustrd = blocks(tx, 'Ustrd').map((u) => textOf(u)).filter(Boolean) as string[];
        const strdRef = textOf(path(tx, 'Strd', 'CdtrRefInf', 'Ref'));
        const e2e = textOf(path(tx, 'Refs', 'EndToEndId'));
        const purpose = clean([...ustrd, strdRef, e2e && e2e !== 'NOTPROVIDED' && !ustrd.some((u) => u.includes(e2e)) ? e2e : null, !ustrd.length ? entryInfo : null].filter(Boolean).join(' '));
        if (ccy !== 'EUR') { warnings.push(`Buchung vom ${booked} in ${ccy} übersprungen.`); skipped += 1; return; }
        rows.push({
          bookedOn: booked,
          amountCents: incoming ? Math.abs(cents) : -Math.abs(cents),
          counterparty: partyName(other),
          counterpartyIban: cleanIban(textOf(path(otherAcct, 'Id', 'IBAN'))),
          purpose,
          reference: textOf(path(tx, 'Refs', 'AcctSvcrRef')) ?? (e2e && e2e !== 'NOTPROVIDED' ? e2e : null) ?? (entryRef ? (list.length > 1 ? `${entryRef}/${i + 1}` : entryRef) : null),
          currency: 'EUR',
        });
      });
    }
  }
  const p = period(rows);
  return { format: 'camt053', rows, periodFrom: from ?? p.periodFrom, periodTo: to ?? p.periodTo, skipped, warnings };
}

// ---------------------------------------------------------------------------
// CSV aus dem Online-Banking
// ---------------------------------------------------------------------------

/** CSV in Zeilen und Felder (Anführungszeichen, "" als Escape, Zeilenumbrüche in Feldern). */
export function splitCsv(text: string, delim: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const s = text.replace(/^﻿/, '');
  while (i < s.length) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
        quoted = false; i += 1; continue;
      }
      field += ch; i += 1; continue;
    }
    if (ch === '"' && field.trim() === '') { quoted = true; field = ''; i += 1; continue; }
    if (ch === delim) { row.push(field); field = ''; i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    if (ch === '\n') { row.push(field); out.push(row); row = []; field = ''; i += 1; continue; }
    field += ch; i += 1;
  }
  if (field !== '' || row.length) { row.push(field); out.push(row); }
  return out.filter((r) => r.some((f) => f.trim() !== ''));
}

const norm = (h: string) => h.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]/g, '');

const DATE_COLS = ['buchungstag', 'buchungsdatum', 'buchung', 'datum', 'bookingdate', 'settlementdateutc', 'settlementdate', 'datumdesvorgangsutc', 'date', 'transactiondate', 'valutadatum', 'valuta', 'wertstellung', 'wert'];
const AMOUNT_COLS = ['betrag', 'betrageur', 'betragineur', 'umsatz', 'umsatzineur', 'amount', 'betragineur'];
const COUNTER_COLS = ['beguenstigterzahlungspflichtiger', 'beguenstigterauftraggeber', 'auftraggeberempfaenger', 'empfaengerauftraggeber', 'namezahlungsbeteiligter', 'zahlungsbeteiligter', 'gegenpartei', 'counterpartyname', 'counterparty', 'nameempfaengerauftraggeber', 'empfaenger', 'auftraggeber', 'name'];
const IBAN_COLS = ['kontonummeriban', 'ibankontonummer', 'ibanzahlungsbeteiligter', 'gegenkontoiban', 'counterpartyiban', 'iban', 'kontonummer'];
const PURPOSE_COLS = ['verwendungszweck', 'reference', 'referenz', 'description', 'beschreibung', 'buchungstext'];
const REF_COLS = ['kundenreferenzendtoend', 'kundenreferenz', 'endtoendid', 'endtoendreferenz'];
const CCY_COLS = ['waehrung', 'currency'];

interface CsvMap {
  date: number; amount: number; soll: number; haben: number; sh: number;
  counter: number; payer: number; payee: number; iban: number; purpose: number; text: number; ref: number; ccy: number;
}

function pick(headers: string[], names: string[], exclude: (h: string) => boolean = () => false): number {
  for (const n of names) {
    const i = headers.findIndex((h) => h === n && !exclude(h));
    if (i >= 0) return i;
  }
  return -1;
}

function mapHeader(raw: string[]): CsvMap | null {
  const h = raw.map(norm);
  const own = (x: string) => x.includes('auftragskonto') || x === 'konto' || x === 'kontonummerauftragskonto';
  const date = pick(h, DATE_COLS);
  let amount = pick(h, AMOUNT_COLS);
  if (amount < 0) amount = h.findIndex((x) => x.startsWith('betrag') && !x.includes('ursprung') && !x.includes('saldo'));
  const soll = h.findIndex((x) => x === 'soll' || x === 'sollbetrag' || x === 'ausgang' || x === 'debit');
  const haben = h.findIndex((x) => x === 'haben' || x === 'habenbetrag' || x === 'eingang' || x === 'credit');
  const sh = h.findIndex((x) => x === 'sollhaben' || x === 'sh' || x === 'soll/haben' || x === 'kennzeichen');
  if (date < 0 || (amount < 0 && soll < 0 && haben < 0)) return null;
  const purpose = pick(h, PURPOSE_COLS.slice(0, -1));
  const text = h.findIndex((x) => x === 'buchungstext' || x === 'umsatzart');
  return {
    date, amount, soll, haben, sh,
    counter: pick(h, COUNTER_COLS, own),
    payer: h.findIndex((x) => x === 'zahlungspflichtiger' || x === 'zahlungspflichtigerin' || x === 'auftraggeberzahlungspflichtiger'),
    payee: h.findIndex((x) => x === 'zahlungsempfaenger' || x === 'zahlungsempfaengerin'),
    iban: (() => { for (const n of IBAN_COLS) { const i = h.findIndex((x) => x === n && !own(x)); if (i >= 0) return i; } return h.findIndex((x) => x.startsWith('iban') && !own(x)); })(),
    purpose: purpose >= 0 ? purpose : text,
    text: purpose >= 0 ? text : -1,
    ref: pick(h, REF_COLS),
    ccy: pick(h, CCY_COLS),
  };
}

function detectDelimiter(lines: string[]): string {
  let best = ';';
  let bestScore = -1;
  for (const d of [';', '\t', ',', '|']) {
    // Felder außerhalb von Anführungszeichen zählen
    let score = 0;
    for (const l of lines.slice(0, 40)) {
      let q = false;
      let n = 0;
      for (const ch of l) { if (ch === '"') q = !q; else if (ch === d && !q) n += 1; }
      if (n >= 2) score += n;
    }
    if (score > bestScore) { best = d; bestScore = score; }
  }
  return best;
}

export function parseBankCsv(text: string): ParsedStatement {
  const body = text.replace(/^﻿/, '');
  const lines = body.split(/\r?\n/);
  const tried = [detectDelimiter(lines), ';', ',', '\t'];
  for (const delim of [...new Set(tried)]) {
    const recs = splitCsv(body, delim);
    const headerAt = recs.slice(0, 40).findIndex((r) => r.length >= 3 && mapHeader(r));
    if (headerAt < 0) continue;
    const map = mapHeader(recs[headerAt])!;
    const rows: BankRow[] = [];
    const warnings: string[] = [];
    let skipped = 0;
    for (const r of recs.slice(headerAt + 1)) {
      const get = (i: number) => (i >= 0 && i < r.length ? r[i] : '');
      const date = parseDateDe(get(map.date));
      let cents: number | null = null;
      if (map.amount >= 0 && get(map.amount).trim() !== '') cents = parseAmountDe(get(map.amount));
      if (cents == null && (map.soll >= 0 || map.haben >= 0)) {
        const s = parseAmountDe(get(map.soll));
        const h = parseAmountDe(get(map.haben));
        if (s != null || h != null) cents = (h != null ? Math.abs(h) : 0) - (s != null ? Math.abs(s) : 0);
      }
      if (cents != null && map.sh >= 0) {
        const ind = get(map.sh).trim().toUpperCase();
        if (ind === 'S' || ind === 'D' || ind === 'DEBIT') cents = -Math.abs(cents);
        if (ind === 'H' || ind === 'C' || ind === 'CREDIT') cents = Math.abs(cents);
      }
      if (!date || cents == null || cents === 0) { skipped += 1; continue; }
      const ccy = (get(map.ccy).trim() || 'EUR').toUpperCase();
      if (ccy !== 'EUR' && ccy !== '€') { warnings.push(`Buchung vom ${date} in ${ccy} übersprungen.`); skipped += 1; continue; }
      let counter = clean(get(map.counter));
      if (!counter) counter = clean(cents > 0 ? get(map.payer) : get(map.payee)) ?? clean(get(map.payer)) ?? clean(get(map.payee));
      const purpose = clean([get(map.purpose), map.text >= 0 && !get(map.purpose).trim() ? get(map.text) : ''].filter(Boolean).join(' '));
      rows.push({
        bookedOn: date,
        amountCents: cents,
        counterparty: counter,
        counterpartyIban: cleanIban(get(map.iban)),
        purpose,
        reference: clean(get(map.ref)),
        currency: 'EUR',
      });
    }
    if (!rows.length && skipped === 0) continue;
    return { format: 'csv', rows, ...period(rows), skipped, warnings };
  }
  throw new Error('In der CSV-Datei fehlt eine Kopfzeile mit Buchungstag und Betrag.');
}

// ---------------------------------------------------------------------------
// Schlüssel gegen Doppelimport
// ---------------------------------------------------------------------------

const compact = (s: string | null | undefined) => String(s ?? '').toUpperCase()
  .replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS')
  .replace(/[^A-Z0-9]/g, '');

/**
 * Gleiche Buchung, gleicher Schlüssel – auch wenn derselbe Zeitraum zweimal
 * hochgeladen wird. occurrence trennt echte gleiche Buchungen am selben Tag.
 */
export function fingerprintKey(row: BankRow, occurrence = 0): string {
  return [row.bookedOn, row.amountCents, compact(row.counterparty).slice(0, 40), compact(row.counterpartyIban), compact(row.purpose).slice(0, 140), occurrence].join('|');
}

/** Schlüssel für alle Zeilen einer Datei (gleiche Zeilen bekommen 0, 1, 2 …). */
export function fingerprintKeys(rows: BankRow[]): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = fingerprintKey(r, 0);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : fingerprintKey(r, n);
  });
}

// ---------------------------------------------------------------------------
// Vorschläge (A6)
// ---------------------------------------------------------------------------

export interface OpenInvoiceRef {
  id: string;
  number: string;
  openCents: number;
  totalCents: number;
  recipientName: string | null;
  candidateName?: string | null;
}
export interface OpenCreditNoteRef {
  id: string;
  number: string;
  totalCents: number;
  recruiterName: string | null;
}
export interface CreditRunRef {
  id: string;
  period: string;
  /** Kennungen der SEPA-Datei (MsgId, PmtInfId) */
  refs: string[];
  openTotalCents: number;
  openCount: number;
}

export interface Suggestion {
  kind: 'invoice' | 'credit_note' | 'credit_run' | 'none';
  targetId: string | null;
  /** z. B. „RE-2026-0142 · Cem Aydın“ */
  label: string;
  /** z. B. „Nummer und Betrag stimmen“ */
  detail: string;
  /** sicher = darf mit „sichere Vorschläge buchen“ gebucht werden */
  safe: boolean;
  /** Rest nach dieser Zahlung (Teilzahlung) */
  remainingCents?: number;
}

const euroDe = (c: number) => `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(c / 100)} €`;

function nameMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const stop = new Set(['GMBH', 'AG', 'KG', 'UG', 'SE', 'MBH', 'CO', 'UND', 'THE', 'LTD', 'GBR', 'OHG', 'EV', 'HAFTUNGSBESCHRAENKT']);
  const words = (s: string | null | undefined) => new Set(String(s ?? '').toUpperCase().replace(/Ä/g, 'AE').replace(/Ö/g, 'OE').replace(/Ü/g, 'UE').replace(/ß/g, 'SS').split(/[^A-Z0-9]+/).filter((w) => w.length >= 3 && !stop.has(w)));
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return false;
  for (const w of wa) if (wb.has(w)) return true;
  return false;
}

function containsNumber(haystack: string, n: string): boolean {
  let at = haystack.indexOf(n);
  while (at >= 0) {
    const next = haystack[at + n.length];
    // „RE20260014“ steckt nicht in „RE202600142“
    if (!(next && /\d/.test(next) && /\d$/.test(n))) return true;
    at = haystack.indexOf(n, at + 1);
  }
  return false;
}

function numberHit(purpose: string | null, number: string): 'full' | 'tail' | null {
  const p = compact(purpose);
  const n = compact(number);
  if (n.length >= 4 && containsNumber(p, n)) return 'full';
  const groups = String(number).match(/\d+/g) ?? [];
  const tail = groups[groups.length - 1];
  if (!tail || tail.length < 3) return null;
  const pg = String(purpose ?? '').match(/\d+/g) ?? [];
  const want = Number(tail);
  if (tail.length >= 3 && pg.some((g) => g.length >= 3 && Number(g) === want && (g.length === tail.length || g.replace(/^0+/, '') === tail.replace(/^0+/, '')))) return 'tail';
  return null;
}

export function suggestFor(
  tx: { amountCents: number; purpose: string | null; counterparty: string | null },
  invoices: OpenInvoiceRef[],
  notes: OpenCreditNoteRef[] = [],
  runs: CreditRunRef[] = [],
): Suggestion {
  if (tx.amountCents < 0) {
    const out = -tx.amountCents;
    for (const n of notes) {
      if (numberHit(tx.purpose, n.number) === 'full') {
        const ok = out === n.totalCents;
        return { kind: 'credit_note', targetId: n.id, label: `${n.number}${n.recruiterName ? ` · ${n.recruiterName}` : ''}`, detail: ok ? 'Auszahlung der Gutschrift, Betrag stimmt' : `Betrag weicht ab (Gutschrift ${euroDe(n.totalCents)})`, safe: ok };
      }
    }
    for (const r of runs) {
      const p = compact(tx.purpose);
      if (r.refs.some((x) => x && p.includes(compact(x)))) {
        const ok = out === r.openTotalCents;
        return { kind: 'credit_run', targetId: r.id, label: `Gutschriftlauf ${r.period} · ${r.openCount} Gutschriften`, detail: ok ? 'Sammelüberweisung, Summe stimmt' : `Summe weicht ab (offen ${euroDe(r.openTotalCents)})`, safe: ok };
      }
    }
    return { kind: 'none', targetId: null, label: 'kein Matchunt-Beleg', detail: '', safe: false };
  }

  const hits = invoices.map((i) => ({ i, hit: numberHit(tx.purpose, i.number) })).filter((x) => x.hit);
  const full = hits.filter((x) => x.hit === 'full');
  const candidates = full.length ? full : hits;
  if (candidates.length === 1) {
    const { i, hit } = candidates[0];
    const label = `${i.number}${i.candidateName ? ` · ${i.candidateName}` : ''}`;
    const sure = hit === 'full' || nameMatches(tx.counterparty, i.recipientName);
    if (tx.amountCents === i.openCents) return { kind: 'invoice', targetId: i.id, label, detail: 'Nummer und Betrag stimmen', safe: sure, remainingCents: 0 };
    if (tx.amountCents < i.openCents) return { kind: 'invoice', targetId: i.id, label, detail: `Teilzahlung, ${euroDe(i.openCents - tx.amountCents)} bleiben offen`, safe: sure, remainingCents: i.openCents - tx.amountCents };
    return { kind: 'invoice', targetId: i.id, label, detail: `Betrag höher als offen (${euroDe(i.openCents)})`, safe: false, remainingCents: 0 };
  }
  if (candidates.length > 1) {
    const exact = candidates.filter((x) => x.i.openCents === tx.amountCents);
    if (exact.length === 1) {
      const i = exact[0].i;
      return { kind: 'invoice', targetId: i.id, label: `${i.number}${i.candidateName ? ` · ${i.candidateName}` : ''}`, detail: 'Betrag stimmt, Nummer nicht eindeutig', safe: false, remainingCents: 0 };
    }
    return { kind: 'none', targetId: null, label: 'mehrere Rechnungen möglich', detail: candidates.map((x) => x.i.number).join(', '), safe: false };
  }
  // Ohne Nummer: Betrag und Name
  const byAmount = invoices.filter((i) => i.openCents === tx.amountCents && nameMatches(tx.counterparty, i.recipientName));
  if (byAmount.length === 1) {
    const i = byAmount[0];
    return { kind: 'invoice', targetId: i.id, label: `${i.number}${i.candidateName ? ` · ${i.candidateName}` : ''}`, detail: 'Betrag und Name stimmen, Nummer fehlt', safe: false, remainingCents: 0 };
  }
  return { kind: 'none', targetId: null, label: 'kein Vorschlag', detail: '', safe: false };
}
