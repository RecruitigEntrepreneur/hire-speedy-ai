import { describe, expect, it } from 'vitest';
import { quickExtract } from './quickExtract';

const get = (text: string, key: string) => quickExtract(text).suggestions.find((s) => s.key === key);

describe('Schnellerkennung: Notizen eines Headhunters', () => {
  const lena = `Telefonat 28.09.: will 45k, ginge auch mit 42. Kündigung 1 Monat.
Motivation: Schichtdienst belastet, möchte feste Zeiten und mehr Verantwortung.
Seit dem neuen Dienstplan im Januar hat sie genug.
Deutsch Muttersprache, Englisch B2. Chef intern angesprochen, ohne Ergebnis.
Bitte nicht zu Klinikum Nord. Würde auf keinen Fall bleiben.`;

  it('liest Wunschgehalt und Schmerzgrenze aus einem Satz', () => {
    expect(get(lena, 'expected_salary')?.value).toBe(45000);
    expect(get(lena, 'salary_minimum')?.value).toBe(42000);
  });

  it('liest Kündigungsfrist, Sprachen und Motivation mit Zitat', () => {
    expect(get(lena, 'notice_period')?.value).toBe('1_month');
    expect(get(lena, 'languages')?.value).toEqual([
      { language: 'Deutsch', proficiency: 'Muttersprache' },
      { language: 'Englisch', proficiency: 'B2' },
    ]);
    const tags = get(lena, 'change_motivation_tags')?.value as string[];
    expect(tags).toContain('Arbeitszeiten');
    expect(tags).toContain('Verantwortung');
    expect(get(lena, 'change_motivation')?.quote).toContain('Schichtdienst');
  });

  it('erkennt Auslöser, intern angesprochen, Gegenangebot und Sperrliste', () => {
    expect(get(lena, 'specific_incident')?.value).toBe('Seit dem neuen Dienstplan im Januar hat sie genug');
    expect(get(lena, 'discussed_internally')?.value).toBe('Ja, ohne Ergebnis');
    expect(get(lena, 'would_stay')?.value).toBe('no');
    expect(get(lena, 'blocked_companies')?.value).toEqual(['Klinikum Nord']);
  });

  it('versteht Kürzel mit Füllwort, liest aber "ist" im Satz nicht als Gehalt', () => {
    const keys = (t: string) => Object.fromEntries(quickExtract(t).suggestions.map((x) => [x.key, x.value]));
    expect(keys('Rückruf 29.09.: WG jetzt 46k, rem. 3/5 wäre super').expected_salary).toBe(46000);
    expect(keys('SG ca. 41').salary_minimum).toBe(41000);
    expect(keys('Ist: 38k').current_salary).toBe(38000);
    expect(keys('Ist-Gehalt 38').current_salary).toBe(38000);
    expect(keys('WG: 45').expected_salary).toBe(45000);
    expect(keys('Gehalt: 45k').expected_salary).toBe(45000);
    expect(keys('Kündigung: 3 Monate').notice_period).toBe('3_months');
    expect(keys('Lena T.: Ich will 45k').expected_salary).toBe(45000);
    expect(keys('Ihre Tochter ist 12 und sie ist 45 Minuten entfernt.').current_salary).toBeUndefined();
  });

  it('versteht Kürzel: IST / WG / SG, KüF zum Quartal, rem. 3/5', () => {
    const notes = 'IST 52 / WG 60 / SG 56\nKüF 3M z. QE\nrem. 3/5 ok, max 45 min Pendel';
    expect(get(notes, 'current_salary')?.value).toBe(52000);
    expect(get(notes, 'expected_salary')?.value).toBe(60000);
    expect(get(notes, 'salary_minimum')?.value).toBe(56000);
    expect(get(notes, 'notice_period')?.value).toBe('3_months_eoq');
    expect(get(notes, 'remote_preference')?.value).toBe('hybrid');
    expect(get(notes, 'max_commute_minutes')?.value).toBe(45);
  });

  it('liest Monatsgehälter als Jahresgehalt', () => {
    expect(get('verdient aktuell 3.500 € monatlich', 'current_salary')?.value).toBe(42000);
  });
});

describe('Schnellerkennung: Transkript', () => {
  const transcript = `00:12:40 Lena Testfrau: Also eigentlich hätte ich gern 45.000 Euro.
00:13:02 Marko Benko: Und Ihre Kündigungsfrist?
00:13:05 Lena Testfrau: Drei Monate zum Quartalsende.
00:14:10 Lena Testfrau: Ich bin gerade in einer zweiten Runde bei einem anderen Anbieter.`;

  it('liest Werte aus Sprecherzeilen', () => {
    expect(get(transcript, 'expected_salary')?.value).toBe(45000);
    expect(get(transcript, 'notice_period')?.value).toBe('3_months_eoq');
    expect(get(transcript, 'other_applications')?.value).toBe('advanced');
  });
});

describe('Schnellerkennung: geschützte Angaben', () => {
  it('übernimmt Gesundheit, Familie und Alter nie, meldet sie aber', () => {
    const r = quickExtract('Hatte letztes Jahr einen Burnout, will 45k. Zwei Kinder in der Kita. 38 Jahre alt.');
    expect(r.protectedMentions).toEqual(expect.arrayContaining(['Gesundheit', 'Familie', 'Alter']));
    // der ganze Satz mit der Gesundheitsangabe wird nicht ausgewertet, auch nicht das Gehalt darin
    expect(r.suggestions.find((s) => s.key === 'expected_salary')).toBeUndefined();
    expect(r.suggestions.some((s) => /burnout|kinder|38/i.test(s.quote))).toBe(false);
  });

  it('setzt Einverständnis nur als unsicheren Vorschlag', () => {
    expect(get('Sie ist einverstanden, dass ich sie anonym vorstelle.', 'presentation_consent')?.confidence).toBe(1);
  });
});
