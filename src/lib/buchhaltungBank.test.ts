import { describe, expect, it } from 'vitest';
import {
  detectFormat, fingerprintKeys, parseAmountDe, parseBankCsv, parseCamt053, parseDateDe, parseStatement, suggestFor,
} from '../../supabase/functions/_shared/buchhaltung-bank';

describe('Beträge und Datum', () => {
  it('liest deutsche und englische Zahlen', () => {
    expect(parseAmountDe('1.234,56')).toBe(123456);
    expect(parseAmountDe('-2.400,00')).toBe(-240000);
    expect(parseAmountDe('+45.160,50 €')).toBe(4516050);
    expect(parseAmountDe('45160.50')).toBe(4516050);
    expect(parseAmountDe('1,234.56')).toBe(123456);
    expect(parseAmountDe('20000')).toBe(2000000);
    expect(parseAmountDe('2.400')).toBe(240000);
    expect(parseAmountDe('1.234,56-')).toBe(-123456);
    expect(parseAmountDe('−15,5')).toBe(-1550);
    expect(parseAmountDe('0,99')).toBe(99);
    expect(parseAmountDe('EUR 1 234,56')).toBe(123456);
    expect(parseAmountDe('')).toBeNull();
    expect(parseAmountDe('Kontostand')).toBeNull();
  });
  it('liest Datumsformate', () => {
    expect(parseDateDe('03.11.2026')).toBe('2026-11-03');
    expect(parseDateDe('3.11.26')).toBe('2026-11-03');
    expect(parseDateDe('2026-11-03T10:15:00+01:00')).toBe('2026-11-03');
    expect(parseDateDe('03/11/2026')).toBe('2026-11-03');
    expect(parseDateDe('31.02.2026')).toBeNull();
    expect(parseDateDe('Buchungstag')).toBeNull();
  });
});

const CAMT_08 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
 <BkToCstmrStmt>
  <GrpHdr><MsgId>1</MsgId><CreDtTm>2026-11-11T08:00:00</CreDtTm></GrpHdr>
  <Stmt>
   <Id>1</Id>
   <FrToDt><FrDtTm>2026-10-28T00:00:00</FrDtTm><ToDtTm>2026-11-11T23:59:59</ToDtTm></FrToDt>
   <Acct><Id><IBAN>DE02120300000000202051</IBAN></Id></Acct>
   <Ntry>
    <NtryRef>1</NtryRef>
    <Amt Ccy="EUR">45160.50</Amt>
    <CdtDbtInd>CRDT</CdtDbtInd>
    <Sts><Cd>BOOK</Cd></Sts>
    <BookgDt><Dt>2026-11-03</Dt></BookgDt>
    <ValDt><Dt>2026-11-03</Dt></ValDt>
    <AcctSvcrRef>REF-1</AcctSvcrRef>
    <NtryDtls><TxDtls>
     <Refs><EndToEndId>NOTPROVIDED</EndToEndId></Refs>
     <RltdPties>
      <Dbtr><Pty><Nm>MedTec S&#252;d GmbH</Nm></Pty></Dbtr>
      <DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
      <Cdtr><Pty><Nm>Bluewater &amp; Bridge GmbH</Nm></Pty></Cdtr>
     </RltdPties>
     <RmtInf><Ustrd>RE-2026-0142</Ustrd></RmtInf>
    </TxDtls></NtryDtls>
   </Ntry>
   <Ntry>
    <Amt Ccy="EUR">2400.00</Amt>
    <CdtDbtInd>DBIT</CdtDbtInd>
    <Sts><Cd>BOOK</Cd></Sts>
    <BookgDt><Dt>2026-11-02</Dt></BookgDt>
    <NtryDtls><TxDtls>
     <RltdPties><Cdtr><Pty><Nm>Hausverwaltung</Nm></Pty></Cdtr><CdtrAcct><Id><IBAN>DE44500105175407324931</IBAN></Id></CdtrAcct></RltdPties>
     <RmtInf><Ustrd>Miete November</Ustrd></RmtInf>
    </TxDtls></NtryDtls>
   </Ntry>
   <Ntry>
    <Amt Ccy="EUR">100.00</Amt>
    <CdtDbtInd>CRDT</CdtDbtInd>
    <Sts><Cd>PDNG</Cd></Sts>
    <BookgDt><Dt>2026-11-11</Dt></BookgDt>
   </Ntry>
   <Ntry>
    <Amt Ccy="EUR">16362.50</Amt>
    <CdtDbtInd>DBIT</CdtDbtInd>
    <Sts><Cd>BOOK</Cd></Sts>
    <BookgDt><Dt>2026-12-09</Dt></BookgDt>
    <AcctSvcrRef>SAMMLER-7</AcctSvcrRef>
    <NtryDtls>
     <Btch><NbOfTxs>2</NbOfTxs></Btch>
     <TxDtls>
      <Refs><EndToEndId>GS-2026-0001</EndToEndId></Refs>
      <Amt Ccy="EUR">9817.50</Amt>
      <CdtDbtInd>DBIT</CdtDbtInd>
      <RltdPties><Cdtr><Pty><Nm>Julia Hartmann</Nm></Pty></Cdtr></RltdPties>
      <RmtInf><Ustrd>Gutschrift GS-2026-0001 November 2026</Ustrd></RmtInf>
     </TxDtls>
     <TxDtls>
      <Refs><EndToEndId>GS-2026-0002</EndToEndId></Refs>
      <AmtDtls><TxAmt><Amt Ccy="EUR">6545.00</Amt></TxAmt></AmtDtls>
      <RltdPties><Cdtr><Pty><Nm>Ben Kaiser</Nm></Pty></Cdtr></RltdPties>
      <RmtInf><Ustrd>Gutschrift GS-2026-0002</Ustrd></RmtInf>
     </TxDtls>
    </NtryDtls>
   </Ntry>
  </Stmt>
 </BkToCstmrStmt>
</Document>`;

const CAMT_02_PREFIX = `<?xml version="1.0"?>
<ns:Document xmlns:ns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"><ns:BkToCstmrStmt><ns:Stmt>
<ns:Ntry><ns:Amt Ccy="EUR">20000.00</ns:Amt><ns:CdtDbtInd>CRDT</ns:CdtDbtInd><ns:Sts>BOOK</ns:Sts>
<ns:BookgDt><ns:Dt>2026-10-30</ns:Dt></ns:BookgDt>
<ns:NtryDtls><ns:TxDtls><ns:RltdPties><ns:Dbtr><ns:Nm>MedTec Sued GmbH</ns:Nm></ns:Dbtr></ns:RltdPties>
<ns:RmtInf><ns:Ustrd>Rg 0148</ns:Ustrd><ns:Ustrd>Teilzahlung</ns:Ustrd></ns:RmtInf></ns:TxDtls></ns:NtryDtls>
</ns:Ntry></ns:Stmt></ns:BkToCstmrStmt></ns:Document>`;

describe('CAMT.053', () => {
  it('erkennt das Format', () => {
    expect(detectFormat(CAMT_08)).toBe('camt053');
    expect(detectFormat('Buchungstag;Betrag\n01.11.2026;1,00')).toBe('csv');
  });
  it('liest Eingänge, Abbuchungen und Sammelbuchungen (.001.08)', () => {
    const r = parseCamt053(CAMT_08);
    expect(r.format).toBe('camt053');
    expect(r.periodFrom).toBe('2026-10-28');
    expect(r.periodTo).toBe('2026-11-11');
    expect(r.skipped).toBe(1); // vorgemerkt (PDNG)
    expect(r.rows).toHaveLength(4);
    const [inc, rent, gs1, gs2] = r.rows;
    expect(inc).toMatchObject({ bookedOn: '2026-11-03', amountCents: 4516050, counterparty: 'MedTec Süd GmbH', counterpartyIban: 'DE89370400440532013000', purpose: 'RE-2026-0142' });
    expect(rent).toMatchObject({ amountCents: -240000, counterparty: 'Hausverwaltung', purpose: 'Miete November' });
    expect(gs1).toMatchObject({ amountCents: -981750, counterparty: 'Julia Hartmann', bookedOn: '2026-12-09' });
    expect(gs1.purpose).toContain('GS-2026-0001');
    expect(gs2).toMatchObject({ amountCents: -654500, counterparty: 'Ben Kaiser' });
  });
  it('liest ältere Fassung mit Namensraum-Präfix (.001.02)', () => {
    const r = parseStatement(CAMT_02_PREFIX, 'auszug.xml');
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ bookedOn: '2026-10-30', amountCents: 2000000, counterparty: 'MedTec Sued GmbH', purpose: 'Rg 0148 Teilzahlung' });
  });
  it('meldet Dateien ohne Auszug', () => {
    expect(() => parseCamt053('<?xml version="1.0"?><Document><Foo/></Document>')).toThrow(/kein Kontoauszug/);
  });
});

describe('CSV aus dem Online-Banking', () => {
  it('Sparkasse (CSV-CAMT, Anführungszeichen)', () => {
    const csv = [
      '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"',
      '"DE02120300000000202051";"03.11.26";"03.11.26";"GUTSCHR. UEBERWEISUNG";"RE-2026-0142";"";"";"";"";"";"";"MedTec Süd GmbH";"DE89370400440532013000";"COBADEFFXXX";"45.160,50";"EUR";"Umsatz gebucht"',
      '"DE02120300000000202051";"02.11.26";"02.11.26";"DAUERAUFTRAG";"Miete November; Büro";"";"";"";"";"";"";"Hausverwaltung";"DE44500105175407324931";"";"-2.400,00";"EUR";"Umsatz gebucht"',
    ].join('\r\n');
    const r = parseBankCsv(csv);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ bookedOn: '2026-11-03', amountCents: 4516050, counterparty: 'MedTec Süd GmbH', counterpartyIban: 'DE89370400440532013000', purpose: 'RE-2026-0142' });
    expect(r.rows[1]).toMatchObject({ amountCents: -240000, purpose: 'Miete November; Büro' });
  });
  it('Deutsche Bank (Vorspann, Soll/Haben)', () => {
    const csv = [
      'Umsätze Girokonto;;;;;;',
      'Zeitraum: 28.10.2026 - 11.11.2026;;;;',
      '',
      'Buchungstag;Wert;Umsatzart;Begünstigter / Auftraggeber;Verwendungszweck;IBAN;BIC;Kundenreferenz;Mandatsreferenz ;Gläubiger ID;Fremde Gebühren;Betrag;Abweichender Empfänger;Anzahl der Aufträge;Anzahl der Schecks;Soll;Haben;Währung',
      '30.10.2026;30.10.2026;SEPA-Überweisung von;MedTec Süd GmbH;Rg 0148 Teilzahlung;DE89370400440532013000;COBADEFFXXX;;;;;;;;;;20.000,00;EUR',
      '02.11.2026;02.11.2026;Dauerauftrag;Hausverwaltung;Miete November;DE44500105175407324931;;;;;;;;;;-2.400,00;;EUR',
      'Kontostand;11.11.2026;;;;;;;;;;;;;;;123.456,78;EUR',
    ].join('\n');
    const r = parseBankCsv(csv);
    expect(r.rows.map((x) => x.amountCents)).toEqual([2000000, -240000]);
    expect(r.rows[0].counterparty).toBe('MedTec Süd GmbH');
    expect(r.skipped).toBe(1);
  });
  it('ING (Vorspann, Betrag mit Währung daneben)', () => {
    const csv = [
      'Umsatzanzeige;Datei erstellt am: 11.11.2026 09:00',
      '',
      'IBAN;DE02 1203 0000 0000 2020 51',
      'Kontoname;Girokonto',
      '',
      'Buchung;Valuta;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung',
      '04.11.2026;04.11.2026;Nordwerk GmbH (Test);Gutschrift;Danke;100.000,00;EUR;1.190,00;EUR',
    ].join('\n');
    const r = parseBankCsv(csv);
    expect(r.rows).toEqual([expect.objectContaining({ bookedOn: '2026-11-04', amountCents: 119000, counterparty: 'Nordwerk GmbH (Test)', purpose: 'Danke' })]);
  });
  it('DKB (Zahlungspflichtige*r und Zahlungsempfänger*in)', () => {
    const csv = [
      '"Konto";"Girokonto DE02120300000000202051"',
      '""',
      '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"',
      '"03.11.26";"03.11.26";"Gebucht";"MedTec Süd GmbH";"Bluewater & Bridge GmbH";"RE-2026-0142";"Eingang";"DE89370400440532013000";"45.160,50";"";"";""',
      '"09.12.26";"09.12.26";"Gebucht";"Bluewater & Bridge GmbH";"Julia Hartmann";"Gutschrift GS-2026-0001";"Ausgang";"DE12500105170648489890";"-9.817,50";"";"";""',
    ].join('\n');
    const r = parseBankCsv(csv);
    expect(r.rows[0]).toMatchObject({ counterparty: 'MedTec Süd GmbH', amountCents: 4516050 });
    expect(r.rows[1]).toMatchObject({ counterparty: 'Julia Hartmann', amountCents: -981750 });
  });
  it('Qonto (Komma, englisch)', () => {
    const csv = [
      'Status,Settlement date (UTC),Amount,Currency,Counterparty name,Reference,IBAN',
      'settled,2026-11-03 10:12:00,45160.50,EUR,MedTec Süd GmbH,"RE-2026-0142, Danke",DE89370400440532013000',
      'settled,2026-11-05 10:12:00,-1200.00,USD,Some Vendor,Invoice 77,',
    ].join('\n');
    const r = parseBankCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({ bookedOn: '2026-11-03', amountCents: 4516050, purpose: 'RE-2026-0142, Danke' });
    expect(r.warnings[0]).toMatch(/USD/);
  });
  it('Volksbank mit Kennzeichen S/H', () => {
    const csv = [
      'Buchungstag;Valuta;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;Verwendungszweck;Umsatz;Soll/Haben',
      '30.10.2026;30.10.2026;MedTec Süd GmbH;DE89370400440532013000;Rg 0148;20.000,00;H',
      '02.11.2026;02.11.2026;Hausverwaltung;;Miete;2.400,00;S',
    ].join('\n');
    const r = parseBankCsv(csv);
    expect(r.rows.map((x) => x.amountCents)).toEqual([2000000, -240000]);
  });
  it('meldet CSV ohne Kopfzeile', () => {
    expect(() => parseBankCsv('a;b;c\n1;2;3')).toThrow(/Kopfzeile/);
  });
});

describe('Schlüssel gegen Doppelimport', () => {
  it('gleiche Buchung, gleicher Schlüssel; echte Doppelte bekommen eine Nummer', () => {
    const row = { bookedOn: '2026-11-03', amountCents: 100, counterparty: 'A', counterpartyIban: null, purpose: 'x', reference: 'r1', currency: 'EUR' };
    const a = fingerprintKeys([row, { ...row, reference: 'r2' }]);
    const b = fingerprintKeys([{ ...row, reference: 'other' }]);
    expect(a[0]).toBe(b[0]);
    expect(a[1]).not.toBe(a[0]);
  });
});

describe('Vorschläge', () => {
  const invoices = [
    { id: 'i142', number: 'RE-2026-0142', openCents: 4516050, totalCents: 4516050, recipientName: 'MedTec Süd GmbH', candidateName: 'Cem Aydın' },
    { id: 'i148', number: 'RE-2026-0148', openCents: 3558100, totalCents: 3558100, recipientName: 'MedTec Süd GmbH', candidateName: 'Tom Neumann' },
    { id: 'i014', number: 'RE-2026-0014', openCents: 1000, totalCents: 1000, recipientName: 'Andere GmbH', candidateName: null },
  ];
  const notes = [{ id: 'n1', number: 'GS-2026-0001', totalCents: 981750, recruiterName: 'Julia Hartmann' }];
  it('Nummer und Betrag stimmen → sicher', () => {
    const s = suggestFor({ amountCents: 4516050, purpose: 'RE-2026-0142', counterparty: 'MedTec Süd GmbH' }, invoices);
    expect(s).toMatchObject({ kind: 'invoice', targetId: 'i142', safe: true, detail: 'Nummer und Betrag stimmen' });
  });
  it('Teilzahlung mit verkürzter Nummer → Rest offen', () => {
    const s = suggestFor({ amountCents: 2000000, purpose: 'Rg 0148 Teilzahlung', counterparty: 'MedTec Süd GmbH' }, invoices);
    expect(s).toMatchObject({ kind: 'invoice', targetId: 'i148', safe: true, remainingCents: 1558100 });
    expect(s.detail).toContain('15.581');
  });
  it('verkürzte Nummer ohne passenden Namen ist nicht sicher', () => {
    const s = suggestFor({ amountCents: 2000000, purpose: 'Rg 0148', counterparty: 'Irgendwer' }, invoices);
    expect(s).toMatchObject({ targetId: 'i148', safe: false });
  });
  it('RE-2026-0014 steckt nicht in RE-2026-00142', () => {
    const s = suggestFor({ amountCents: 1000, purpose: 'RE-2026-00142', counterparty: 'Andere GmbH' }, invoices);
    expect(s.targetId).not.toBe('i014');
  });
  it('Betrag höher als offen → nicht sicher', () => {
    const s = suggestFor({ amountCents: 5000000, purpose: 'RE-2026-0142', counterparty: 'MedTec' }, invoices);
    expect(s).toMatchObject({ safe: false });
    expect(s.detail).toMatch(/höher/);
  });
  it('kein Vorschlag bei „Danke“', () => {
    expect(suggestFor({ amountCents: 119000, purpose: 'Danke', counterparty: 'Nordwerk GmbH (Test)' }, invoices)).toMatchObject({ kind: 'none', label: 'kein Vorschlag' });
  });
  it('Abbuchung mit Gutschriftnummer → Auszahlung', () => {
    expect(suggestFor({ amountCents: -981750, purpose: 'Gutschrift GS-2026-0001', counterparty: 'Julia Hartmann' }, invoices, notes)).toMatchObject({ kind: 'credit_note', targetId: 'n1', safe: true });
    expect(suggestFor({ amountCents: -240000, purpose: 'Miete November', counterparty: 'Hausverwaltung' }, invoices, notes)).toMatchObject({ kind: 'none', label: 'kein Matchunt-Beleg' });
  });
  it('Sammelüberweisung eines Laufs', () => {
    const runs = [{ id: 'r1', period: 'November 2026', refs: ['GS-LAUF-2026-11'], openTotalCents: 1636250, openCount: 2 }];
    expect(suggestFor({ amountCents: -1636250, purpose: 'SEPA Sammler GS-LAUF-2026-11', counterparty: null }, invoices, [], runs)).toMatchObject({ kind: 'credit_run', safe: true });
  });
});
