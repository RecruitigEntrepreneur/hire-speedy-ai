import { describe, expect, it } from 'vitest';
import {
  DISCUSSED_OPTIONS,
  EMPLOYMENT_OPTIONS,
  FREQUENCY_OPTIONS,
  LEADERSHIP_OPTIONS,
  MOTIVATION_TAGS,
  NOTICE_OPTIONS,
  OFFER_OPTIONS,
  OTHER_APPLICATIONS_OPTIONS,
  PERMIT_OPTIONS,
  WORK_MODEL_OPTIONS,
  WOULD_STAY_OPTIONS,
  fromRecords,
} from './candidateDossier';
import {
  DISCUSSED_VALUES,
  EMPLOYMENT_VALUES,
  FIELD_SPECS,
  FREQUENCY_VALUES,
  LEADERSHIP_VALUES,
  MOTIVATION_TAG_VALUES,
  NOTICE_VALUES,
  OFFER_VALUES,
  OTHER_APPLICATIONS_VALUES,
  PERMIT_VALUES,
  WORK_MODEL_VALUES,
  WOULD_STAY_VALUES,
} from '../../supabase/functions/_shared/dossier-extraction';
import { KEY_META, applyReview, buildReview, defaultDecisions, freshText, fromAiFields, looksLikeTranscript, mergeSuggestions, reviewCounts } from './captureReview';
import { quickExtract } from './quickExtract';

const lenaRow = {
  full_name: 'Lena Testfrau', email: 'marko.benko@bluewater-bridge.de', job_title: 'Patientenservice-Mitarbeiterin',
  experience_years: 5, skills: ['Zendesk', 'Patientenkommunikation', 'Terminmanagement'], expected_salary: 42000,
  current_salary: 38000, notice_period: '1_month',
};

describe('Server und Browser kennen dieselben Werte', () => {
  it('Enum-Listen stimmen überein', () => {
    const v = (o: { value: string }[]) => o.map((x) => x.value);
    expect(NOTICE_VALUES).toEqual(v(NOTICE_OPTIONS));
    expect(WORK_MODEL_VALUES).toEqual(v(WORK_MODEL_OPTIONS));
    expect(EMPLOYMENT_VALUES).toEqual(v(EMPLOYMENT_OPTIONS));
    expect(PERMIT_VALUES).toEqual(v(PERMIT_OPTIONS));
    expect(FREQUENCY_VALUES).toEqual(v(FREQUENCY_OPTIONS));
    expect(DISCUSSED_VALUES).toEqual(v(DISCUSSED_OPTIONS));
    expect(WOULD_STAY_VALUES).toEqual(v(WOULD_STAY_OPTIONS));
    expect(OTHER_APPLICATIONS_VALUES).toEqual(v(OTHER_APPLICATIONS_OPTIONS));
    expect(LEADERSHIP_VALUES).toEqual(v(LEADERSHIP_OPTIONS));
    expect(MOTIVATION_TAG_VALUES).toEqual(MOTIVATION_TAGS);
    expect(OFFER_VALUES).toEqual(OFFER_OPTIONS);
  });

  it('jedes Server-Feld hat eine Anzeige im Prüf-Screen', () => {
    for (const f of FIELD_SPECS) expect(KEY_META[f.key as keyof typeof KEY_META], f.key).toBeTruthy();
  });
});

describe('Prüf-Screen', () => {
  const form = fromRecords(lenaRow, null);
  const notes = 'will 45k, ginge auch mit 42. Kündigung 1 Monat. Englisch B2. Bitte nicht zu Klinikum Nord. Schichtdienst nervt, will feste Zeiten.';

  it('ordnet Widerspruch, sensibel, neu und schon vorhanden richtig ein', () => {
    const items = buildReview(form, quickExtract(notes).suggestions);
    const status = Object.fromEntries(items.map((i) => [i.key, i.status]));
    expect(status.expected_salary).toBe('conflict'); // Akte 42k, Notiz 45k
    expect(status.salary_minimum).toBe('sensitive');
    expect(status.blocked_companies).toBe('sensitive');
    expect(status.notice_period).toBe('same');
    expect(status.languages).toBe('safe');
    const counts = reviewCounts(items);
    expect(counts.conflict).toBe(1);
  });

  it('übernimmt standardmäßig nur Sicheres und Unsicheres; Widerspruch behält die Akte', () => {
    const items = buildReview(form, quickExtract(notes).suggestions);
    const next = applyReview(form, items, defaultDecisions(items));
    expect(next.expected_salary).toBe(42000);
    expect(next.salary_minimum).toBeNull();
    expect(next.blocked_companies).toEqual([]);
    expect(next.languages).toEqual([{ language: 'Englisch', proficiency: 'B2' }]);
    const accepted = applyReview(form, items, { ...defaultDecisions(items), expected_salary: 'accept', blocked_companies: 'accept' });
    expect(accepted.expected_salary).toBe(45000);
    expect(accepted.blocked_companies).toEqual(['Klinikum Nord']);
  });

  it('KI schlägt Schnellerkennung, außer die Schnellerkennung ist sicherer', () => {
    const ai = fromAiFields([{ key: 'expected_salary', value: 46000, quote: 'will 46', confidence: 2 }, { key: 'recommendation', value: 'yes', quote: 'x', confidence: 3 }]);
    expect(ai.map((s) => s.key)).toEqual(['expected_salary']); // Bewertungsfelder werden ignoriert
    const quick = quickExtract(notes).suggestions;
    const merged = mergeSuggestions(ai, quick);
    expect(merged.find((s) => s.key === 'expected_salary')?.origin).toBe('ai');
  });

  it('erkennt Transkripte an Zeitmarken und Sprecherzeilen, eigene Notizen nicht', () => {
    expect(looksLikeTranscript('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHallo')).toBe(true);
    expect(looksLikeTranscript('Marko Benko: Hallo\nLena Testfrau: Hallo\nMarko Benko: Wie geht es?\nLena Testfrau: Gut')).toBe(true);
    expect(looksLikeTranscript('will 45k\nKündigung 1 Monat\nEnglisch B2')).toBe(false);
  });

  it('wertet im Live-Interview nur neu Getipptes aus, nicht die alte Mitschrift', () => {
    const old = 'Telefonat 28.09.: will 42k. Kündigung 1 Monat.';
    expect(freshText(`${old}\njetzt 45k`, old)).toBe('\njetzt 45k');
    expect(freshText(`Neu oben: 45k\n${old}`, old)).toBe('Neu oben: 45k');
    expect(freshText('alles neu', '')).toBe('alles neu');
    const f = { ...fromRecords(lenaRow, null), expected_salary: 45000, notice_period: '3_months_eoq' };
    expect(buildReview(f, quickExtract(freshText(old, old)).suggestions)).toEqual([]);
  });
});
