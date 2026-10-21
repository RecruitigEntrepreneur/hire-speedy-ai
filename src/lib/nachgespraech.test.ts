import { describe, expect, it } from 'vitest';
import { LEER, gehaltAbgleich, istAusgefuellt, kundenText, kurzzeile, parseEuro, startAbgleich, zuZeile, zusammenfassung, type Nachgespraech } from './nachgespraech';

const n = (p: Partial<Nachgespraech>): Nachgespraech => ({ ...LEER, ...p });
const heute = new Date(2026, 9, 20);

describe('Nachgespräch', () => {
  it('liest Euro-Eingaben', () => {
    expect(parseEuro('92.000')).toBe(92000);
    expect(parseEuro('92k')).toBe(92000);
    expect(parseEuro('92')).toBe(92000);
    expect(parseEuro('92 500 €')).toBe(92500);
    expect(parseEuro('')).toBeNull();
    expect(parseEuro('abc')).toBeNull();
  });

  it('gilt erst mit Bauchgefühl, Will-weiter oder einem Satz als ausgefüllt', () => {
    expect(istAusgefuellt(LEER)).toBe(false);
    expect(istAusgefuellt(n({ will_weiter: 'ja' }))).toBe(true);
    expect(istAusgefuellt(n({ verlauf: 'lief gut' }))).toBe(true);
  });

  it('warnt, wenn das Angebot über der Stelle liegt und die Firma weniger nannte', () => {
    const a = gehaltAbgleich(n({ gehalt_besprochen: true, gehalt_kandidat: 92000, gehalt_firma: 85000, angebot_fix_min: 95000 }), { akte: 85000, stelleMin: 80000, stelleMax: 90000 });
    expect(a?.tone).toBe('warn');
    expect(a?.text).toBe('Angebot ab 95.000 € liegt über der Stelle (bis 90.000 €), Firma nannte 85.000 €.');
    expect(a?.akte).toEqual({ field: 'expected_salary', value: 95000, label: 'Akte von 85.000 € auf 95.000 € setzen?' });
  });

  it('verbindet den Firmen-Hinweis auch ohne Gehaltsangabe der Stelle', () => {
    const a = gehaltAbgleich(n({ gehalt_besprochen: true, gehalt_kandidat: 92000, gehalt_firma: 85000, angebot_fix_min: 90000 }), { akte: 80000, stelleMin: null, stelleMax: null });
    expect(a?.text).toBe('Angebot ab 90.000 € liegt über dem, was die Firma nannte (85.000 €).');
  });

  it('meldet „passt“ und schlägt nichts vor, wenn Akte und Stelle stimmen', () => {
    const a = gehaltAbgleich(n({ gehalt_besprochen: true, gehalt_kandidat: 85000 }), { akte: 85000, stelleMin: 80000, stelleMax: 90000 });
    expect(a).toEqual({ tone: 'ok', text: '85.000 € genannt passt zur Stelle.', akte: undefined });
  });

  it('nimmt das genannte Gehalt nur, wenn darüber gesprochen wurde', () => {
    expect(gehaltAbgleich(n({ gehalt_besprochen: false, gehalt_kandidat: 92000 }), { akte: null, stelleMin: null, stelleMax: 90000 })).toBeNull();
  });

  it('prüft den Start gegen die Kündigungsfrist', () => {
    const vor = startAbgleich(n({ start_art: 'fester_tag', start_datum: '2026-11-01' }), { noticePeriod: '3_months', availabilityDate: null }, heute);
    expect(vor?.tone).toBe('warn');
    expect(vor?.text).toContain('vor dem Ende der Kündigungsfrist');
    const nach = startAbgleich(n({ start_art: 'fester_tag', start_datum: '2027-02-01' }), { noticePeriod: '3_months', availabilityDate: '2027-01-01' }, heute);
    expect(nach).toEqual({ tone: 'ok', text: 'Start 01.02.2027 passt zur Kündigungsfrist.', akte: { field: 'availability_date', value: '2027-02-01', label: 'Akte „verfügbar ab“ von 01.01.2027 auf 01.02.2027 setzen?' } });
  });

  it('fasst zusammen, ohne Leeres zu zeigen', () => {
    const z = zusammenfassung(n({ bauchgefuehl: 'gut', zusammenarbeit: 'ja', gehalt_besprochen: true, gehalt_kandidat: 92000, gehalt_firma: 85000, angebot_fix_min: 90000, angebot_punkte: ['homeoffice'], start_art: 'fester_tag', start_datum: '2027-02-01', will_weiter: 'ja' }), heute);
    expect(z).toEqual([
      'Bauchgefühl gut',
      'Zusammenarbeit: ja',
      'Gehalt: Kandidat 92.000 €, Firma 85.000 €',
      'Angebot: ab 90.000 € fix, Homeoffice-Tage',
      'Start: 01.02.2027',
      'Will weiter: ja',
    ]);
    expect(kurzzeile(n({ bauchgefuehl: 'gut', will_weiter: 'ja', angebot_fix_min: 90000, start_art: 'fester_tag', start_datum: '2027-02-01' }))).toBe('gut, will weiter · Angebot ab 90.000 € · Start 01.02.2027');
  });

  it('verrät dem Kunden weder Gehalt noch Bedenken', () => {
    const t = kundenText(n({ will_weiter: 'ja', bauchgefuehl: 'gut', gehalt_besprochen: true, gehalt_kandidat: 92000, bedenken: 'Pendelzeit' }));
    expect(t).toBe('Der Kandidat hat einen sehr guten Eindruck vom Interview und möchte gern weitermachen. Wie ist Ihr Eindruck, und wie sieht der nächste Schritt aus?');
    expect(t).not.toMatch(/92|Pendel/);
    expect(kundenText(n({ will_weiter: 'nein' }))).toContain('nicht weiterzuführen');
  });

  it('speichert Gehalt nur, wenn besprochen, und Datum nur beim festen Tag', () => {
    const z = zuZeile(n({ gehalt_besprochen: false, gehalt_kandidat: 90000, start_art: 'sofort', start_datum: '2027-01-01', verlauf: '  ' }));
    expect(z.gehalt_kandidat).toBeNull();
    expect(z.start_datum).toBeNull();
    expect(z.verlauf).toBeNull();
  });
});
