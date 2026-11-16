import { describe, expect, it } from 'vitest';
import { CLIENT_GUIDE_CHAPTERS, CLIENT_GUIDE_STATE_KEY, CLIENT_GUIDE_STEPS, CLIENT_TOUR_SEEN_KEY, clientTourSeen, clientTourStorageKey } from './clientGuide';
import { concretePath, matchRoute, readGuideState } from './recruiterGuide';
import { CLIENT_GUIDE_CHAPTERS_WITH_POSITION, CLIENT_GUIDE_STEPS as ALLE_SCHRITTE, CLIENT_GUIDE_STEPS_WITH_POSITION } from './clientGuide';

const steps = CLIENT_GUIDE_STEPS;

describe('Kunden-Rundgang: Ablauf', () => {
  it('führt in vier Kapiteln von der Begrüßung zum Abschluss', () => {
    expect(steps[0].id).toBe('c-welcome');
    expect(steps.at(-1)?.id).toBe('c-done');
    expect(new Set(steps.map(s => s.chapter))).toEqual(new Set([1, 2, 3, 4]));
    expect(CLIENT_GUIDE_CHAPTERS).toHaveLength(4);
    const chapters = steps.map(s => s.chapter);
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    expect(new Set(steps.map(s => s.id)).size).toBe(steps.length);
  });

  it('legt das Gewicht auf das Anlegen einer Stelle', () => {
    const anlegen = steps.filter(s => s.chapter === 2).length;
    expect(anlegen).toBeGreaterThan(steps.length / 2 - 1);
  });

  it('jeder Klick-Schritt führt auf die Seite des nächsten Schritts', () => {
    steps.forEach((step, i) => {
      if (!step.click?.to) return;
      expect(steps[i + 1].route).toBe(step.click.to);
    });
  });

  it('löst das Einreichen nie selbst aus: kein Schritt klickt es an', () => {
    const submit = steps.find(s => s.id === 'c-submit')!;
    expect(submit.click).toBeUndefined();
    expect(submit.target).toBeUndefined();
  });

  it('wartet auf das Profil, statt es vorauszusetzen', () => {
    expect(steps.find(s => s.id === 'c-profile')!.wait).toBeTruthy();
  });

  it('verlässt die Aufnahme nicht von selbst: "Meine Jobs" wartet auf den Kunden', () => {
    const jobs = steps.find(s => s.id === 'c-jobs')!;
    expect(jobs.hold).toBeTruthy();
    expect(matchRoute(jobs.holdWhile!, '/dashboard/aufnahme/abc')).toBe(true);
  });
});

describe('Kunden-Rundgang: Adressen', () => {
  it('erkennt die Aufnahme mit und ohne Kennung', () => {
    expect(matchRoute('/dashboard/aufnahme*', '/dashboard/aufnahme')).toBe(true);
    expect(matchRoute('/dashboard/aufnahme*', '/dashboard/aufnahme/123')).toBe(true);
    expect(matchRoute('/dashboard/aufnahme*', '/dashboard/aufnahmen')).toBe(false);
    expect(matchRoute('/dashboard/aufnahme*', '/dashboard')).toBe(false);
  });

  it('macht aus einem Muster eine Adresse zum Hinnavigieren', () => {
    expect(concretePath('/dashboard/aufnahme*')).toBe('/dashboard/aufnahme');
    expect(concretePath('/dashboard')).toBe('/dashboard');
  });

  it('liest den laufenden Rundgang nur mit eigenen Schritten', () => {
    const store = (v: unknown) => ({ getItem: (k: string) => (k === CLIENT_GUIDE_STATE_KEY ? JSON.stringify(v) : null) });
    expect(readGuideState(store({ userId: 'u1', stepId: 'c-kind', paused: false }), 'u1', steps, CLIENT_GUIDE_STATE_KEY))
      .toEqual({ userId: 'u1', stepId: 'c-kind', paused: false });
    // Ein Headhunter-Schritt gilt hier nicht.
    expect(readGuideState(store({ userId: 'u1', stepId: 'filters', paused: false }), 'u1', steps, CLIENT_GUIDE_STATE_KEY)).toBeNull();
  });
});

describe('Kunden-Rundgang: gesehen', () => {
  it('merkt sich im Konto und im Browser', () => {
    expect(clientTourSeen(null, null)).toBe(true);
    expect(clientTourSeen({ id: 'u1', user_metadata: { [CLIENT_TOUR_SEEN_KEY]: '2026-09-24' } }, null)).toBe(true);
    expect(clientTourSeen({ id: 'u1', user_metadata: {} }, { getItem: (k: string) => (k === clientTourStorageKey('u1') ? 'x' : null) })).toBe(true);
    expect(clientTourSeen({ id: 'u1', user_metadata: {} }, { getItem: () => null })).toBe(false);
  });
});


describe('Kunden-Rundgang für alle, die schon eine Position aufgenommen haben', () => {
  const steps = CLIENT_GUIDE_STEPS_WITH_POSITION;

  it('legt keine Stelle mehr an und führt nie in die Aufnahme', () => {
    expect(steps.some(s => s.route.includes('aufnahme') || s.click?.to?.includes('aufnahme') || s.target?.includes('intake.') || s.target?.includes('client.entry'))).toBe(false);
    expect(steps.length).toBeLessThan(ALLE_SCHRITTE.length);
  });

  it('kann durchlaufen: Kein Schritt wartet darauf, dass der Kunde erst etwas einreicht oder ausfüllt', () => {
    for (const s of steps) {
      expect(s.hold).toBeUndefined();
      expect(s.holdWhile).toBeUndefined();
      expect(s.wait).toBeUndefined();
    }
  });

  it('überspringt die Entscheidungs-Kachel, wenn sie im Wartezustand fehlt, und zeigt sonst Beispiele', () => {
    expect(steps.find(s => s.id === 'c-decide')?.autoSkip).toBe(true);
    expect(steps.find(s => s.id === 'c-jobs')).toMatchObject({ example: 'clientStatus', exampleWhenMissing: true });
    expect(steps.find(s => s.id === 'c-candidates')?.example).toBe('clientCandidate');
  });

  it('verspricht zur Begrüßung keine erste Stelle und nummeriert die Kapitel lückenlos', () => {
    expect(steps[0].id).toBe('c-welcome');
    expect(steps[0].body).not.toContain('erste Stelle an');
    expect([...new Set(steps.map(s => s.chapter))]).toEqual([1, 2, 3]);
    expect(CLIENT_GUIDE_CHAPTERS_WITH_POSITION.length).toBe(3);
    expect(steps.at(-1)?.id).toBe('c-done');
  });

  it('lässt den Rundgang für Kunden ohne Position unverändert', () => {
    expect(ALLE_SCHRITTE.some(s => s.id === 'c-start' && s.click?.to?.includes('aufnahme'))).toBe(true);
  });
});
