import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, Compass, MousePointerClick, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { GUIDE_CHAPTERS, placeCard, type GuideStep, type TourRect } from '@/lib/recruiterGuide';
import { GuideExampleView } from './GuideExamples';
import type { GuideTarget } from './useGuideTarget';

/** Abstand der Markierung um das Ziel. */
const PAD = 6;
const DIM = 'fixed z-[100] bg-slate-950/60';

function useViewport() {
  const [size, setSize] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

/** Dunkelt alles außer dem Ziel ab. Klicks daneben tun nichts; auf das Ziel nur in Klick-Schritten. */
function Backdrop({ hole, clickable }: { hole: TourRect | null; clickable: boolean }) {
  if (!hole) return <div aria-hidden="true" className={cn(DIM, 'inset-0')} />;
  const bottom = hole.top + hole.height;
  const right = hole.left + hole.width;
  return <div aria-hidden="true">
    <div className={DIM} style={{ top: 0, left: 0, right: 0, height: Math.max(hole.top, 0) }} />
    <div className={DIM} style={{ top: bottom, left: 0, right: 0, bottom: 0 }} />
    <div className={DIM} style={{ top: hole.top, left: 0, width: Math.max(hole.left, 0), height: hole.height }} />
    <div className={DIM} style={{ top: hole.top, left: right, right: 0, height: hole.height }} />
    {!clickable && <div className="fixed z-[100]" style={hole} />}
    <div className="pointer-events-none fixed z-[101] rounded-lg ring-2 ring-primary" style={hole} />
    {clickable && <div className="pointer-events-none fixed z-[101] rounded-lg ring-4 ring-primary/40 motion-safe:animate-pulse" style={hole} />}
  </div>;
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
  onOpenJobs: () => void;
}

export function GuideOverlay({ step, stepNumber, stepCount, firstName, target, clickable, onNext, onBack, onClose, onAct, onOpenJobs }: GuideOverlayProps) {
  const viewport = useViewport();
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [cardSize, setCardSize] = useState({ width: 380, height: 260 });
  const first = stepNumber === 1;
  const last = stepNumber === stepCount;
  const missing = !!step.target && !target.el && !target.waiting;
  const showExample = !!step.example && (!step.exampleWhenMissing || missing);
  const body = step.click && !clickable ? step.narrowBody ?? step.body : step.body;
  const title = step.id === 'welcome' && firstName ? `${step.title}, ${firstName}` : step.title;

  const rect = target.rect;
  const hole = rect && {
    top: Math.max(rect.top - PAD, 0), left: Math.max(rect.left - PAD, 0),
    width: Math.min(rect.width + 2 * PAD, viewport.width), height: Math.min(rect.height + 2 * PAD, viewport.height),
  };
  const position = placeCard(hole, cardSize, viewport);

  // Die Höhe hängt von Text und Beispiel ab; gemessen wird nach dem Zeichnen.
  useLayoutEffect(() => {
    if (!cardRef.current) return;
    const { width, height } = cardRef.current.getBoundingClientRect();
    setCardSize(size => (size.width === width && size.height === height ? size : { width, height }));
  }, [step.id, showExample, clickable, viewport.width]);

  useEffect(() => { primaryRef.current?.focus({ preventScroll: true }); }, [step.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key === 'ArrowRight' && !step.click && !last) { event.preventDefault(); onNext(); }
      if (event.key === 'ArrowLeft' && onBack) { event.preventDefault(); onBack(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step.click, last, onNext, onBack, onClose]);

  return createPortal(<>
    <Backdrop hole={hole} clickable={clickable} />
    <div
      ref={cardRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby="guide-title"
      aria-describedby="guide-body"
      className="fixed z-[102] w-[min(380px,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-5 text-popover-foreground shadow-2xl transition-[top,left] duration-300 motion-reduce:transition-none"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Kapitel {step.chapter} von {GUIDE_CHAPTERS.length} · {GUIDE_CHAPTERS[step.chapter - 1]}
        </p>
        <button type="button" onClick={onClose} aria-label="Rundgang beenden" className="-m-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Fortschritt im Rundgang" aria-valuemin={1} aria-valuemax={stepCount} aria-valuenow={stepNumber}>
        <div className="h-full rounded-full bg-primary transition-all duration-300 motion-reduce:transition-none" style={{ width: `${(stepNumber / stepCount) * 100}%` }} />
      </div>
      <h2 id="guide-title" className="mt-4 text-lg font-semibold leading-snug">{title}</h2>
      <p id="guide-body" className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {showExample && <GuideExampleView kind={step.example!} />}
      {clickable && <p className="mt-3 flex items-center gap-2 text-sm font-medium"><MousePointerClick className="h-4 w-4 text-primary" />Du bist dran: Klick auf die markierte Stelle.</p>}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        {first ? <>
          <Button variant="ghost" size="sm" onClick={onClose}>Überspringen</Button>
          <Button ref={primaryRef} size="sm" onClick={onNext}>Los geht's<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
        </> : <>
          {onBack && !last && <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1.5 h-4 w-4" />Zurück</Button>}
          {last
            ? <>
              <Button variant="outline" size="sm" onClick={onClose}>Fertig</Button>
              <Button ref={primaryRef} size="sm" onClick={onOpenJobs}>Offene Jobs ansehen<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
            </>
            : step.click
              ? <Button ref={primaryRef} size="sm" variant={clickable ? 'outline' : 'default'} onClick={onAct}>{step.click.label}<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
              : <Button ref={primaryRef} size="sm" onClick={onNext}>Weiter<ArrowRight className="ml-1.5 h-4 w-4" /></Button>}
        </>}
      </div>
    </div>
  </>, document.body);
}

/** Klickt der Headhunter woanders hin, pausiert der Rundgang und wartet hier. */
export function GuidePausePill({ onResume, onClose }: { onResume: () => void; onClose: () => void }) {
  return createPortal(
    <div role="status" className="fixed bottom-4 right-4 z-[102] flex items-center gap-2 rounded-full border border-border bg-popover py-1.5 pl-4 pr-1.5 text-popover-foreground shadow-lg">
      <Compass className="h-4 w-4 text-primary" />
      <span className="text-sm">Rundgang pausiert</span>
      <Button size="sm" className="h-8 rounded-full" onClick={onResume}>Fortsetzen</Button>
      <button type="button" onClick={onClose} aria-label="Rundgang beenden" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <X className="h-4 w-4" />
      </button>
    </div>,
    document.body,
  );
}
