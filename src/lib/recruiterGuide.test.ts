import { describe, expect, it } from 'vitest';
import { GUIDE_CHAPTERS, GUIDE_STATE_KEY, GUIDE_STEPS, matchRoute, placeCard, readGuideState, TOUR_SEEN_KEY, tourSeen, tourStorageKey, unionRect, visibleSteps } from './recruiterGuide';

const viewport = { width: 1280, height: 800 };
const card = { width: 360, height: 240 };

describe('Begleiteter Rundgang: Ablauf', () => {
  it('führt in sechs Kapiteln von der Begrüßung zum Abschluss, Kapitel für Kapitel', () => {
    expect(GUIDE_STEPS[0].id).toBe('welcome');
    expect(GUIDE_STEPS.at(-1)?.id).toBe('done');
    expect(new Set(GUIDE_STEPS.map(s => s.chapter))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(GUIDE_CHAPTERS).toHaveLength(6);
    const chapters = GUIDE_STEPS.map(s => s.chapter);
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    expect(new Set(GUIDE_STEPS.map(s => s.id)).size).toBe(GUIDE_STEPS.length);
  });

  it('lässt nichts Unumkehrbares anklicken', () => {
    for (const id of ['activate', 'jobSubmit', 'candidatesAdd']) {
      const step = GUIDE_STEPS.find(s => s.id === id)!;
      expect(step.lockTarget).toBe(true);
      expect(step.click).toBeUndefined();
    }
  });

  it('jeder Klick-Schritt führt auf die Seite des nächsten Schritts', () => {
    GUIDE_STEPS.forEach((step, i) => {
      if (!step.click?.to) return;
      expect(GUIDE_STEPS[i + 1].route).toBe(step.click.to);
    });
    const skip = GUIDE_STEPS.find(s => s.skipWhenMissing);
    expect(GUIDE_STEPS.some(s => s.id === skip?.skipWhenMissing)).toBe(true);
  });

  it('lässt Vorschau-Schritte auf schmalen Bildschirmen weg', () => {
    expect(visibleSteps(1280).map(s => s.id)).toContain('preview');
    expect(visibleSteps(800).map(s => s.id)).not.toContain('preview');
    expect(visibleSteps(800).map(s => s.id)).not.toContain('openPreview');
    expect(visibleSteps(375).map(s => s.id)).toContain('openBriefing');
  });

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

  it('setzt nur einen eigenen, gültigen Stand fort', () => {
    const store = (value: unknown) => ({ getItem: (key: string) => (key === GUIDE_STATE_KEY ? JSON.stringify(value) : null) });
    expect(readGuideState(store({ userId: 'u1', stepId: 'filters', paused: false }), 'u1')).toEqual({ userId: 'u1', stepId: 'filters', paused: false });
    expect(readGuideState(store({ userId: 'u2', stepId: 'filters' }), 'u1')).toBeNull();
    expect(readGuideState(store({ userId: 'u1', stepId: 'gibtsnicht' }), 'u1')).toBeNull();
    expect(readGuideState(store({ userId: 'u1', stepId: 'jobHeader', jobPath: '/recruiter/jobs/abc' }), 'u1')?.jobPath).toBe('/recruiter/jobs/abc');
    expect(readGuideState(store({ userId: 'u1', stepId: 'jobHeader', jobPath: 'https://evil.example' }), 'u1')?.jobPath).toBeUndefined();
    expect(readGuideState({ getItem: () => '{kaputt' }, 'u1')).toBeNull();
  });
});
