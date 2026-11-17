import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, ChevronRight, Compass, Eye, Hand, List, MousePointer2, MousePointerClick, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { guideChapters, placeCard, type CardPlacement, type GuideStep, type TourRect } from '@/lib/recruiterGuide';
import { GuideExampleView } from './GuideExamples';
import type { GuideTarget } from './useGuideTarget';
import { guideDemo, motionAllowed, POINTER_MS, useGuideDemo, type DemoPhase } from './guideDemo';

/** Abstand der Markierung um das Ziel. */
const PAD = 6;
// pointer-events-auto: Ein offenes modales Fenster (Aufnahme im Kunden-Dashboard)
// setzt pointer-events: none auf <body>. Ohne das liessen sich Karte und Abdeckung
// nicht anklicken, und Klicks fielen durch die Abdeckung auf das Fenster.
const DIM = 'pointer-events-auto fixed z-[100] bg-slate-950/60';

/** Die Worte des Rundgangs -- Headhunter duzen wir (`texts`), Kunden siezen wir (`clientTexts`). */
export type GuideTextsKey = 'texts' | 'clientTexts';

function useViewport() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/**
 * Klicks auf Karte und Abdeckung gehören dem Rundgang: Ein offenes Fenster darunter (etwa das
 * echte Anfrage-Fenster auf der Beispiel-Bühne) würde sie sonst als „Klick daneben“ lesen und
 * sich schließen. Der Druck endet deshalb hier und erreicht das Dokument nicht.
 */
const keepToGuide = (event: ReactPointerEvent) => event.stopPropagation();

/** Gleiten von einem Ziel zum nächsten: Licht und Karte in einem Zug, danach ohne Verzögerung. */
const GLIDE_MS = 450;
const GLIDE = `all ${GLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
/** Die Karte gleitet nur mit ihrer Lage. Ihre Breite wechselt sofort, damit sie gleich richtig vermessen ist
 *  (Marko 17.11.: „bewegt sich im Zickzack“ -- sonst sprang sie nach dem Gleiten noch einmal). */
const CARD_GLIDE = `left ${GLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), top ${GLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 200ms`;

/** Dunkelt alles außer dem Ziel ab. Klicks daneben tun nichts; auf das Ziel nur in Klick-Schritten. */
/**
 * Dunkelt alles außer dem Licht ab. Ein offenes Fenster (Anfrage, Angebot, Vertrag) bleibt ganz
 * hell und bedienbar: lesen, scrollen, schauen; markiert ist darin nur der Knopf (`ring`).
 * Klicks neben das Licht tun nichts; `blocked` sperrt auch das Licht (Vorführung, Schritt ohne Klick).
 */
function Backdrop({ hole, ring, clickable, blocked, glide, scroller }: {
  hole: TourRect | null; ring: TourRect | null; clickable: boolean; blocked: boolean; glide: boolean;
  /** Gesperrtes Fenster: Das Mausrad scrollt es trotzdem. */
  scroller?: HTMLElement | null;
}) {
  if (!hole) return <div aria-hidden="true" className={cn(DIM, 'inset-0')} onPointerDown={keepToGuide} />;
  const bottom = hole.top + hole.height;
  const right = hole.left + hole.width;
  const t = glide ? { transition: GLIDE } : undefined;
  const mark = ring ?? hole;
  return <div aria-hidden="true" onPointerDown={keepToGuide}>
    <div className={DIM} style={{ ...t, top: 0, left: 0, right: 0, height: Math.max(hole.top, 0) }} />
    <div className={DIM} style={{ ...t, top: bottom, left: 0, right: 0, bottom: 0 }} />
    <div className={DIM} style={{ ...t, top: hole.top, left: 0, width: Math.max(hole.left, 0), height: hole.height }} />
    <div className={DIM} style={{ ...t, top: hole.top, left: right, right: 0, height: hole.height }} />
    {blocked && <div className="pointer-events-auto fixed z-[100]" style={{ ...t, ...hole }} onWheel={(e) => scroller?.scrollBy({ top: e.deltaY })} />}
    <div className="pointer-events-none fixed z-[101] rounded-lg ring-2 ring-primary" style={{ ...t, ...mark }} />
    {clickable && <div className="pointer-events-none fixed z-[101] rounded-lg ring-4 ring-primary/40 motion-safe:animate-pulse" style={mark} />}
  </div>;
}

/** Der Zeiger, der einen Klick vormacht (guideDemo.ts). Klickt selbst nie. */
function GuidePointer() {
  const { pointer } = useGuideDemo();
  const ring = useRef<HTMLSpanElement>(null);
  const icon = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!pointer.taps) return;
    ring.current?.animate([{ transform: 'scale(0.4)', opacity: 0.7 }, { transform: 'scale(2.4)', opacity: 0 }], { duration: 480, easing: 'ease-out' });
    icon.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.82)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
  }, [pointer.taps]);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed z-[103]"
      style={{ left: pointer.x - 3, top: pointer.y - 3, opacity: pointer.visible ? 1 : 0,
        transition: pointer.jump ? 'opacity 200ms' : `left ${POINTER_MS}ms cubic-bezier(0.4, 0, 0.2, 1), top ${POINTER_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms` }}>
      <span ref={ring} className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-primary/50 opacity-0" />
      <span ref={icon} className="block origin-top-left">
        <MousePointer2 className="h-6 w-6 fill-white stroke-slate-900 drop-shadow" strokeWidth={1.5} />
      </span>
      {pointer.label && (
        // Am rechten Rand steht das Schild links vom Zeiger, sonst liefe es aus dem Bild.
        <span className={cn('absolute top-5 w-max max-w-[16rem] rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium leading-snug text-primary-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95',
          pointer.x > window.innerWidth - 300 ? 'right-1' : 'left-6')}>
          {pointer.label}
        </span>
      )}
    </div>
  );
}

export interface GuideOverlayProps {
  step: GuideStep;
  stepNumber: number;
  stepCount: number;
  firstName?: string;
  target: GuideTarget;
  /** Der Headhunter darf das Ziel selbst anklicken. */
  clickable: boolean;
  onNext: () => void;
  onBack: (() => void) | null;
  onClose: () => void;
  /** Klick-Schritte: dasselbe wie der Klick auf das Ziel, oder die Navigation, wo das nicht geht. */
  onAct: () => void;
  /** Der Hauptknopf im letzten Schritt. */
  onOpenJobs: () => void;
  /** Kapitelnamen in der aktuellen Sprache. */
  chapters?: () => readonly string[];
  texts?: GuideTextsKey;
  /**
   * Fortschritt je Kapitel (0 bis 1). Mit Angabe zeigt die Karte statt eines
   * durchgehenden Balkens ein Segment je Kapitel (Kunden-Rundgang).
   */
  segments?: number[];
  /** „Inhalt“: Kapitelliste in der Karte, ein Klick springt an den Anfang des Kapitels. */
  onJump?: (chapter: number) => void;
  /** Erster Schritt: „Später“ statt „Überspringen“ -- verschiebt, ohne abzuhaken. */
  onPostpone?: () => void;
  /** Zusätzlicher Inhalt unter dem Text, etwa die eigene Stelle in der Begrüßung. */
  extra?: ReactNode;
  /** Beschriftung des Hauptknopfs im letzten Schritt, sonst `<texts>.finalCta`. */
  finalLabel?: string;
  /** Wofür `target` gesucht wurde: der Schritt, beim Vorführen auch sein Bereich (`<id>:area`). */
  targetKey?: string;
  /** Stand der Vorführung (guideDemo.ts). */
  demoPhase?: DemoPhase;
  /** „Weiter“ während der Vorführung: überspringen. */
  onSkipDemo?: () => void;
}

export function GuideOverlay({ step, stepNumber, stepCount, firstName, target, clickable, onNext, onBack, onClose, onAct, onOpenJobs, chapters: chapterNames = guideChapters, texts = 'texts', segments, onJump, onPostpone, extra, finalLabel, targetKey = step.id, demoPhase = 'done', onSkipDemo }: GuideOverlayProps) {
  const { t } = useTranslation('recruiterGuide');
  const chapters = chapterNames();
  const viewport = useViewport();
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [cardSize, setCardSize] = useState({ width: 380, height: 260 });
  const [contentsOpen, setContentsOpen] = useState(false);
  const hasExtra = !!extra;
  const first = stepNumber === 1;
  const last = stepNumber === stepCount;
  const missing = !!step.target && !target.el && !target.waiting;
  const showExample = !!step.example && (!step.exampleWhenMissing || missing);
  const body = step.click && !clickable ? step.narrowBody ?? step.body : step.body;
  const title = first && firstName ? t(`${texts}.welcomeNamed`, { title: step.title, name: firstName }) : step.title;

  // Steht das neue Ziel still (useGuideTarget: settled), gleiten Licht und Karte in einem Zug dorthin.
  // Bis dahin bleiben sie, wo sie waren: kein Sprung in die Mitte, keine dunkle Pause.
  const ready = !step.target || (target.settled && target.key === targetKey);
  const rect = ready ? target.rect : null;
  const toHole = (r: TourRect): TourRect => ({
    top: Math.max(r.top - PAD, 0), left: Math.max(r.left - PAD, 0),
    width: Math.min(r.width + 2 * PAD, viewport.width), height: Math.min(r.height + 2 * PAD, viewport.height),
  });
  // Liegt das Ziel in einem offenen Fenster, leuchtet das ganze Fenster (Marko, 16.11.2026: „man
  // sieht nicht, wie wir das Angebot ausfüllen, und kann sich nicht bewegen“). Markiert ist nur der Knopf.
  // Ebenso ein offenes Menü (Neue Stelle, Glocke): Die Karte steht neben dem ganzen Menü, nicht über seinem Rest.
  // Ein Fenster über fast die ganze Breite (Aufnahme) ist kein Rahmen: Daneben wäre kein Platz,
  // die Karte steht dann am Ziel selbst, im freien Teil des Fensters.
  const frameRaw = ready ? target.el?.closest<HTMLElement>('[role="dialog"]') ?? target.el?.closest<HTMLElement>('[role="menu"]') ?? null : null;
  const frameEl = frameRaw && frameRaw.getBoundingClientRect().width < viewport.width * 0.8 ? frameRaw : null;
  const frame = frameEl?.getBoundingClientRect() ?? null;
  const liveHole = frame ? toHole(frame) : rect && toHole(rect);
  const liveRing = frame && rect && target.el !== frameEl ? toHole(rect) : null;
  // Die Seite neben dem Ziel bleibt im Schritt dieselbe, solange sie passt.
  const side = useRef<{ key: string; side: CardPlacement['side'] } | null>(null);
  // Neben einem Fenster wird die Karte schmal und darf dessen Rand (Innenabstand) überdecken,
  // damit sie neben statt über dem Fenster steht.
  // Im breiten Fenster (Aufnahme) ebenfalls schmal: So passt sie in den freien Rand neben dem Inhalt.
  const compact = !!frame || (!!frameRaw && !frameEl);
  const placeHole = compact && liveHole ? { ...liveHole, left: liveHole.left + 24, width: Math.max(liveHole.width - 48, 0) } : liveHole;
  // Gemerkt wird die Seite je Ziel UND Kartengröße: Mit der Größe des vorigen Schritts gewählt, wäre sie oft die falsche.
  const sideKey = `${targetKey}|${Math.round(cardSize.width)}x${Math.round(cardSize.height)}`;
  const placed = placeCard(placeHole, cardSize, viewport, side.current?.key === sideKey ? side.current.side : step.side);
  // Neben einem Fenster nie in die Mitte (dort stünde die Karte über dem Fenster): dann an den rechten Rand.
  const livePosition: CardPlacement = compact && placeHole && placed.side === 'center'
    ? { side: 'right', left: Math.max(16, viewport.width - cardSize.width - 16), top: Math.min(Math.max(16, placeHole.top + placeHole.height / 2 - cardSize.height / 2), Math.max(16, viewport.height - cardSize.height - 16)) }
    : placed;
  if (ready && liveHole && side.current?.key !== sideKey) side.current = { key: sideKey, side: livePosition.side };
  const shown = useRef<{ key: string; hole: TourRect | null; ring: TourRect | null; compact: boolean; position: CardPlacement } | null>(null);
  const live = ready ? { key: targetKey, hole: liveHole, ring: liveRing, compact, position: livePosition } : null;
  const glideFor = useRef<{ key: string; until: number } | null>(null);
  if (live && shown.current && shown.current.key !== live.key && glideFor.current?.key !== live.key) {
    glideFor.current = { key: live.key, until: performance.now() + GLIDE_MS + 40 };
  }
  const gliding = !!live && glideFor.current?.key === live.key && performance.now() < glideFor.current.until
    && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const display = live ?? shown.current;
  const hole = display?.hole ?? null;
  const ring = display?.ring ?? null;
  const narrow = display?.compact ?? compact;
  const position = display?.position ?? livePosition;
  useEffect(() => { if (live) shown.current = live; });

  // Kein Platz neben einem großen Ziel (Profilkopf, Besetzung): die Seite einmal so scrollen,
  // dass das Ziel oben steht und die Karte darunter passt. Sonst läge sie über dem Ziel.
  const madeRoom = useRef<string | null>(null);
  useEffect(() => {
    if (!live || compact || !liveHole || !target.el || madeRoom.current === targetKey) return;
    madeRoom.current = targetKey;
    if (live.position.side === 'right' || live.position.side === 'bottom') return;
    // Unter Kopfzeile (64 px) und mitlaufender Leiste im Bewerberprofil (52 px), nicht dahinter.
    const top = 128;
    if (liveHole.height + 16 + cardSize.height + 16 > viewport.height - top || liveHole.top <= top + 8) return;
    const el = target.el;
    const before = el.style.scrollMarginTop;
    el.style.scrollMarginTop = `${top}px`;
    side.current = null;
    el.scrollIntoView({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    el.style.scrollMarginTop = before;
    // Neu platzieren, auch wenn die Seite nicht weiter scrollen kann (dann eben darüber).
    rerender((n) => n + 1);
  });
  const [, rerender] = useState(0);
  useEffect(() => {
    if (!gliding) return;
    const timer = window.setTimeout(() => rerender((n) => n + 1), GLIDE_MS + 60);
    return () => window.clearTimeout(timer);
  }, [gliding, live?.key]);

  // Karte sichtbar: Jetzt darf die Vorführung des Schritts beginnen.
  useEffect(() => { if (ready) guideDemo.ready(step.id); }, [ready, step.id]);
  const showing = demoPhase !== 'done' && !!step.click;
  // Zeigt der Schritt nur ein Fenster oder Menü, wirkt das Markierte wie etwas zum Anklicken
  // (Marko 17.11.: „man denkt, man muss Stellenanzeige einfügen klicken“): Hinweis und „Weiter“ markiert.
  const lookOnly = !step.click && !!frameRaw && ready;

  // Zeiger: von der Karte zum Ziel, einmal antippen, verschwinden. Dann ist der Nutzer dran.
  // Schilder: der Zeiger fährt Stelle für Stelle an, das Schild sagt, was dort steht.
  useEffect(() => {
    if (demoPhase !== 'pointing' || !ready || !target.el || targetKey !== step.id || !step.points?.length) return;
    const t = guideDemo.token();
    let stopped = false;
    const points = step.points;
    void (async () => {
      await guideDemo.sleep(GLIDE_MS + 150);
      const card = cardRef.current?.getBoundingClientRect();
      if (stopped || !guideDemo.alive(t)) return;
      if (card) guideDemo.pointer.place(card.left + card.width * 0.5, card.top + 24);
      for (const point of points) {
        const el = document.querySelector(point.at);
        if (!el || stopped || !guideDemo.alive(t)) continue;
        const r = el.getBoundingClientRect();
        if (r.top < 120 || r.top + 60 > window.innerHeight) {
          // Die Überschrift soll unter der festen Kopfzeile stehen, nicht dahinter.
          const box = el as HTMLElement;
          const margin = box.style.scrollMarginTop;
          box.style.scrollMarginTop = '140px';
          box.scrollIntoView({ block: r.height > window.innerHeight * 0.5 ? 'start' : 'center', behavior: 'smooth' });
          box.style.scrollMarginTop = margin;
          await guideDemo.sleep(500);
        }
        await guideDemo.pointer.to(el, t, point.label);
        await guideDemo.sleep(1900);
      }
      if (stopped || !guideDemo.alive(t)) return;
      guideDemo.pointer.hide();
      guideDemo.pointed(step.id);
    })();
    return () => { stopped = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal je Vorführung
  }, [demoPhase, ready, target.el, targetKey, step.id]);

  useEffect(() => {
    if (demoPhase !== 'pointing' || !ready || !target.el || targetKey !== step.id || step.points?.length) return;
    const t = guideDemo.token();
    // Ist die ganze Zeile markiert, tippt der Zeiger auf ihren Knopf (`pointAt`).
    const el = (step.pointAt ? document.querySelector(step.pointAt) : null) ?? target.el;
    let stopped = false;
    void (async () => {
      // Erst wenn die Karte angekommen ist: Der Zeiger startet an ihrem Knopf.
      await guideDemo.sleep(GLIDE_MS + 100);
      if (stopped || !guideDemo.alive(t)) return;
      const card = cardRef.current?.getBoundingClientRect();
      if (card) guideDemo.pointer.place(card.left + card.width * 0.72, card.top + card.height - 28);
      await guideDemo.sleep(60);
      await guideDemo.pointer.to(el, t);
      await guideDemo.pointer.tap(t);
      await guideDemo.sleep(380);
      if (stopped || !guideDemo.alive(t)) return;
      // Der Zeiger bleibt am Ziel stehen (Marko 17.11.: „hier auch den Pointer“), siehe unten.
      guideDemo.pointed(step.id, true);
    })();
    return () => { stopped = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- einmal je Vorführung
  }, [demoPhase, ready, target.el, targetKey, step.id]);

  // Der Zeiger bleibt stehen, wo es weitergeht (Marko 17.11.: „der Hinweis geht unter, wir brauchen
  // wirklich den Pointer“): im Mitmach-Schritt auf dem Ziel, im Nur-ansehen-Schritt auf „Weiter“.
  // Er tippt alle paar Sekunden an und gleitet mit, falls die Seite sich bewegt.
  const restOn = demoPhase === 'done' && ready && (lookOnly || clickable);
  useEffect(() => {
    if (!restOn || !motionAllowed()) return;
    const t = guideDemo.token();
    let stopped = false;
    let timer = 0;
    const spot = () => (lookOnly ? primaryRef.current : (step.pointAt ? document.querySelector(step.pointAt) : null) ?? target.el);
    void (async () => {
      if (lookOnly) await guideDemo.sleep(GLIDE_MS + 250);
      const el = spot();
      if (stopped || !el || !guideDemo.alive(t)) return;
      // Ohne vorige Vorführung kommt der Zeiger aus der Karte, sonst gleitet er vom letzten Platz herüber.
      const last = guideDemo.get().pointer;
      const card = cardRef.current?.getBoundingClientRect();
      if (card && !last.x && !last.y) {
        guideDemo.pointer.place(card.left + card.width * 0.5, card.top + 48);
        await guideDemo.sleep(60);
      }
      await guideDemo.pointer.to(el, t);
      if (stopped) return;
      await guideDemo.pointer.tap(t);
      timer = window.setInterval(() => {
        const now = spot();
        if (stopped || !now) return;
        void guideDemo.pointer.to(now, t).then(() => { if (!stopped) void guideDemo.pointer.tap(t); });
      }, 3500);
    })();
    return () => { stopped = true; window.clearInterval(timer); guideDemo.pointer.hide(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- neu je Schritt und Ziel
  }, [restOn, lookOnly, step.id, target.el]);

  // Die Höhe hängt von Text und Beispiel ab; gemessen wird nach dem Zeichnen.
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    setCardSize(size => (size.width === width && size.height === height ? size : { width, height }));
  // Bei jeder Darstellung: Breite (schmal neben Fenstern) und Text wechseln mit dem Schritt.
  });

  useEffect(() => { primaryRef.current?.focus({ preventScroll: true }); setContentsOpen(false); }, [step.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      // Vor einem offenen Fenster (Aufnahme) abfangen: sonst schlösse Escape
      // Rundgang UND Fenster zugleich.
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'ArrowRight' && !step.click && !last) { event.preventDefault(); onNext(); }
      if (event.key === 'ArrowLeft' && onBack) { event.preventDefault(); onBack(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [step.click, last, onNext, onBack, onClose]);

  return createPortal(<>
    <Backdrop hole={hole} ring={ring} clickable={clickable && !showing} blocked={showing || !clickable} glide={gliding} scroller={frameEl} />
    <GuidePointer />
    <div
      ref={cardRef}
      role="dialog"
      onPointerDown={keepToGuide}
      aria-modal="false"
      aria-labelledby="guide-title"
      aria-describedby="guide-body"
      className={cn('fixed z-[102] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl',
        display ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        narrow ? 'w-[min(260px,calc(100vw-2rem))]' : extra ? 'w-[min(420px,calc(100vw-2rem))]' : 'w-[min(380px,calc(100vw-2rem))]')}
      // Gleiten nur beim Wechsel zum neuen Ziel; beim Scrollen folgt die Karte ohne Verzögerung.
      style={{ top: position.top, left: position.left, transition: gliding ? CARD_GLIDE : display ? 'opacity 200ms' : 'none' }}
      aria-hidden={!display}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {t('ui.chapter', { current: step.chapter, total: chapters.length, name: chapters[step.chapter - 1] })}
        </p>
        <button type="button" onClick={onClose} aria-label={t('ui.close')} className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-4 w-4" />
        </button>
      </div>
      {segments
        ? <div className="mt-3 flex gap-1" role="progressbar" aria-label={t('ui.progress')} aria-valuemin={1} aria-valuemax={stepCount} aria-valuenow={stepNumber}>
          {segments.map((part, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300 motion-reduce:transition-none" style={{ width: `${Math.round(part * 100)}%` }} />
            </div>
          ))}
        </div>
        : <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={t('ui.progress')} aria-valuemin={1} aria-valuemax={stepCount} aria-valuenow={stepNumber}>
          <div className="h-full rounded-full bg-primary transition-all duration-300 motion-reduce:transition-none" style={{ width: `${(stepNumber / stepCount) * 100}%` }} />
        </div>}
      <h2 id="guide-title" className="mt-4 text-lg font-semibold leading-snug">{title}</h2>
      <p id="guide-body" className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {extra}
      {showExample && <GuideExampleView kind={step.example!} />}
      {showing
        ? <p className="mt-3 flex items-center gap-2 text-sm font-medium text-muted-foreground"><Hand className="h-4 w-4 text-primary" />{t(`${texts}.showing`)}</p>
        // Marko 17.11.: „Sie sind dran“ farbig hervorheben. Ruhiges Blau wie „neu“ in den Listen;
        // Grundklasse = dunkles Design, `dark:` = helles (tailwind darkMode ['class', '.light']).
        : clickable && <p className="mt-3 flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-100 dark:border-sky-600/30 dark:bg-sky-50 dark:text-sky-900">
          <MousePointerClick className="h-4 w-4 shrink-0 text-sky-400 motion-safe:animate-pulse dark:text-sky-600" />{t(`${texts}.yourTurn`)}</p>}
      {lookOnly && <p className="mt-3 flex items-center gap-2 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm font-medium text-sky-100 dark:border-sky-600/30 dark:bg-sky-50 dark:text-sky-900">
        <Eye className="h-4 w-4 shrink-0 text-sky-400 dark:text-sky-600" />{t(`${texts}.lookOnly`)}</p>}
      {contentsOpen && onJump && (
        <ol className="mt-4 divide-y divide-border/60 border-y border-border/60 text-sm" aria-label={t('ui.contents')}>
          {chapters.map((name, i) => (
            <li key={name}>
              <button type="button" onClick={() => onJump(i + 1)}
                className={cn('flex w-full items-center justify-between gap-3 py-2 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  i + 1 === step.chapter ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                <span>{i + 1} · {name}</span><ChevronRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {onJump && !first && (
          <Button variant="ghost" size="sm" className="mr-auto px-2 text-muted-foreground" aria-expanded={contentsOpen} onClick={() => setContentsOpen(open => !open)}>
            <List className="mr-1.5 h-4 w-4" />{t('ui.contents')}
          </Button>
        )}
        {first ? <>
          <Button variant="ghost" size="sm" onClick={onPostpone ?? onClose}>{t(onPostpone ? `${texts}.later` : `${texts}.skip`)}</Button>
          <Button ref={primaryRef} size="sm" onClick={onNext}>{t(`${texts}.start`)}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
        </> : <>
          {onBack && !last && <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />{t('ui.back')}</Button>}
          {last
            ? <>
              <Button variant="outline" size="sm" onClick={onClose}>{t(`${texts}.finish`)}</Button>
              <Button ref={primaryRef} size="sm" onClick={onOpenJobs}>{finalLabel ?? t(`${texts}.finalCta`)}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            </>
            : step.click
              ? <Button ref={primaryRef} size="sm" variant={clickable || showing ? 'outline' : 'default'} onClick={showing && onSkipDemo ? onSkipDemo : onAct}>{step.click.label}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
              : <Button ref={primaryRef} size="sm" onClick={onNext}
                className={cn(lookOnly && 'ring-2 ring-sky-400 ring-offset-2 ring-offset-popover dark:ring-sky-600')}>{t('ui.next')}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>}
        </>}
      </div>
    </div>
  </>, document.body);
}

/**
 * Klickt der Nutzer woanders hin, pausiert der Rundgang und wartet hier. Mit
 * `text` sagt der Hinweis, worauf er wartet; ohne `onResume` bietet er kein
 * „Fortsetzen“ an (etwa mitten in der Aufnahme, wo ein Seitenwechsel sie schlösse).
 */
export function GuidePausePill({ onResume, onClose, text, texts = 'texts' }: {
  onResume?: () => void; onClose: () => void; text?: string; texts?: GuideTextsKey;
}) {
  const { t } = useTranslation('recruiterGuide');
  return createPortal(
    <div role="status" className="pointer-events-auto fixed bottom-4 right-4 z-[102] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-border bg-popover py-1.5 pl-4 pr-1.5 text-popover-foreground shadow-lg">
      <Compass className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-sm">{text ?? t(`${texts}.paused`)}</span>
      {onResume && <Button size="sm" className="h-8 rounded-full" onClick={onResume}>{t(`${texts}.resume`)}</Button>}
      <button type="button" onClick={onClose} aria-label={t('ui.close')} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body,
  );
}
