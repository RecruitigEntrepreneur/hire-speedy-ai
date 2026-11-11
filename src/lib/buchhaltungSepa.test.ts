import { describe, expect, it } from 'vitest';
import { buildPain001, ibanValid, maskIban, sepaText } from '../../supabase/functions/_shared/buchhaltung-sepa';

describe('IBAN', () => {
  it('prüft die Prüfziffer', () => {
    expect(ibanValid('DE89 3704 0044 0532 0130 00')).toBe(true);
    expect(ibanValid('DE89370400440532013001')).toBe(false);
    expect(ibanValid('AT611904300234573201')).toBe(true);
    expect(ibanValid('DE8937040044053201300')).toBe(false); // zu kurz für DE
    expect(ibanValid('')).toBe(false);
  });
  it('maskiert', () => {
    expect(maskIban('DE89370400440532013000')).toBe('DE89 •••• 3000');
  });
  it('schreibt Umlaute um und entfernt Unerlaubtes', () => {
    expect(sepaText('Jürgen Größ – „Recruiting“ <GmbH>', 70)).toBe('Juergen Groess - Recruiting GmbH');
    expect(sepaText('Cem Aydın', 70)).toBe('Cem Aydin');
    expect(sepaText('x'.repeat(200), 140)).toHaveLength(140);
  });
});

describe('pain.001.001.09', () => {
  const base = {
    msgId: 'MATCHUNT-GS-2026-11-ABC',
    paymentInfoId: 'GS-LAUF-2026-11',
    createdAt: '2026-12-02T10:00:00.000Z',
    executionDate: '2026-12-09',
    debtor: { name: 'Bluewater & Bridge GmbH', iban: 'DE02120300000000202051', bic: 'BYLADEM1001' },
    payments: [
      { endToEndId: 'GS-2026-0001', amountCents: 981750, name: 'Julia Hartmann', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', remittance: 'Gutschrift GS-2026-0001 November 2026' },
      { endToEndId: 'GS-2026-0002', amountCents: 654500, name: 'Ben Kaiser (Test)', iban: 'DE12500105170648489890', bic: null, remittance: 'Gutschrift GS-2026-0002' },
    ],
  };
  it('baut eine Sammelüberweisung mit Summen', () => {
    const xml = buildPain001(base);
    expect(xml).toContain('xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"');
    expect(xml).toContain('<NbOfTxs>2</NbOfTxs>');
    expect(xml.match(/<CtrlSum>16362.50<\/CtrlSum>/g)).toHaveLength(2);
    expect(xml).toContain('<ReqdExctnDt><Dt>2026-12-09</Dt></ReqdExctnDt>');
    expect(xml).toContain('<Nm>Bluewater &amp; Bridge GmbH</Nm>');
    expect(xml).toContain('<DbtrAgt><FinInstnId><BICFI>BYLADEM1001</BICFI></FinInstnId></DbtrAgt>');
    expect(xml).toContain('<EndToEndId>GS-2026-0001</EndToEndId>');
    expect(xml).toContain('<InstdAmt Ccy="EUR">9817.50</InstdAmt>');
    expect(xml).toContain('<CdtrAgt><FinInstnId><BICFI>COBADEFFXXX</BICFI></FinInstnId></CdtrAgt>');
    // ohne BIC kein CdtrAgt (IBAN-only)
    const second = xml.slice(xml.indexOf('GS-2026-0002'));
    expect(second.slice(0, second.indexOf('</CdtTrfTxInf>'))).not.toContain('CdtrAgt');
    expect(xml).toContain('<CreDtTm>2026-12-02T10:00:00</CreDtTm>');
    expect(xml).toContain('<ChrgBr>SLEV</ChrgBr>');
  });
  it('ohne BIC von Matchunt: NOTPROVIDED', () => {
    const xml = buildPain001({ ...base, debtor: { ...base.debtor, bic: '' } });
    expect(xml).toContain('<DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>');
  });
  it('lehnt ungültige Angaben ab', () => {
    expect(() => buildPain001({ ...base, payments: [] })).toThrow(/Keine Überweisung/);
    expect(() => buildPain001({ ...base, debtor: { ...base.debtor, iban: 'DE00123' } })).toThrow(/IBAN von Matchunt/);
    expect(() => buildPain001({ ...base, payments: [{ ...base.payments[0], iban: 'DE89370400440532013001' }] })).toThrow(/GS-2026-0001/);
    expect(() => buildPain001({ ...base, payments: [{ ...base.payments[0], amountCents: 0 }] })).toThrow(/Betrag/);
  });
});
