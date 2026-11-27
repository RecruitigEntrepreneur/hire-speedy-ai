import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import i18n from '@/i18n';
import { useAuth } from '@/lib/auth';
import {
  atStep, concretePath, GUIDE_STATE_KEY, matchRoute, nearestStepAt, readGuideState, TOUR_POSTPONED_KEY, TOUR_SEEN_KEY,
  tourPostponedStorageKey, tourSettled, tourStorageKey, type GuideState, type GuideStep,
} from '@/lib/recruiterGuide';
import { recruiterGuideChapters, recruiterGuideSteps } from '@/lib/recruiterTour';
import { useRecruiterAccess } from '@/components/verification/RecruiterAccessGate';
import {
  clientGuideChapters, clientGuideSteps, CLIENT_GUIDE_STATE_KEY, CLIENT_TOUR_POSTPONED_KEY, CLIENT_TOUR_SEEN_KEY,
  clientTourPostponedStorageKey, clientTourSettled, clientTourStorageKey, type ClientGuideContext,
} from '@/lib/clientGuide';
import { isContracting, stateOf } from '@/lib/clientDemo';
import { useClientWaiting } from '@/hooks/useClientWaiting';
import { ClientTourSourceContext, useClientTourJob } from '@/components/client/tour/tourData';
import { TourWelcome } from '@/components/client/tour/TourWelcome';
import { GuideOverlay, GuidePausePill, type GuideTextsKey } from './GuideOverlay';
import { useGuideTarget } from './useGuideTarget';
import { guideDemo, useGuideDemo } from './guideDemo';
import { useCookieBannerOpen } from '@/lib/cookieBanner';

export interface GuideIdentity { userId: string; firstName?: string }
interface GuideApi {
  /** Rundgang von vorn, etwa über den Knopf im Dashboard. */
  start: () => void;
  /** Beim ersten Besuch im Dashboard: startet nur, wenn der Rundgang noch nie lief. */
  offer: () => void;
  /** Der Rundgang läuft gerade, auch pausiert. Die Sperre im Wartezustand lässt ihn durch. */
  running: boolean;
  /** Der Schritt, der gerade dran ist (auch pausiert) -- die Beispiel-Bühne liest daraus ihr Bild. */
  step: GuideStep | null;
  /** Stelle des Schritts im Rundgang (-1 ohne Schritt): Die Bühne erkennt daran, ob es zurückging. */
  index: number;
  /** Rundgang beenden, wie das X der Karte. */
  stop: () => void;
}
const NOOP: GuideApi = { start: () => undefined, offer: () => undefined, running: false, step: null, index: -1, stop: () => undefined };
const GuideContext = createContext<GuideApi>(NOOP);
export const useRecruiterGuide = () => useContext(GuideContext);
/** Eigener Kontext: sonst sähe das Headhunter-Dashboard den Kunden-Rundgang, sobald beide Provider verschachtelt sind. */
const ClientGuideContext = createContext<GuideApi>(NOOP);
export const useClientGuide = () => useContext(ClientGuideContext);

/** Was einen Rundgang ausmacht -- Technik und Einblendung sind für alle gleich. */
export interface GuideConfig {
  steps: GuideStep[];
  /** Kapitelnamen, gelesen beim Zeichnen (Sprache der Oberfläche). */
  chapters: () => readonly string[];
  /** Speicherort des laufenden Rundgangs im Tab. */
  stateKey: string;
  /** Nur in diesem Bereich erscheint der Rundgang. */
  inWorkspace: (path: string) => boolean;
  /** Worte der Knöpfe: Headhunter (du) oder Kunde (Sie), Namespace `recruiterGuide`. */
  texts: GuideTextsKey;
  /** Ziel des Hauptknopfs im letzten Schritt. */
  finalTo: string;
  /** Beschriftung des Hauptknopfs im letzten Schritt (sonst `<texts>.finalCta`). */
  finalLabel?: () => string;
  context: React.Context<GuideApi>;
  /** Ein Fortschritts-Segment je Kapitel und „Inhalt“ zum Springen (Kunden-Rundgang). */
  chapterNav?: boolean;
  /** Zusätzlicher Inhalt in der Karte eines Schritts, etwa die eigene Stelle in der Begrüßung. */
  extra?: (step: GuideStep) => ReactNode;
}

const tabStorage = () => { try { return window.sessionStorage; } catch { return null; } };
const browserStorage = () => { try { return window.localStorage; } catch { return null; } };
const persist = (key: string, state: GuideState | null) => {
  try { if (state) tabStorage()?.setItem(key, JSON.stringify(state)); else tabStorage()?.removeItem(key); } catch { /* nur Komfort */ }
};
const isDynamic = (route: string) => route.includes(':');

export const RECRUITER_GUIDE: GuideConfig = {
  steps: recruiterGuideSteps(),
  chapters: recruiterGuideChapters,
  stateKey: GUIDE_STATE_KEY,
  /** Nur im Arbeitsbereich; Onboarding und Einladung bleiben frei. */
  inWorkspace: (path) => path.startsWith('/recruiter') && !/^\/recruiter\/(onboarding|invitation)/.test(path),
  texts: 'texts',
  finalTo: '/recruiter/jobs',
  context: GuideContext,
  chapterNav: true,
};

export const CLIENT_GUIDE: GuideConfig = {
  steps: clientGuideSteps({ jobId: null, state: 'none', contracting: false }),
  chapters: () => clientGuideChapters(false),
  stateKey: CLIENT_GUIDE_STATE_KEY,
  inWorkspace: (path) => path === '/dashboard' || path.startsWith('/dashboard/'),
  texts: 'clientTexts',
  finalTo: '/dashboard',
  context: ClientGuideContext,
  chapterNav: true,
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

export function GuideProvider({ config, identity, isSeen, onFinished, onPostpone, children }: {
  config: GuideConfig; identity: GuideIdentity | null; isSeen: () => boolean; onFinished: () => void;
  /** „Später“ im ersten Schritt: Rundgang zu, ohne ihn abzuhaken. Ohne Angabe heißt der Knopf „Überspringen“. */
  onPostpone?: () => void;
  children: ReactNode;
}) {
  const { steps: allSteps, stateKey, inWorkspace } = config;
  const Context = config.context;
  const location = useLocation();
  const navigate = useNavigate();
  /** POP: Browser-Zurück oder -Vor -- dann folgt der Rundgang der Adresse. */
  const navigationType = useNavigationType();
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
  /**
   * Hinführen; mit Suchteil (Reiter, Bühnenbild) zählt auch der. Der Verlaufseintrag merkt sich
   * den Schritt (`guideStep`), damit Browser-Zurück genau dorthin führt, auch wenn zwei
   * Schritte dieselbe Seite haben.
   */
  const go = useCallback((path: string, stepId?: string) => {
    if ((path.includes('?') ? location.pathname + location.search : location.pathname) === path) return;
    pendingPath.current = path;
    navigate(path, stepId ? { state: { guideStep: stepId } } : undefined);
  }, [location.pathname, location.search, navigate]);

  /** `selbst`: der Nutzer hat „Fortsetzen“ geklickt -- dann führt auch ein Halte-Schritt hin. */
  const goTo = useCallback((i: number, direction: 1 | -1 = 1, selbst = false) => {
    if (!state) return;
    const pathOf = (s: GuideStep) => s.path ?? (isDynamic(s.route) ? state.jobPath ?? null : concretePath(s.route));
    let j = i;
    // Eine Seite mit Kennung ohne bekannten Pfad (etwa nach Neuladen) wird übersprungen.
    while (steps[j] && !pathOf(steps[j])) j += direction;
    const target = steps[j];
    if (!target) { if (direction > 0) finish(); return; }
    const dort = atStep(target, location.pathname, location.search);
    // Ein Halte-Schritt wartet, bis der Nutzer selbst ankommt (etwa nach dem
    // Einreichen) -- ein Seitenwechsel mitten in der Aufnahme schlösse sie.
    if (target.hold && !dort && direction > 0 && !selbst) { update({ ...state, stepId: target.id, paused: true }); return; }
    update({ ...state, stepId: target.id, paused: false });
    // Jeder Schritt mit eigener Adresse (Reiter, Bühnenbild) bekommt einen Eintrag im Verlauf:
    // So führt auch das Zurück des Browsers einen Schritt zurück.
    if (!dort) go(pathOf(target)!, target.id);
  }, [state, steps, update, finish, go, location.pathname, location.search]);

  // Adresse und Schritt abgleichen: angekommen, weitergeklickt, zurückgegangen oder abgebogen.
  useEffect(() => {
    if (!state || !step) return;
    const path = location.pathname;
    const pending = pendingPath.current;
    if (pending) {
      if ((pending.includes('?') ? path + location.search : path) !== pending) return;
      pendingPath.current = null;
    }
    if (atStep(step, path, location.search)) {
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
    // Browser-Zurück/-Vor mitten im Rundgang: Er folgt der Adresse, statt anzuhalten.
    if (navigationType === 'POP' && !state.paused) {
      const remembered = (location.state as { guideStep?: string } | null)?.guideStep;
      const exact = remembered ? steps.findIndex(s => s.id === remembered && atStep(s, path, location.search)) : -1;
      const j = exact >= 0 ? exact : nearestStepAt(steps, index, path, location.search);
      if (j >= 0) {
        update({ ...state, stepId: steps[j].id, paused: false, jobPath: isDynamic(steps[j].route) ? path : state.jobPath });
        return;
      }
    }
    if (!state.paused) update({ ...state, paused: true });
  }, [location.pathname, location.search, location.state, navigationType, state, step, index, steps, update, finish]);

  const active = !!state && !!identity && !!step && inWorkspace(location.pathname);
  // Erst die Cookie-Frage, dann der Rundgang: Der Hinweis liegt unten über der Seite (lib/cookieBanner.ts).
  const cookieBannerOpen = useCookieBannerOpen();
  const showing = active && !state!.paused && !cookieBannerOpen;
  // Vorführung (guideDemo.ts): Beim Ausfüllen leuchtet der Bereich, danach das Ziel.
  const demo = useGuideDemo();
  useEffect(() => {
    if (showing && step) guideDemo.enter(step.id, { fill: !!step.fillArea, point: (!!step.show && !!step.click && !step.click.to) || !!step.points?.length });
  }, [showing, step]);
  const demoPhase = step && demo.stepId === step.id ? demo.phase : 'done';
  const onArea = (!!step?.fillArea && (demoPhase === 'wait' || demoPhase === 'filling'))
    || (!!step?.pointArea && (demoPhase === 'wait' || demoPhase === 'pointing'));
  const targetKey = `${step?.id ?? ''}${onArea ? ':area' : ''}`;
  const target = useGuideTarget(showing ? (onArea ? step!.fillArea ?? step!.pointArea : step!.target) : undefined, targetKey);
  const clickable = showing && demoPhase === 'done' && !onArea && !!step!.click && !step!.lockTarget && !!target.el && width >= (step!.click!.minWidth ?? 0);
  const missing = !!step?.target && !target.el && !target.waiting;
  /* Warte-Schritte: bis das Ziel entsteht, keine Karte, nur ein Hinweis.
     Überspring-Schritte: ohne Ziel gar nichts zeigen, gleich weiter. */
  const waitingForUser = showing && !!step!.wait && !target.el;
  const cardVisible = showing && !waitingForUser && !(step!.autoSkip && !target.el);

  useEffect(() => {
    if (showing && step?.autoSkip && missing) goTo(index + 1);
  }, [showing, step, missing, goTo, index]);

  // Klick-Schritte ohne Seitenwechsel (Vorschau öffnen): weiter, sobald geklickt wurde.
  // Verschwindet das Ziel durch den Klick selbst (Bühne wechselt die Seite), gilt der Klick
  // trotzdem: Der Schritt geht weiter, solange niemand inzwischen einen anderen gewählt hat.
  const stepIdNow = useRef<string | null>(null);
  stepIdNow.current = step?.id ?? null;
  useEffect(() => {
    if (!clickable || !step?.click || step.click.to || !target.el) return;
    const el = target.el;
    const clickedOn = step.id;
    let timer = 0;
    let clicked = false;
    const onClick = () => {
      clicked = true;
      // Nach „Senden“ bleibt die Bestätigung kurz stehen (`click.delay`), sonst geht es gleich weiter.
      timer = window.setTimeout(() => { if (stepIdNow.current === clickedOn) goTo(index + 1); }, step.click?.delay ?? 350);
    };
    el.addEventListener('click', onClick);
    return () => { el.removeEventListener('click', onClick); if (!clicked) window.clearTimeout(timer); };
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
    guideDemo.reset();
    update({ userId, stepId: allSteps[0].id, paused: false });
    go(allSteps[0].path ?? concretePath(allSteps[0].route), allSteps[0].id);
  }, [userId, update, go, allSteps]);

  const postpone = useCallback(() => { pendingPath.current = null; update(null); onPostpone?.(); }, [update, onPostpone]);

  /** „Inhalt“: an den Anfang eines Kapitels. */
  const jump = useCallback((chapter: number) => {
    const j = steps.findIndex(s => s.chapter === chapter);
    if (j >= 0 && j !== index) goTo(j, j < index ? -1 : 1, true);
  }, [steps, index, goTo]);

  /** Fortschritt je Kapitel: fertige voll, das aktuelle anteilig, spätere leer. */
  const segments = useMemo(() => {
    if (!config.chapterNav || !step) return undefined;
    return config.chapters().map((_, i) => {
      const inChapter = steps.filter(s => s.chapter === i + 1);
      if (i + 1 < step.chapter) return 1;
      if (i + 1 > step.chapter || !inChapter.length) return 0;
      return (inChapter.indexOf(step) + 1) / inChapter.length;
    });
  }, [config, steps, step]);

  const offer = useCallback(() => {
    if (!userId || offered.current || state || isSeen()) return;
    offered.current = true;
    window.setTimeout(() => update({ userId, stepId: allSteps[0].id, paused: false }), 500);
  }, [userId, state, isSeen, update, allSteps]);

  const running = !!state;
  const api = useMemo(() => ({ start, offer, running, step: running ? step : null, index: running && step ? index : -1, stop: finish }), [start, offer, running, step, index, finish]);

  const holdHere = !!step?.hold && !!step.holdWhile && matchRoute(step.holdWhile, location.pathname);
  return <Context.Provider value={api}>
    {children}
    {/* Eigene Grenze: Die Texte des Rundgangs laden erst, wenn er läuft, ohne die Seite darunter auszublenden. */}
    <Suspense fallback={null}>
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
      segments={segments}
      onJump={config.chapterNav ? jump : undefined}
      onPostpone={onPostpone ? postpone : undefined}
      extra={config.extra?.(step!)}
      finalLabel={config.finalLabel?.()}
      targetKey={targetKey}
      demoPhase={demoPhase}
      onSkipDemo={() => guideDemo.skip(step!.id)}
    />}
    {waitingForUser && <GuidePausePill text={step!.wait} texts={config.texts} onClose={finish} />}
    {active && state!.paused && <GuidePausePill
      text={step!.hold}
      texts={config.texts}
      onResume={holdHere ? undefined : () => goTo(index, 1, true)}
      onClose={finish}
    />}
    </Suspense>
  </Context.Provider>;
}

const firstNameOf = (user: User) => {
  const name = String(user.user_metadata?.full_name ?? '').trim();
  return name && !name.includes('@') ? name.split(/\s+/)[0] : undefined;
};

/**
 * Anbindung an die Anmeldung: nur für Headhunter; „gesehen“ steht im Konto und im Browser.
 * Rundgang an echten Seiten (17.11.2026, lib/recruiterTour.ts): startet einmal von selbst,
 * „Später“ verschiebt nur. Im Wartezustand sagt die Begrüßung, was bis zur Gegenzeichnung geht.
 */
export function AppRecruiterGuide({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const isRecruiter = !!user && role === 'recruiter';
  const access = useRecruiterAccess(isRecruiter);
  const waiting = isRecruiter && access.data?.pending === true;
  const fullName = user?.user_metadata?.full_name;
  const identity = useMemo(() => (isRecruiter ? { userId: user!.id, firstName: firstNameOf(user!) } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu nur bei anderem Konto oder Namen, nicht bei jedem Token-Refresh
    [user?.id, isRecruiter, fullName]);
  const config = useMemo<GuideConfig>(() => ({ ...RECRUITER_GUIDE, steps: recruiterGuideSteps({ waiting }) }), [waiting]);
  const isSeen = useCallback(() => tourSettled(user, browserStorage()), [user]);
  const remember = useCallback((metaKey: string, storageKey: string) => {
    if (!user) return;
    const at = new Date().toISOString();
    try { browserStorage()?.setItem(storageKey, at); } catch { /* Rückfallebene, nur Komfort */ }
    if (!user.user_metadata?.[metaKey]) {
      void supabase.auth.updateUser({ data: { [metaKey]: at } }).then(({ error }) => {
        if (error) console.warn('[recruiter-guide] Merker im Konto nicht gespeichert', error.message);
      });
    }
  }, [user]);
  const onFinished = useCallback(() => { if (user) remember(TOUR_SEEN_KEY, tourStorageKey(user.id)); }, [user, remember]);
  const onPostpone = useCallback(() => { if (user) remember(TOUR_POSTPONED_KEY, tourPostponedStorageKey(user.id)); }, [user, remember]);
  return <GuideProvider config={config} identity={identity} isSeen={isSeen} onFinished={onFinished} onPostpone={onPostpone}>{children}</GuideProvider>;
}

/**
 * Anbindung für Kunden (Fassung 3, 16.11.2026): ein Weg an der EIGENEN Stelle, Kandidat bis
 * Einstellung am Beispiel (lib/clientGuide.ts, lib/clientDemo.ts). Die Schritte hängen an der
 * neuesten eingereichten Stelle: live, in Prüfung, Contracting -- oder es gibt noch keine.
 * Ohne Vornamen in der Begrüßung: Kunden siezen wir. „Später“ verschiebt nur.
 */
export function AppClientGuide({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const isClient = !!user && role === 'client';
  const { info, infoLoading } = useClientWaiting();
  const tourJob = useClientTourJob(isClient ? user!.id : null);
  const job = tourJob.data ?? null;
  const jobId = job?.id ?? null;
  const jobState = job ? stateOf(job.status) : 'none';
  const contracting = job ? isContracting(job.employment_type) : false;
  const waiting = !!info;
  const ctx = useMemo<ClientGuideContext>(() => ({ jobId, state: jobState, contracting, waiting }), [jobId, jobState, contracting, waiting]);
  const config = useMemo<GuideConfig>(() => {
    const live = !!ctx.jobId && ctx.state === 'live';
    const review = !!ctx.jobId && ctx.state === 'review';
    return {
      ...CLIENT_GUIDE,
      steps: clientGuideSteps(ctx),
      chapters: () => clientGuideChapters(ctx.contracting),
      finalTo: live ? `/dashboard/jobs/${ctx.jobId}` : review ? '/dashboard/jobs?tab=review' : '/dashboard',
      finalLabel: () => i18n.t(`clientGuide:ui.${live || review ? 'toMyJob' : 'toDashboard'}`),
      extra: (step) => (step.id === 'c-welcome' ? <TourWelcome /> : null),
    };
  }, [ctx]);
  const source = useMemo(() => ({ job, waitingTitle: info?.title ?? null }), [job, info?.title]);
  // Erst mit geladener Stelle: sonst begänne er am Beispiel und spränge dann um.
  const ready = !isClient || ((tourJob.isFetched || tourJob.isError) && !infoLoading);
  const identity = useMemo(() => (isClient && ready ? { userId: user!.id, firstName: firstNameOf(user!) } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- neu nur bei anderem Konto, nicht bei jedem Token-Refresh
    [user?.id, isClient, ready]);
  const isSeen = useCallback(() => clientTourSettled(user, browserStorage()), [user]);
  const remember = useCallback((metaKey: string, storageKey: (id: string) => string) => {
    if (!user) return;
    const at = new Date().toISOString();
    try { browserStorage()?.setItem(storageKey(user.id), at); } catch { /* Rückfallebene, nur Komfort */ }
    if (!user.user_metadata?.[metaKey]) {
      void supabase.auth.updateUser({ data: { [metaKey]: at } }).then(({ error }) => {
        if (error) console.warn('[client-guide] Merker im Konto nicht gespeichert', error.message);
      });
    }
  }, [user]);
  const onFinished = useCallback(() => remember(CLIENT_TOUR_SEEN_KEY, clientTourStorageKey), [remember]);
  const onPostpone = useCallback(() => remember(CLIENT_TOUR_POSTPONED_KEY, clientTourPostponedStorageKey), [remember]);
  return (
    <ClientTourSourceContext.Provider value={source}>
      <GuideProvider config={config} identity={identity} isSeen={isSeen} onFinished={onFinished} onPostpone={onPostpone}>{children}</GuideProvider>
    </ClientTourSourceContext.Provider>
  );
}
