import { describe, expect, it } from 'vitest';
import { CLIENT_GUIDE_CHAPTERS, CLIENT_GUIDE_STATE_KEY, CLIENT_GUIDE_STEPS, CLIENT_TOUR_SEEN_KEY, clientTourSeen, clientTourStorageKey } from './clientGuide';
import { concretePath, matchRoute, readGuideState } from './recruiterGuide';

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
