import { useSyncExternalStore } from 'react';

/**
 * Vorführungen im Rundgang (16.11.2026, Marko: „Ein Zeiger zeigt den Klick einmal vor, der
 * Knopf pulsiert, dann klickt der Kunde selbst“). Ein Schritt kann
 *   1. ein Fenster sichtbar ausfüllen lassen (`fillArea`, die Bühne tippt und klickt),
 *   2. danach den Klick mit dem Zeiger vormachen (`show`),
 * und erst dann ist der Nutzer dran. Jede Vorführung läuft einmal je Rundgang, nicht bei
 * „weniger Bewegung“ und nicht am Handy; „Weiter“ während der Vorführung überspringt sie.
 *
 * Kleiner Speicher außerhalb von React, damit Motor (RecruiterGuide), Karte (GuideOverlay)
 * und Bühne (ClientTour) denselben Stand sehen.
 */

export type DemoPhase = 'wait' | 'filling' | 'pointing' | 'done';

export interface DemoPointer { x: number; y: number; visible: boolean; /** zählt Antipper hoch */ taps: number; /** ohne Gleiten setzen */ jump: boolean; /** Schild am Zeiger */ label: string | null }

interface DemoState {
  stepId: string | null;
  phase: DemoPhase;
  plan: { fill: boolean; point: boolean };
  /** Schritt, dessen Karte gerade sichtbar ist. */
  ready: string | null;
  pointer: DemoPointer;
}

let state: DemoState = {
  stepId: null, phase: 'done', plan: { fill: false, point: false }, ready: null,
  pointer: { x: 0, y: 0, visible: false, taps: 0, jump: true, label: null },
};
const listeners = new Set<() => void>();
const set = (patch: Partial<DemoState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
const setPointer = (patch: Partial<DemoPointer>) => set({ pointer: { ...state.pointer, ...patch } });
/** Schritte, die in diesem Rundgang schon vorgeführt wurden. */
const shown = new Set<string>();
/** Wechselt mit jedem Schritt: Laufende Vorführungen alter Schritte hören damit auf. */
let token = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms); });
/** Gleitzeit des Zeigers, passend zu GuidePointer. */
export const POINTER_MS = 650;

/** Mit Bewegung: breit genug und nicht „weniger Bewegung“. */
export function motionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 768 && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Knöpfe in der Mitte, große Blöcke an ihrer Überschrift (nicht mitten im Inhalt). */
const centerOf = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + Math.min(r.width * 0.5, 60), y: r.top + Math.min(r.height * 0.6, 24) };
};

export const guideDemo = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  get: () => state,

  /** Wird dieser Schritt vorgeführt? Fragt die Bühne beim Betreten, bevor sie ausfüllt. */
  willAnimate: (stepId: string) => !shown.has(stepId) && motionAllowed(),

  /** Neuer Schritt (Motor). Ohne Vorführung ist der Nutzer sofort dran. */
  enter(stepId: string, plan: { fill: boolean; point: boolean }) {
    if (state.stepId === stepId) return;
    token += 1;
    const animate = (plan.fill || plan.point) && guideDemo.willAnimate(stepId);
    set({ stepId, plan, phase: animate ? 'wait' : 'done', ready: null, pointer: { ...state.pointer, visible: false } });
  },

  /** Die Karte des Schritts ist sichtbar (Karte): Jetzt beginnt die Vorführung. */
  ready(stepId: string) {
    if (state.stepId !== stepId || state.ready === stepId) return;
    const phase: DemoPhase = state.phase !== 'wait' ? state.phase : state.plan.fill ? 'filling' : state.plan.point ? 'pointing' : 'done';
    set({ ready: stepId, phase });
  },

  /** Die Bühne hat das Fenster ausgefüllt. */
  filled(stepId: string) {
    if (state.stepId !== stepId || state.phase !== 'filling') return;
    if (!state.plan.point) shown.add(stepId);
    set({ phase: state.plan.point ? 'pointing' : 'done' });
  },

  /** Der Zeiger hat den Klick vorgemacht. Mit `keep` bleibt er sichtbar am Ziel stehen. */
  pointed(stepId: string, keep = false) {
    if (state.stepId !== stepId || state.phase !== 'pointing') return;
    shown.add(stepId);
    set({ phase: 'done', pointer: keep ? state.pointer : { ...state.pointer, visible: false } });
  },

  /** „Weiter“ während der Vorführung: sofort fertig, der Nutzer ist dran. */
  skip(stepId: string) {
    if (state.stepId !== stepId || state.phase === 'done') return;
    token += 1;
    shown.add(stepId);
    set({ phase: 'done', pointer: { ...state.pointer, visible: false } });
  },

  /** Ein besonderer Moment (Freigabe, Besetzt) lief: nicht noch einmal. */
  markShown(stepId: string) { shown.add(stepId); },

  /** Neuer Rundgang: alles wieder einmal vorführen. */
  reset() { shown.clear(); token += 1; set({ stepId: null, phase: 'done', ready: null, pointer: { ...state.pointer, visible: false } }); },

  /** Für Abläufe: Gilt der Lauf, der mit `token()` begann, noch? */
  token: () => token,
  alive: (t: number) => t === token,

  pointer: {
    /** Ohne Gleiten an eine Stelle setzen und zeigen. */
    place(x: number, y: number) {
      setPointer({ x, y, visible: true, jump: true });
    },
    /** Zum Element gleiten; wartet, bis der Zeiger dort ist. Mit `label` steht dort ein Schild. */
    async to(el: Element, t: number, label: string | null = null) {
      if (!guideDemo.alive(t)) return;
      const { x, y } = centerOf(el);
      setPointer({ x, y, visible: true, jump: false, label: null });
      await sleep(POINTER_MS + 60);
      if (label && guideDemo.alive(t)) setPointer({ label });
    },
    /** Antippen (nur zu sehen, klickt nichts). */
    async tap(t: number) {
      if (!guideDemo.alive(t)) return;
      setPointer({ taps: state.pointer.taps + 1 });
      await sleep(320);
    },
    hide() { setPointer({ visible: false, label: null }); },
  },
  sleep,
};

export function useGuideDemo(): DemoState {
  return useSyncExternalStore(guideDemo.subscribe, guideDemo.get, guideDemo.get);
}
