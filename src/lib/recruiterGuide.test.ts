import { describe, expect, it } from 'vitest';
import { GUIDE_STATE_KEY, matchRoute, placeCard, readGuideState, TOUR_POSTPONED_KEY, TOUR_SEEN_KEY, tourPostponedStorageKey, tourSeen, tourSettled, tourStorageKey, unionRect } from './recruiterGuide';
import { recruiterGuideSteps } from './recruiterTour';

const viewport = { width: 1280, height: 800 };
const card = { width: 360, height: 240 };

describe('Begleiteter Rundgang: Seiten', () => {
  it('erkennt Seiten auch mit Kennung im Pfad', () => {
    expect(matchRoute('/recruiter/jobs/:id', '/recruiter/jobs/5f2c')).toBe(true);
    expect(matchRoute('/recruiter/jobs/:id', '/recruiter/jobs')).toBe(false);
    expect(matchRoute('/recruiter/jobs', '/recruiter/jobs/')).toBe(true);
    expect(matchRoute('/recruiter', '/recruiter/jobs')).toBe(false);
  });
});

describe('Begleiteter Rundgang: Platzierung', () => {
  it('fasst mehrere sichtbare Ziele zusammen und ignoriert versteckte', () => {
    expect(unionRect([{ top: 100, left: 16, width: 224, height: 36 }, { top: 140, left: 16, width: 224, height: 36 }]))
      .toEqual({ top: 100, left: 16, width: 224, height: 76 });
    expect(unionRect([{ top: 0, left: 0, width: 0, height: 0 }])).toBeNull();
  });

  it('stellt die Karte rechts neben den Menüpunkt und hält sie im Bild', () => {
    expect(placeCard({ top: 200, left: 16, width: 224, height: 36 }, card, viewport)).toEqual({ side: 'right', left: 256, top: 98 });
    expect(placeCard({ top: 4, left: 16, width: 224, height: 36 }, card, viewport).top).toBe(16);
  });

  it('weicht nach unten, links und oben aus', () => {
    expect(placeCard({ top: 100, left: 900, width: 300, height: 40 }, card, viewport)).toEqual({ side: 'bottom', top: 156, left: 900 });
    expect(placeCard({ top: 100, left: 1000, width: 260, height: 40 }, card, viewport)).toEqual({ side: 'bottom', top: 156, left: 904 });
    expect(placeCard({ top: 600, left: 1000, width: 260, height: 100 }, card, viewport).side).toBe('left');
    expect(placeCard({ top: 600, left: 100, width: 1100, height: 150 }, card, viewport)).toEqual({ side: 'top', top: 344, left: 100 });
  });

  it('legt die Karte bei großen Zielen in die freiere Hälfte und sonst in die Mitte', () => {
    expect(placeCard({ top: 80, left: 20, width: 1240, height: 700 }, card, viewport)).toEqual({ side: 'center', top: 16, left: 460 });
    expect(placeCard(null, card, { width: 375, height: 700 })).toEqual({ side: 'center', top: 230, left: 16 });
  });

  it('bleibt im Schritt auf ihrer Seite, solange sie dort passt, statt bei jeder Verschiebung zu springen', () => {
    // Rechts passt nach einer kleinen Verschiebung nicht mehr ganz: ohne Vorgabe ginge es nach unten.
    expect(placeCard({ top: 100, left: 900, width: 300, height: 40 }, card, viewport).side).toBe('bottom');
    expect(placeCard({ top: 300, left: 100, width: 300, height: 40 }, card, viewport, 'bottom').side).toBe('bottom');
    expect(placeCard({ top: 300, left: 100, width: 300, height: 40 }, card, viewport).side).toBe('right');
    // Passt die bisherige Seite nicht mehr, gilt die normale Reihenfolge.
    expect(placeCard({ top: 600, left: 1000, width: 260, height: 100 }, card, viewport, 'bottom').side).toBe('left');
  });
});

describe('Begleiteter Rundgang: Merker', () => {
  it('merkt sich den Rundgang im Konto, sonst im Browser', () => {
    const user = { id: 'u1', user_metadata: {} };
    const empty = { getItem: () => null };
    expect(tourSeen(user, empty)).toBe(false);
    expect(tourSeen({ ...user, user_metadata: { [TOUR_SEEN_KEY]: '2026-09-21T10:00:00Z' } }, empty)).toBe(true);
    expect(tourSeen(user, { getItem: key => (key === tourStorageKey('u1') ? '2026-09-21' : null) })).toBe(true);
    expect(tourSeen(user, { getItem: () => { throw new Error('blocked'); } })).toBe(false);
    expect(tourSeen(null, empty)).toBe(true);
  });

  it('„Später“ hält den Rundgang an, ohne ihn abzuhaken', () => {
    const user = { id: 'u1', user_metadata: {} };
    const empty = { getItem: () => null };
    expect(tourSettled(user, empty)).toBe(false);
    expect(tourSettled({ ...user, user_metadata: { [TOUR_POSTPONED_KEY]: '2026-11-17' } }, empty)).toBe(true);
    expect(tourSeen({ ...user, user_metadata: { [TOUR_POSTPONED_KEY]: '2026-11-17' } }, empty)).toBe(false);
    expect(tourSettled(user, { getItem: key => (key === tourPostponedStorageKey('u1') ? '2026-11-17' : null) })).toBe(true);
  });

  it('der alte Merker gilt nicht mehr: Wer den alten Rundgang sah, bekommt den neuen einmal', () => {
    expect(tourSeen({ id: 'u1', user_metadata: { recruiter_tour_seen_at: '2026-09-21' } }, { getItem: () => null })).toBe(false);
  });

  it('setzt nur einen eigenen, gültigen Stand fort', () => {
    const steps = recruiterGuideSteps();
    const store = (value: unknown) => ({ getItem: (key: string) => (key === GUIDE_STATE_KEY ? JSON.stringify(value) : null) });
    expect(readGuideState(store({ userId: 'u1', stepId: 'h-jobs', paused: false }), 'u1', steps)).toEqual({ userId: 'u1', stepId: 'h-jobs', paused: false });
    expect(readGuideState(store({ userId: 'u2', stepId: 'h-jobs' }), 'u1', steps)).toBeNull();
    expect(readGuideState(store({ userId: 'u1', stepId: 'filters' }), 'u1', steps)).toBeNull();
    expect(readGuideState(store({ userId: 'u1', stepId: 'h-jobs', jobPath: '/recruiter/jobs/abc' }), 'u1', steps)?.jobPath).toBe('/recruiter/jobs/abc');
    expect(readGuideState(store({ userId: 'u1', stepId: 'h-jobs', jobPath: 'https://evil.example' }), 'u1', steps)?.jobPath).toBeUndefined();
    expect(readGuideState({ getItem: () => '{kaputt' }, 'u1', steps)).toBeNull();
  });
});
