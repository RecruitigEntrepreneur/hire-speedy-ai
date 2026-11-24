import { describe, expect, it } from 'vitest';
import { kandidatKuerzel, kandidatenStand, type StandStelle, type StandVorstellung } from './kandidatenStand';

const stellen = new Map<string, StandStelle>([
  ['lohn', { title: 'Lohnbuchhalter (m/w/d)', company_name: 'MedTec Süd GmbH' }],
  ['sales', { title: 'Head of Sales DACH (m/w/d)', company_name: 'MedTec Süd GmbH' }],
  ['hr', { title: 'HR Business Partner (m/w/d)', company_name: 'MedTec Süd GmbH' }],
]);
const v = (id: string, job_id: string, stage: string, status = 'submitted', updated_at = '2026-11-01'): StandVorstellung =>
  ({ id, job_id, stage, status, submitted_at: '2026-10-01', updated_at });

describe('kandidatenStand', () => {
  it('ohne Vorstellung: frei', () => {
    expect(kandidatenStand([], stellen, new Map())).toEqual({ art: 'frei' });
  });

  it('liest die Stufe, nicht den alten Status: eingestellt trotz status „submitted“', () => {
    const s = kandidatenStand(
      [v('a', 'hr', 'placed', 'submitted')],
      stellen,
      new Map([['a', { start_date: '2026-09-29', retention_release_date: '2027-01-11' }]]),
      new Date('2026-11-24'),
    );
    expect(s.art).toBe('eingestellt');
    if (s.art !== 'eingestellt') return;
    expect(s.vorgang.company).toBe('MedTec Süd GmbH');
    expect(s.garantieBis).toBe('2027-01-11');
    expect(s.garantieVorbei).toBe(false);
    expect(s.startKommt).toBe(false);
  });

  it('Garantie vorbei und Start in der Zukunft werden erkannt', () => {
    const heute = new Date('2026-11-24');
    const vorbei = kandidatenStand([v('a', 'sales', 'placed')], stellen, new Map([['a', { start_date: '2026-07-01', retention_release_date: '2026-10-13' }]]), heute);
    expect(vorbei.art === 'eingestellt' && vorbei.garantieVorbei).toBe(true);
    const kommt = kandidatenStand([v('b', 'sales', 'placed')], stellen, new Map([['b', { start_date: '2026-12-01', retention_release_date: '2027-03-15' }]]), heute);
    expect(kommt.art === 'eingestellt' && kommt.startKommt).toBe(true);
  });

  it('laufender Vorgang geht vor Einstellung, der weiteste steht oben', () => {
    const s = kandidatenStand(
      [v('a', 'hr', 'placed'), v('b', 'sales', 'submitted'), v('c', 'lohn', 'interview_completed')],
      stellen,
      new Map(),
    );
    expect(s.art).toBe('prozess');
    if (s.art !== 'prozess') return;
    expect(s.haupt.jobTitle).toBe('Lohnbuchhalter (m/w/d)');
    expect(s.haupt.stage).toBe('interview_completed');
    expect(s.weitere.map((x) => x.submissionId)).toEqual(['b']);
  });

  it('Absagen zählen nicht als laufend', () => {
    expect(kandidatenStand([v('a', 'hr', 'submitted', 'rejected')], stellen, new Map())).toEqual({ art: 'frei' });
    expect(kandidatenStand([v('a', 'hr', 'withdrawn')], stellen, new Map())).toEqual({ art: 'frei' });
  });
});

describe('kandidatKuerzel', () => {
  it('zwei Buchstaben aus Vor- und Nachname, ohne „Test“ und Klammern', () => {
    expect(kandidatKuerzel('Test Emre Yildiz')).toBe('EY');
    expect(kandidatKuerzel('Nora Lang (Test)')).toBe('NL');
    expect(kandidatKuerzel('Cem Aydın (Test)')).toBe('CA');
    expect(kandidatKuerzel('Anna Maria von Berg')).toBe('AB');
    expect(kandidatKuerzel('Lukas')).toBe('L');
    expect(kandidatKuerzel('')).toBe('?');
  });
});
