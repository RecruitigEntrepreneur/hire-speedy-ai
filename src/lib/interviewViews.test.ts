import { describe, expect, it } from 'vitest';
import { fromRecords, type DossierForm } from './candidateDossier';
import {
  CLOCK_RESUME_MS,
  INTERVIEW_VIEWS,
  clearInterviewPosition,
  clearLocalCopy,
  firstOpenView,
  interviewWasOpen,
  isAfterCall,
  markInterviewOpen,
  pickTermin,
  readInterviewLayout,
  readInterviewPosition,
  readLocalCopy,
  resumedElapsed,
  terminArt,
  terminDatum,
  viewAnswered,
  viewIndex,
  viewOfField,
  writeInterviewLayout,
  writeInterviewPosition,
  writeLocalCopy,
  wunschBand,
} from './interviewViews';

const empty = (patch: Partial<DossierForm> = {}): DossierForm => ({ ...fromRecords(null, null, []), ...patch });

function fakeStore(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

describe('Punkte', () => {
  it('hat fünf Punkte im Gespräch und den Abschluss', () => {
    expect(INTERVIEW_VIEWS.map((v) => v.label)).toEqual(['Karriereziel', 'Rolle heute', 'Wechselmotivation', 'Gehalt und Rahmen', 'Markt', 'Abschluss']);
  });

  it('führt kein Feld doppelt', () => {
    const fields = INTERVIEW_VIEWS.flatMap((v) => v.fields);
    expect(new Set(fields).size).toBe(fields.length);
  });

  it('fragt Wunschrollen, Zielbranchen, Unternehmen und Top 3 nicht mehr', () => {
    for (const f of ['target_roles', 'target_industries', 'company_size_pref', 'industry_change', 'international_pref', 'offer_requirements']) {
      expect(viewOfField(f)).toBe(-1);
    }
    expect(INTERVIEW_VIEWS[viewOfField('target_locations')].key).toBe('rahmen');
    expect(INTERVIEW_VIEWS[viewOfField('relocation_willing')].key).toBe('rahmen');
  });

  it('springt von jeder Pflichtangabe zum richtigen Punkt', () => {
    const at = (field: string) => INTERVIEW_VIEWS[viewOfField(field)]?.key;
    expect(at('change_motivation')).toBe('motivation');
    expect(at('specific_incident')).toBe('motivation');
    expect(at('job_title')).toBe('rolle');
    expect(at('expected_salary')).toBe('rahmen');
    expect(at('notice_period')).toBe('rahmen');
    expect(at('remote_preference')).toBe('rahmen');
    expect(at('city')).toBe('rahmen');
    expect(at('max_commute_minutes')).toBe('rahmen');
    expect(at('languages')).toBe('rahmen');
    expect(at('recommendation')).toBe('abschluss');
    expect(at('summary_motivation')).toBe('abschluss');
    expect(viewOfField('email')).toBe(-1);
  });

  it('stoppt die Uhr erst, wenn der Kandidat nicht mehr in der Leitung ist', () => {
    expect(INTERVIEW_VIEWS.filter((v) => isAfterCall(v.key)).map((v) => v.key)).toEqual(['abschluss']);
  });
});

describe('Antwort je Punkt', () => {
  it('zählt bloßes Öffnen nicht als Antwort', () => {
    for (const v of INTERVIEW_VIEWS) expect(viewAnswered(v.key, empty())).toBe(false);
    expect(firstOpenView(empty())).toBe(0);
  });

  it('zählt Vorbefülltes aus der Akte nicht als beantwortet', () => {
    expect(viewAnswered('rolle', empty({ job_title: 'Sales Director DACH', experience_years: 12 }))).toBe(false);
    expect(viewAnswered('markt', empty({ blocked_companies: ['Heutiger Arbeitgeber'] }))).toBe(false);
    expect(viewAnswered('motivation', empty({ change_motivation: 'Sucht eine klare nächste Stufe.' }))).toBe(false);
  });

  it('erkennt beantwortete Punkte', () => {
    expect(viewAnswered('ziel', empty({ career_ultimate_goal: 'Vertriebsleitung' }))).toBe(true);
    expect(viewAnswered('rolle', empty({ current_negative: 'Provision gekürzt' }))).toBe(true);
    expect(viewAnswered('motivation', empty({ specific_incident: 'Provision gekürzt' }))).toBe(true);
    expect(viewAnswered('rahmen', empty({ expected_salary: 145000, notice_period: '2_months_eom' }))).toBe(false);
    expect(viewAnswered('markt', empty({ other_applications: 'none' }))).toBe(true);
    expect(viewAnswered('abschluss', empty({ recommendation: 'yes' }))).toBe(true);
  });

  it('startet beim ersten Punkt ohne Antwort', () => {
    const f = empty({ career_ultimate_goal: 'Vertriebsleitung', current_positive: 'Team' });
    expect(INTERVIEW_VIEWS[firstOpenView(f)].key).toBe('motivation');
  });
});

describe('Termin aus der Buchung', () => {
  const at = (iso: string) => Date.parse(iso);
  const t = (id: string, starts_at: string, extra: Partial<{ status: string; mode: 'teams' | 'phone' }> = {}) => ({ id, starts_at, mode: 'teams' as const, status: 'booked', ...extra });

  it('nimmt den gebuchten Termin von heute, bei mehreren den nächsten', () => {
    const now = at('2026-11-03T13:50:00Z');
    const termine = [t('frueh', '2026-11-03T08:00:00Z'), t('gleich', '2026-11-03T14:00:00Z'), t('morgen', '2026-11-04T14:00:00Z')];
    expect(pickTermin(termine, now)?.id).toBe('gleich');
  });

  it('ignoriert abgesagte Termine und Termine an anderen Tagen', () => {
    const now = at('2026-11-03T13:50:00Z');
    expect(pickTermin([t('abgesagt', '2026-11-03T14:00:00Z', { status: 'cancelled' })], now)).toBeNull();
    expect(pickTermin([t('gestern', '2026-11-02T14:00:00Z')], now)).toBeNull();
  });

  it('rechnet den Tag in deutscher Zeit', () => {
    // 23:30 Uhr UTC am 2.11. ist in Berlin schon der 3.11.
    expect(terminDatum({ starts_at: '2026-11-02T23:30:00Z' })).toBe('2026-11-03');
    expect(pickTermin([t('nachts', '2026-11-02T23:30:00Z')], at('2026-11-03T09:00:00Z'))?.id).toBe('nachts');
  });

  it('macht aus Teams Video und aus Telefon Telefon', () => {
    expect(terminArt({ mode: 'teams' })).toBe('video');
    expect(terminArt({ mode: 'phone' })).toBe('phone');
  });
});

describe('Vorschau für den Kunden', () => {
  it('zeigt das Wunschgehalt als Spanne wie die Datenbank', () => {
    expect(wunschBand(80000)).toBe('80–90 T€');
    expect(wunschBand(82000)).toBe('80–90 T€');
    expect(wunschBand(145000)).toBe('145–155 T€');
    expect(wunschBand(9000)).toBeNull();
    expect(wunschBand(null)).toBeNull();
  });
});

describe('Merkzettel', () => {
  it('merkt sich die Stelle je Nutzer und Kandidat', () => {
    const s = fakeStore();
    writeInterviewPosition('u1', 'c1', { view: 'rahmen', at: 1000, elapsed: 90, savedAt: 900 }, s);
    expect(readInterviewPosition('u1', 'c1', s)?.view).toBe('rahmen');
    expect(readInterviewPosition('u2', 'c1', s)).toBeNull();
    expect(readInterviewPosition('u1', 'c2', s)).toBeNull();
    clearInterviewPosition('u1', 'c1', s);
    expect(readInterviewPosition('u1', 'c1', s)).toBeNull();
  });

  it('verwirft eine gemerkte Stelle, die es nicht mehr gibt', () => {
    const s = fakeStore();
    s.setItem('interview-position:u1:c1', JSON.stringify({ view: 'gibtsnicht', at: 1, elapsed: 1, savedAt: null }));
    expect(readInterviewPosition('u1', 'c1', s)).toBeNull();
    s.setItem('interview-position:u1:c1', '{kaputt');
    expect(readInterviewPosition('u1', 'c1', s)).toBeNull();
  });

  it('lässt die Uhr nur innerhalb der Frist weiterlaufen', () => {
    const pos = { view: 'rahmen' as const, at: 1000, elapsed: 90, savedAt: null };
    expect(resumedElapsed(pos, 1000 + CLOCK_RESUME_MS - 1)).toBe(90);
    expect(resumedElapsed(pos, 1000 + CLOCK_RESUME_MS)).toBe(0);
    expect(resumedElapsed(null, 1000)).toBe(0);
  });

  it('merkt sich „Alle Fragen zeigen“ je Nutzer', () => {
    const s = fakeStore();
    expect(readInterviewLayout('u1', s)).toBe('steps');
    writeInterviewLayout('u1', 'all', s);
    expect(readInterviewLayout('u1', s)).toBe('all');
    expect(readInterviewLayout('u2', s)).toBe('steps');
  });

  it('kennt das offene Fenster nach dem Neuladen', () => {
    const s = fakeStore();
    expect(interviewWasOpen('c1', s)).toBe(false);
    markInterviewOpen('c1', true, s);
    expect(interviewWasOpen('c1', s)).toBe(true);
    markInterviewOpen('c1', false, s);
    expect(interviewWasOpen('c1', s)).toBe(false);
  });

  it('hält eine Kopie nur bis zum Speichern', () => {
    const s = fakeStore();
    writeLocalCopy('c1', empty({ expected_salary: 145000 }), 5, s);
    expect(readLocalCopy('c1', s)?.draft.expected_salary).toBe(145000);
    clearLocalCopy('c1', s);
    expect(readLocalCopy('c1', s)).toBeNull();
    expect(s.data.size).toBe(0);
  });

  it('läuft ohne Speicher weiter', () => {
    const kaputt = {
      getItem: () => { throw new Error('gesperrt'); },
      setItem: () => { throw new Error('gesperrt'); },
      removeItem: () => { throw new Error('gesperrt'); },
    };
    expect(readInterviewLayout('u1', kaputt)).toBe('steps');
    expect(readInterviewPosition('u1', 'c1', kaputt)).toBeNull();
    expect(interviewWasOpen('c1', kaputt)).toBe(false);
    expect(() => markInterviewOpen('c1', true, kaputt)).not.toThrow();
    expect(() => writeLocalCopy('c1', empty(), 1, kaputt)).not.toThrow();
    expect(viewIndex('rahmen')).toBeGreaterThan(0);
  });
});
