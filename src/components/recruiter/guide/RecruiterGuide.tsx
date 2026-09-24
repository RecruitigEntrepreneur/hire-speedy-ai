import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { concretePath, GUIDE_CHAPTERS, GUIDE_STATE_KEY, GUIDE_STEPS, matchRoute, readGuideState, TOUR_SEEN_KEY, tourSeen, tourStorageKey, type GuideState, type GuideStep } from '@/lib/recruiterGuide';
import { CLIENT_GUIDE_CHAPTERS, CLIENT_GUIDE_STATE_KEY, CLIENT_GUIDE_STEPS, CLIENT_TOUR_SEEN_KEY, clientTourSeen, clientTourStorageKey } from '@/lib/clientGuide';
import { GuideOverlay, GuidePausePill, RECRUITER_GUIDE_TEXTS, type GuideTexts } from './GuideOverlay';
import { useGuideTarget } from './useGuideTarget';

export interface GuideIdentity { userId: string; firstName?: string }
interface GuideApi {
  /** Rundgang von vorn, etwa über den Knopf im Dashboard. */
  start: () => void;
  /** Beim ersten Besuch im Dashboard: startet nur, wenn der Rundgang noch nie lief. */
  offer: () => void;
}
const NOOP: GuideApi = { start: () => undefined, offer: () => undefined };
const GuideContext = createContext<GuideApi>(NOOP);
export const useRecruiterGuide = () => useContext(GuideContext);
/** Eigener Kontext: sonst sähe das Headhunter-Dashboard den Kunden-Rundgang, sobald beide Provider verschachtelt sind. */
const ClientGuideContext = createContext<GuideApi>(NOOP);
export const useClientGuide = () => useContext(ClientGuideContext);

/** Was einen Rundgang ausmacht -- Technik und Einblendung sind für alle gleich. */
export interface GuideConfig {
  steps: GuideStep[];
  chapters: readonly string[];
  /** Speicherort des laufenden Rundgangs im Tab. */
  stateKey: string;
  /** Nur in diesem Bereich erscheint der Rundgang. */
  inWorkspace: (path: string) => boolean;
  texts: GuideTexts;
  /** Ziel des Hauptknopfs im letzten Schritt. */
  finalTo: string;
  context: React.Context<GuideApi>;
}

const tabStorage = () => { try { return window.sessionStorage; } catch { return null; } };
const browserStorage = () => { try { return window.localStorage; } catch { return null; } };
const persist = (key: string, state: GuideState | null) => {
  try { if (state) tabStorage()?.setItem(key, JSON.stringify(state)); else tabStorage()?.removeItem(key); } catch { /* nur Komfort */ }
};
const isDynamic = (route: string) => route.includes(':');

export const RECRUITER_GUIDE: GuideConfig = {
  steps: GUIDE_STEPS,
  chapters: GUIDE_CHAPTERS,
  stateKey: GUIDE_STATE_KEY,
  /** Nur im Arbeitsbereich; Onboarding und Einladung bleiben frei. */
  inWorkspace: (path) => path.startsWith('/recruiter') && !/^\/recruiter\/(onboarding|invitation)/.test(path),
  texts: RECRUITER_GUIDE_TEXTS,
  finalTo: '/recruiter/jobs',
  context: GuideContext,
};

export const CLIENT_GUIDE: GuideConfig = {
  steps: CLIENT_GUIDE_STEPS,
  chapters: CLIENT_GUIDE_CHAPTERS,
  stateKey: CLIENT_GUIDE_STATE_KEY,
  inWorkspace: (path) => path === '/dashboard' || path.startsWith('/dashboard/'),
  texts: {
    yourTurn: 'Sie sind dran: Klicken Sie auf die markierte Stelle.',
    start: "Los geht's",
    skip: 'Überspringen',
    finish: 'Fertig',
    paused: 'Rundgang pausiert',
    resume: 'Fortsetzen',
    finalCta: 'Zum Dashboard',
  },
  finalTo: '/dashboard',
  context: ClientGuideContext,
};

/**
 * Steuert den begleiteten Rundgang über Seitenwechsel hinweg. Wer die Identität
 * liefert, entscheidet der Aufrufer: die App aus der Anmeldung, die Vorschau aus
 * Beispieldaten.
 */
export function RecruiterGuideProvider(props: {
  identity: GuideIdentity | null; isSeen: () => boolean; onFinished: () => void; children: ReactNode;
}) {
  return <GuideProvider config={RECRUITER_GUIDE} {...props} />;
}

export function GuideProvider({ config, identity, isSeen, onFinished, children }: {
  config: GuideConfig; identity: GuideIdentity | null; isSeen: () => boolean; onFinished: () => void; children: ReactNode;
}) {
  const { steps: allSteps, stateKey, inWorkspace } = config;
  const Context = config.context;
  const location = useLocation();
  const navigate = useNavigate();
  const [state, setState] = useState<GuideState | null>(null);
  const [width, setWidth] = useState(() => window.innerWidth);
  const offered = useRef(false);
  /** Ziel einer eigenen Navigation; bis sie ankommt, wertet der Abgleich die alte Adresse nicht aus. */
  const pendingPath = useRef<string | null>(null);
  const userId = identity?.userId;

  useEffect(() => {
    offered.current = false;
    setState(userId ? readGuideState(tabStorage(), userId, allSteps, stateKey) : null);
  }, [userId, allSteps, stateKey]);

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const steps = useMemo(() => allSteps.filter(s => !s.minWidth || width >= s.minWidth), [allSteps, width]);
  // Fällt der gespeicherte Schritt bei dieser Breite weg, gilt der nächste sichtbare.
  const index = useMemo(() => {
    if (!state) return -1;
    const next = allSteps.slice(Math.max(allSteps.findIndex(s => s.id === state.stepId), 0)).find(s => steps.includes(s));
    return next ? steps.indexOf(next) : steps.length - 1;
  }, [state, steps, allSteps]);
  const step: GuideStep | null = index >= 0 ? steps[index] : null;

  const update = useCallback((next: GuideState | null) => { setState(next); persist(stateKey, next); }, [stateKey]);
  const finish = useCallback(() => { pendingPath.current = null; update(null); onFinished(); }, [update, onFinished]);
  const go = useCallback((path: string) => {
    if (location.pathname === path) return;
    pendingPath.current = path;
    navigate(path);
  }, [location.pathname, navigate]);

  /** `selbst`: der Nutzer hat „Fortsetzen“ geklickt -- dann führt auch ein Halte-Schritt hin. */
  const goTo = useCallback((i: number, direction: 1 | -1 = 1, selbst = false) => {
    if (!state) return;
    const pathOf = (s: GuideStep) => (isDynamic(s.route) ? state.jobPath ?? null : concretePath(s.route));
    let j = i;
    // Eine Seite mit Kennung ohne bekannten Pfad (etwa nach Neuladen) wird übersprungen.
    while (steps[j] && !pathOf(steps[j])) j += direction;
    const target = steps[j];
    if (!target) { if (direction > 0) finish(); return; }
    const dort = matchRoute(target.route, location.pathname);
    // Ein Halte-Schritt wartet, bis der Nutzer selbst ankommt (etwa nach dem
    // Einreichen) -- ein Seitenwechsel mitten in der Aufnahme schlösse sie.
    if (target.hold && !dort && direction > 0 && !selbst) { update({ ...state, stepId: target.id, paused: true }); return; }
    update({ ...state, stepId: target.id, paused: false });
    if (!dort) go(pathOf(target)!);
  }, [state, steps, update, finish, go, location.pathname]);

  // Adresse und Schritt abgleichen: angekommen, weitergeklickt oder abgebogen.
  useEffect(() => {
    if (!state || !step) return;
    const path = location.pathname;
    if (pendingPath.current) {
      if (path !== pendingPath.current) return;
      pendingPath.current = null;
    }
    if (matchRoute(step.route, path)) {
      const jobPath = isDynamic(step.route) ? path : state.jobPath;
      if (state.paused || state.stepId !== step.id || jobPath !== state.jobPath) update({ ...state, stepId: step.id, paused: false, jobPath });
      return;
    }
    if (step.click?.to && matchRoute(step.click.to, path)) {
      const next = steps[index + 1];
      if (!next) { finish(); return; }
      update({ ...state, stepId: next.id, paused: false, jobPath: isDynamic(step.click.to) ? path : state.jobPath });
      return;
    }
    if (!state.paused) update({ ...state, paused: true });
  }, [location.pathname, state, step, index, steps, update, finish]);

  const active = !!state && !!identity && !!step && inWorkspace(location.pathname);
  const showing = active && !state!.paused;
  const target = useGuideTarget(showing ? step!.target : undefined, step?.id ?? '');
  const clickable = showing && !!step!.click && !step!.lockTarget && !!target.el && width >= (step!.click!.minWidth ?? 0);
  const missing = !!step?.target && !target.el && !target.waiting;
  /* Warte-Schritte: bis das Ziel entsteht, keine Karte, nur ein Hinweis.
     Überspring-Schritte: ohne Ziel gar nichts zeigen, gleich weiter. */
  const waitingForUser = showing && !!step!.wait && !target.el;
  const cardVisible = showing && !waitingForUser && !(step!.autoSkip && !target.el);

  useEffect(() => {
    if (showing && step?.autoSkip && missing) goTo(index + 1);
  }, [showing, step, missing, goTo, index]);

  // Klick-Schritte ohne Seitenwechsel (Vorschau öffnen): weiter, sobald geklickt wurde.
  useEffect(() => {
    if (!clickable || !step?.click || step.click.to || !target.el) return;
    const el = target.el;
    let timer = 0;
    const onClick = () => { timer = window.setTimeout(() => goTo(index + 1), 350); };
    el.addEventListener('click', onClick);
    return () => { el.removeEventListener('click', onClick); window.clearTimeout(timer); };
  }, [clickable, step, target.el, index, goTo]);

  const next = useCallback(() => {
    if (step?.skipWhenMissing && missing) {
      const j = steps.findIndex(s => s.id === step.skipWhenMissing);
      if (j >= 0) { goTo(j); return; }
    }
    goTo(index + 1);
  }, [step, missing, steps, index, goTo]);

  const act = useCallback(() => {
    const to = step?.click?.to;
    if (!step?.click) return;
    if (!to) { if (clickable && target.el) target.el.click(); else goTo(index + 1); return; }
    if (!isDynamic(to)) { navigate(concretePath(to)); return; }
    const id = document.querySelector<HTMLElement>('[data-job-id]')?.dataset.jobId;
    if (id) { navigate(to.replace(':id', encodeURIComponent(id))); return; }
    // Ohne Position kein Briefing: weiter zum ersten Schritt nach den Briefing-Seiten.
    const j = steps.findIndex((s, k) => k > index && !isDynamic(s.route));
    goTo(j >= 0 ? j : steps.length);
  }, [step, clickable, target.el, goTo, index, navigate, steps]);

  const start = useCallback(() => {
    if (!userId) return;
    offered.current = true;
    update({ userId, stepId: allSteps[0].id, paused: false });
    go(concretePath(allSteps[0].route));
  }, [userId, update, go, allSteps]);

  const offer = useCallback(() => {
    if (!userId || offered.current || state || isSeen()) return;
    offered.current = true;
    window.setTimeout(() => update({ userId, stepId: allSteps[0].id, paused: false }), 500);
  }, [userId, state, isSeen, update, allSteps]);

  const api = useMemo(() => ({ start, offer }), [start, offer]);

  const holdHere = !!step?.hold && !!step.holdWhile && matchRoute(step.holdWhile, location.pathname);
  return <Context.Provider value={api}>
    {children}
    {cardVisible && <GuideOverlay
      step={step!}
      stepNumber={index + 1}
      stepCount={steps.length}
      firstName={identity!.firstName}
      target={target}
      clickable={clickable}
      onNext={next}
      onBack={index > 0 ? () => goTo(index - 1, -1) : null}
      onClose={finish}
      onAct={act}
      onOpenJobs={() => { finish(); navigate(config.finalTo); }}
      chapters={config.chapters}
      texts={config.texts}
    />}
    {waitingForUser && <GuidePausePill text={step!.wait} onClose={finish} />}
    {active && state!.paused && <GuidePausePill
      text={step!.hold ?? config.texts.paused}
      resumeLabel={config.texts.resume}
      onResume={holdHere ? undefined : () => goTo(index, 1, true)}
      onClose={finish}
    />}
  </Context.Provider>;
}

const firstNameOf = (user: User) => {
  const name = String(user.user_metadata?.full_name ?? '').trim();
  return name && !name.includes('@') ? name.split(/\s+/)[0] : undefined;
};

/** Anbindung an die Anmeldung: nur für Headhunter; „gesehen“ steht im Konto und im Browser. */
export function AppRecruiterGuide({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const fullName = user?.user_metadata?.full_name;
  const identity = useMemo(() => (user && role === 'recruiter' ? { userId: user.id, firstName: firstNameOf(user) } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu nur bei anderem Konto oder Namen, nicht bei jedem Token-Refresh
    [user?.id, role, fullName]);
  const isSeen = useCallback(() => tourSeen(user, browserStorage()), [user]);
  const onFinished = useCallback(() => {
    if (!user) return;
    const at = new Date().toISOString();
    try { browserStorage()?.setItem(tourStorageKey(user.id), at); } catch { /* Rückfallebene, nur Komfort */ }
    if (!user.user_metadata?.[TOUR_SEEN_KEY]) {
      void supabase.auth.updateUser({ data: { [TOUR_SEEN_KEY]: at } }).then(({ error }) => {
        if (error) console.warn('[recruiter-guide] Merker im Konto nicht gespeichert', error.message);
      });
    }
  }, [user]);
  return <RecruiterGuideProvider identity={identity} isSeen={isSeen} onFinished={onFinished}>{children}</RecruiterGuideProvider>;
}

/**
 * Anbindung für Kunden: derselbe Rundgang-Mechanismus, eigene Schritte
 * (lib/clientGuide.ts), eigener Merker. Ohne Vornamen in der Begrüßung --
 * Kunden siezen wir.
 */
export function AppClientGuide({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const identity = useMemo(() => (user && role === 'client' ? { userId: user.id } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu nur bei anderem Konto, nicht bei jedem Token-Refresh
    [user?.id, role]);
  const isSeen = useCallback(() => clientTourSeen(user, browserStorage()), [user]);
  const onFinished = useCallback(() => {
    if (!user) return;
    const at = new Date().toISOString();
    try { browserStorage()?.setItem(clientTourStorageKey(user.id), at); } catch { /* Rückfallebene, nur Komfort */ }
    if (!user.user_metadata?.[CLIENT_TOUR_SEEN_KEY]) {
      void supabase.auth.updateUser({ data: { [CLIENT_TOUR_SEEN_KEY]: at } }).then(({ error }) => {
        if (error) console.warn('[client-guide] Merker im Konto nicht gespeichert', error.message);
      });
    }
  }, [user]);
  return <GuideProvider config={CLIENT_GUIDE} identity={identity} isSeen={isSeen} onFinished={onFinished}>{children}</GuideProvider>;
}
