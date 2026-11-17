import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { guideDemo } from '@/components/recruiter/guide/guideDemo';

/** Vorführungen im Rundgang (guideDemo.ts): einmal je Rundgang, nur mit Bewegung, überspringbar. */
describe('Vorführung: Zeiger und sichtbares Ausfüllen', () => {
  const screen = (width: number, reduce = false) => vi.stubGlobal('window', {
    innerWidth: width,
    matchMedia: () => ({ matches: reduce }),
    setTimeout: globalThis.setTimeout,
  });
  beforeEach(() => { screen(1366); guideDemo.reset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('füllt erst aus, macht dann den Klick vor, dann ist der Nutzer dran', () => {
    guideDemo.enter('c-offer', { fill: true, point: true });
    expect(guideDemo.get().phase).toBe('wait');
    guideDemo.ready('c-offer');
    expect(guideDemo.get().phase).toBe('filling');
    guideDemo.filled('c-offer');
    expect(guideDemo.get().phase).toBe('pointing');
    guideDemo.pointed('c-offer');
    expect(guideDemo.get().phase).toBe('done');
  });

  it('führt jeden Schritt nur einmal je Rundgang vor', () => {
    guideDemo.enter('c-request', { fill: false, point: true });
    guideDemo.ready('c-request');
    guideDemo.pointed('c-request');
    guideDemo.enter('c-invite', { fill: true, point: true });
    guideDemo.enter('c-request', { fill: false, point: true });
    expect(guideDemo.get().phase).toBe('done');
    guideDemo.reset();
    expect(guideDemo.willAnimate('c-request')).toBe(true);
  });

  it('„Weiter“ während der Vorführung überspringt sie und hält laufende Abläufe an', () => {
    guideDemo.enter('c-feedback', { fill: true, point: true });
    guideDemo.ready('c-feedback');
    const t = guideDemo.token();
    guideDemo.skip('c-feedback');
    expect(guideDemo.get().phase).toBe('done');
    expect(guideDemo.alive(t)).toBe(false);
    expect(guideDemo.willAnimate('c-feedback')).toBe(false);
  });

  it('zeigt am Handy und bei „weniger Bewegung“ nichts vor', () => {
    screen(390);
    guideDemo.enter('c-candidate', { fill: false, point: true });
    expect(guideDemo.get().phase).toBe('done');
    screen(1366, true);
    expect(guideDemo.willAnimate('c-request')).toBe(false);
  });

  it('ein Schritt ohne Vorführung ist sofort fertig', () => {
    guideDemo.enter('c-profile', { fill: false, point: false });
    expect(guideDemo.get().phase).toBe('done');
  });
});
