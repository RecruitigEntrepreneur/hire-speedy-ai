import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown, Info, Loader2, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { captureViewport, FEEDBACK_IGNORE_ATTR, type Screenshot } from '@/lib/feedback/capture';
import { composeImages, type Box } from '@/lib/feedback/compose';
import { describeArea, describeShort } from '@/lib/feedback/elements';
import { resolveRoute } from '@/lib/feedback/routes';
import {
  automaticContext,
  KIND_OPTIONS,
  SEVERITY_OPTIONS,
  shortBrowser,
  STATUS_FOR_REPORTER,
  submitFeedback,
  ticketLabel,
  useMyFeedback,
  type FeedbackKind,
  type FeedbackMark,
  type FeedbackSeverity,
} from '@/lib/feedback/api';

/**
 * Feedback-Lasche (Zielbild 19.10.2026).
 *
 * 1. Lasche am rechten Rand, mittig — nicht unten rechts, dort sitzen schon
 *    Rundgang-Pille und Aktionsleisten.
 * 2. Klick: Bild der Seite, die Seite „friert ein“. Rahmen ziehen (das Element
 *    darunter wird erkannt) oder Vertrauliches schwärzen.
 * 3. Fenster rechts: Vorschau, Art, Text, „Wie sehr stört es?“, was
 *    automatisch mitgeht (zum Ansehen), Senden, eigene Meldungen.
 * 4. Danke-Toast mit Ticketnummer; die Seite darunter bleibt unberührt.
 *
 * Alles hängt in einem eigenen Container am Body. Der fängt Klick- und
 * Fokus-Ereignisse ab, bevor offene Dialoge (Radix) sie sehen: für die wäre
 * ein Klick auf die Lasche ein Klick „außerhalb“ — sie würden sich schließen,
 * und ein halb ausgefülltes Formular wäre weg.
 */

const MARK_COLOR = '#D85A30';
const DIM = 'rgba(2, 6, 23, 0.55)';
const MIN_BOX_PX = 8;
const MAX_BOXES = 20;
const PANEL_WIDTH = 380;

export interface FeedbackWidgetProps {
  /** Anrede: Headhunter und Admins werden geduzt, Kunden und Gäste gesiezt. */
  du: boolean;
  /** Nur auf Aufnahme-Links ohne Login: der Token aus dem Pfad. */
  guestToken: string | null;
  /** Angemeldet? Dann Glocke und „Ihre Meldungen“. */
  canNotify: boolean;
  /** Admin sieht die Lasche, obwohl sie für alle anderen aus ist. */
  adminOnlyHint?: boolean;
}

type Phase = 'idle' | 'capturing' | 'open';
type Tool = 'mark' | 'blackout';
interface Size { w: number; h: number }
interface Draft { x0: number; y0: number; x1: number; y1: number }

function copyFor(du: boolean) {
  return du
    ? {
        drawHint: 'Rahmen um die Stelle ziehen. Vertrauliches vorher schwärzen.',
        placeholder: 'Was ist hier falsch oder unklar? Was hättest du erwartet?',
        tooShort: 'Beschreib kurz, was du meinst.',
        failed: 'Das hat nicht geklappt. Versuch es noch einmal.',
        noImage: 'Ein Bild war hier nicht möglich. Beschreib die Stelle kurz im Text.',
        label: 'Dein Hinweis',
        mine: 'Deine Meldungen',
        privacy: 'Nur Matchunt sieht das. Geschwärzte Stellen verlassen deinen Rechner nicht.',
      }
    : {
        drawHint: 'Rahmen um die Stelle ziehen. Vertrauliches vorher schwärzen.',
        placeholder: 'Was ist hier falsch oder unklar? Was hätten Sie erwartet?',
        tooShort: 'Beschreiben Sie kurz, was Sie meinen.',
        failed: 'Das hat nicht geklappt. Bitte versuchen Sie es noch einmal.',
        noImage: 'Ein Bild war hier nicht möglich. Beschreiben Sie die Stelle kurz im Text.',
        label: 'Ihr Hinweis',
        mine: 'Ihre Meldungen',
        privacy: 'Nur Matchunt sieht das. Geschwärzte Stellen verlassen Ihren Rechner nicht.',
      };
}

/** Eigener Container am Body, der Ereignisse nicht an Dialoge darunter weiterreicht. */
function useIsolatedHost() {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = document.createElement('div');
    el.setAttribute(FEEDBACK_IGNORE_ATTR, '');
    const stop = (e: Event) => e.stopPropagation();
    const events = ['pointerdown', 'mousedown', 'touchstart', 'click', 'focusin', 'focusout', 'keydown', 'wheel'];
    events.forEach((type) => el.addEventListener(type, stop));
    document.body.appendChild(el);
    setHost(el);
    return () => {
      events.forEach((type) => el.removeEventListener(type, stop));
      el.remove();
    };
  }, []);
  return host;
}

const isNarrow = () => window.innerWidth < 640;

export function FeedbackWidget({ du, guestToken, canNotify, adminOnlyHint }: FeedbackWidgetProps) {
  const host = useIsolatedHost();
  const copy = copyFor(du);
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>('idle');
  const [tool, setTool] = useState<Tool>('mark');
  const [shot, setShot] = useState<Screenshot | null>(null);
  const [shotNote, setShotNote] = useState<string | null>(null);
  const [frame, setFrame] = useState<Size>({ w: 1, h: 1 });
  const [marks, setMarks] = useState<FeedbackMark[]>([]);
  const [blackouts, setBlackouts] = useState<Box[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind | null>(null);
  const [severity, setSeverity] = useState<FeedbackSeverity | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftRef = useRef<Draft | null>(null);
  draftRef.current = draft;

  const { data: mine = [] } = useMyFeedback(canNotify && panelOpen);

  const reset = useCallback(() => {
    setPhase('idle');
    setTool('mark');
    setShot(null);
    setShotNote(null);
    setMarks([]);
    setBlackouts([]);
    setDraft(null);
    setPanelOpen(false);
    setKind(null);
    setSeverity(null);
    setText('');
    setError(null);
    setSending(false);
    setShowContext(false);
  }, []);

  const start = async () => {
    if (phase !== 'idle') return;
    // Fokus aus einem offenen Dialog lösen, ohne ihn zu schließen: verliert er
    // den Fokus an „nichts“, holt er ihn sich später nicht zurück.
    (document.activeElement as HTMLElement | null)?.blur?.();
    setPhase('capturing');
    let captured: Screenshot | null = null;
    let note: string | null = null;
    try {
      captured = await captureViewport();
    } catch (e) {
      note = `Bild im Browser nicht möglich: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
      console.warn('[feedback] Bildaufnahme:', e);
    }
    setShot(captured);
    setShotNote(note);
    setFrame(
      captured
        ? { w: captured.width, h: captured.height }
        : { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight },
    );
    setPhase('open');
  };

  // Solange das Fenster offen ist: Seite nicht scrollen (ohne die Scrollleiste
  // wegzunehmen, sonst verrutscht die Seite unter dem Bild), Escape gehört uns.
  useEffect(() => {
    if (phase !== 'open') return;
    const overlay = overlayRef.current;
    const blockScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
    };
    overlay?.addEventListener('wheel', blockScroll, { passive: false });
    overlay?.addEventListener('touchmove', blockScroll, { passive: false });

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Vor den Dialogen darunter abfangen (die lauschen in der Capture-Phase am document).
      e.stopPropagation();
      e.preventDefault();
      if (draftRef.current) {
        setDraft(null);
        return;
      }
      // Geschriebenen Text nicht mit einer Taste wegwerfen.
      if (textareaRef.current?.value.trim()) return;
      reset();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      overlay?.removeEventListener('wheel', blockScroll);
      overlay?.removeEventListener('touchmove', blockScroll);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [phase, reset]);

  useEffect(() => {
    if (panelOpen) textareaRef.current?.focus({ preventScroll: true });
  }, [panelOpen]);

  // ---- Rahmen und Schwärzungen ziehen --------------------------------------
  const pointFrom = (e: ReactPointerEvent) => ({
    x: Math.min(Math.max(e.clientX, 0), frame.w),
    y: Math.min(Math.max(e.clientY, 0), frame.h),
  });

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((tool === 'mark' ? marks.length : blackouts.length) >= MAX_BOXES) return;
    const p = pointFrom(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draftRef.current) return;
    const p = pointFrom(e);
    setDraft((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  };
  const onPointerUp = () => {
    const d = draftRef.current;
    setDraft(null);
    if (!d) return;
    const left = Math.min(d.x0, d.x1);
    const top = Math.min(d.y0, d.y1);
    const width = Math.abs(d.x1 - d.x0);
    const height = Math.abs(d.y1 - d.y0);
    if (width < MIN_BOX_PX || height < MIN_BOX_PX) return;
    const box: Box = { x: left / frame.w, y: top / frame.h, w: width / frame.w, h: height / frame.h };
    if (tool === 'blackout') {
      setBlackouts((b) => [...b, box].slice(0, MAX_BOXES));
      return;
    }
    const element = describeArea({ left, top, width, height }, host);
    setMarks((m) => [...m, { ...box, element }].slice(0, MAX_BOXES));
    setPanelOpen(true);
  };

  const wholePage = () => {
    setMarks([]);
    setTool('mark');
    setPanelOpen(true);
  };
  const drawAgain = () => {
    setMarks([]);
    setTool('mark');
    if (isNarrow()) setPanelOpen(false);
  };
  const chooseTool = (next: Tool) => {
    setTool(next);
    if (isNarrow()) setPanelOpen(false);
  };

  // ---- Senden ---------------------------------------------------------------
  const send = async () => {
    const message = text.trim();
    if (message.length < 3) {
      setError(copy.tooShort);
      textareaRef.current?.focus();
      return;
    }
    setSending(true);
    setError(null);
    try {
      const [images, route] = await Promise.all([
        shot ? composeImages(shot, blackouts, marks).catch(() => null) : Promise.resolve(null),
        resolveRoute(window.location.pathname),
      ]);
      const { ticketNo } = await submitFeedback(
        {
          message,
          kind,
          severity,
          marks,
          blackoutCount: blackouts.length,
          screenshot: images?.image ?? null,
          crops: images?.crops ?? [],
          screenshotNote: shot ? (images ? null : 'Bild konnte nicht vorbereitet werden.') : shotNote,
          routePattern: route?.pattern ?? null,
          sourceFile: route?.file ?? null,
          guestToken,
        },
        copy.failed,
      );
      reset();
      queryClient.invalidateQueries({ queryKey: ['my-feedback'] });
      toast.success(ticketNo ? `Danke, ist angekommen (${ticketLabel(ticketNo)})` : 'Danke, ist angekommen', {
        description: canNotify ? 'Wir melden uns, wenn es live ist.' : 'Wir kümmern uns darum.',
      });
    } catch (e) {
      setSending(false);
      setError(e instanceof Error && e.message ? e.message : copy.failed);
    }
  };

  if (!host) return null;

  const px = (b: Box) => ({ left: b.x * frame.w, top: b.y * frame.h, width: b.w * frame.w, height: b.h * frame.h });
  const draftBox = draft
    ? {
        left: Math.min(draft.x0, draft.x1),
        top: Math.min(draft.y0, draft.y1),
        width: Math.abs(draft.x1 - draft.x0),
        height: Math.abs(draft.y1 - draft.y0),
      }
    : null;
  const holes = [...marks.map(px), ...(draftBox && tool === 'mark' ? [draftBox] : [])];
  const narrow = isNarrow();
  const barLeft = panelOpen && !narrow ? `calc((100vw - ${PANEL_WIDTH}px) / 2)` : '50%';
  const auto = panelOpen ? automaticContext() : null;

  return createPortal(
    <>
      {phase !== 'open' && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={start}
          disabled={phase === 'capturing'}
          aria-label="Feedback geben"
          title={adminOnlyHint ? 'Nur für Admins sichtbar. Für alle einschalten unter Admin › Feedback.' : 'Feedback geben'}
          className={cn(
            'pointer-events-auto fixed right-0 top-1/2 z-[90] flex -translate-y-1/2 rotate-180 items-center gap-1.5',
            'rounded-r-md bg-foreground px-1.5 py-3 text-xs font-medium text-background shadow-lg [writing-mode:vertical-rl]',
            'transition-[padding] hover:pl-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-wait',
          )}
        >
          {phase === 'capturing' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <MessageSquare className="h-3.5 w-3.5 rotate-90" aria-hidden />
          )}
          Feedback
          {adminOnlyHint && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />}
        </button>
      )}

      {phase === 'open' && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Feedback geben"
          className="pointer-events-auto fixed inset-0 z-[2147483000] select-none overflow-hidden"
        >
          {/* Die eingefrorene Seite */}
          {shot && (
            <img
              src={shot.dataUrl}
              alt=""
              draggable={false}
              className="absolute left-0 top-0 max-w-none"
              style={{ width: shot.width, height: shot.height }}
            />
          )}

          {/* Zeichenfläche mit abgedunkeltem Rest */}
          <div
            className={cn('absolute left-0 top-0 touch-none', tool === 'blackout' ? 'cursor-cell' : 'cursor-crosshair')}
            style={{ width: frame.w, height: frame.h }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDraft(null)}
          >
            <svg className="pointer-events-none absolute inset-0" width={frame.w} height={frame.h} aria-hidden>
              <defs>
                <mask id="feedback-holes">
                  <rect width="100%" height="100%" fill="white" />
                  {holes.map((b, i) => (
                    <rect key={i} x={b.left} y={b.top} width={b.width} height={b.height} rx={4} fill="black" />
                  ))}
                </mask>
              </defs>
              <rect width="100%" height="100%" fill={DIM} mask="url(#feedback-holes)" />
            </svg>

            {blackouts.map((b, i) => (
              <div key={`b${i}`} className="group absolute flex items-center justify-center rounded-sm bg-black" style={px(b)}>
                <span className="text-[10px] text-white/60">geschwärzt</span>
                <RemoveButton label={`Schwärzung ${i + 1} entfernen`} onClick={() => setBlackouts((all) => all.filter((_, j) => j !== i))} />
              </div>
            ))}

            {marks.map((m, i) => {
              const b = px(m);
              const found = describeShort(m.element);
              return (
                <div key={`m${i}`} className="group absolute rounded" style={{ ...b, border: `2px dashed ${MARK_COLOR}` }}>
                  <span
                    className="absolute -left-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-white shadow"
                    style={{ background: MARK_COLOR }}
                  >
                    {i + 1}
                  </span>
                  <RemoveButton label={`Markierung ${i + 1} entfernen`} onClick={() => setMarks((all) => all.filter((_, j) => j !== i))} />
                  {found && (
                    <span className="pointer-events-none absolute left-0 top-full mt-1 max-w-[320px] truncate rounded-md bg-popover px-2 py-0.5 text-[11px] text-popover-foreground shadow">
                      Erkannt: {found}
                    </span>
                  )}
                </div>
              );
            })}

            {draftBox && (
              <div
                className={cn('absolute rounded', tool === 'blackout' && 'bg-black/70')}
                style={{ ...draftBox, border: tool === 'mark' ? `2px dashed ${MARK_COLOR}` : '1px solid #000' }}
              />
            )}
          </div>

          {/* Leiste oben */}
          <div
            className="absolute top-3 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-2xl border border-border bg-popover py-1.5 pl-4 pr-1.5 text-popover-foreground shadow-lg"
            style={{ left: barLeft }}
          >
            <span className="text-sm">
              {tool === 'blackout'
                ? 'Über vertrauliche Stellen ziehen, sie werden geschwärzt.'
                : marks.length
                ? `${marks.length} markiert · weitere möglich`
                : copy.drawHint}
            </span>
            <div className="flex items-center gap-1">
              <Chip active={tool === 'mark' && !(panelOpen && marks.length === 0)} onClick={() => chooseTool('mark')}>
                Rahmen
              </Chip>
              <Chip active={tool === 'blackout'} onClick={() => chooseTool('blackout')}>
                Schwärzen{blackouts.length ? ` (${blackouts.length})` : ''}
              </Chip>
              <Chip active={panelOpen && marks.length === 0 && tool === 'mark'} onClick={wholePage}>
                Ganze Seite
              </Chip>
              <Chip onClick={reset}>Abbrechen</Chip>
              {!panelOpen && (marks.length > 0 || blackouts.length > 0) && (
                <Chip active onClick={() => setPanelOpen(true)}>Weiter</Chip>
              )}
            </div>
          </div>

          {/* Kommentar-Fenster */}
          {panelOpen && (
            <aside
              ref={panelRef}
              className="absolute inset-x-0 bottom-0 flex max-h-[85vh] select-text flex-col rounded-t-xl border-t border-border bg-popover text-popover-foreground shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:rounded-none sm:border-l sm:border-t-0"
              style={{ width: narrow ? undefined : PANEL_WIDTH }}
            >
              <header className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Feedback geben</h2>
                <button
                  type="button"
                  onClick={reset}
                  aria-label="Abbrechen"
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div>
                  <Preview shot={shot} frame={frame} marks={marks} blackouts={blackouts} />
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {marks.length === 0 ? 'Ganze Seite' : marks.length === 1 ? '1 Markierung' : `${marks.length} Markierungen`}
                      {blackouts.length > 0 && ` · ${blackouts.length} geschwärzt`}
                    </span>
                    <button type="button" onClick={drawAgain} className="underline-offset-2 hover:underline">
                      {marks.length ? 'neu ziehen' : 'Bereich markieren'}
                    </button>
                  </div>
                  {!shot && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{copy.noImage}</p>}
                </div>

                <fieldset>
                  <legend className="mb-1.5 text-xs font-medium">Worum geht es?</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {KIND_OPTIONS.map((o) => (
                      <Chip key={o.value} active={kind === o.value} onClick={() => setKind(kind === o.value ? null : o.value)}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="feedback-text" className="sr-only">
                    {copy.label}
                  </label>
                  <Textarea
                    id="feedback-text"
                    ref={textareaRef}
                    rows={4}
                    value={text}
                    maxLength={5000}
                    onChange={(e) => {
                      setText(e.target.value);
                      if (error) setError(null);
                    }}
                    placeholder={copy.placeholder}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'feedback-error' : undefined}
                  />
                  {error && (
                    <p id="feedback-error" className="mt-1.5 text-xs text-destructive">
                      {error}
                    </p>
                  )}
                  {marks.length > 1 && (
                    <p className="mt-1.5 text-xs text-muted-foreground">Mit „1“, „2“ … auf die Markierungen verweisen.</p>
                  )}
                </div>

                <fieldset>
                  <legend className="mb-1.5 text-xs font-medium">
                    Wie sehr stört es? <span className="font-normal text-muted-foreground">(optional)</span>
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {SEVERITY_OPTIONS.map((o) => (
                      <Chip key={o.value} active={severity === o.value} onClick={() => setSeverity(severity === o.value ? null : o.value)}>
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </fieldset>

                {auto && (
                  <div className="rounded-md border border-border text-xs">
                    <button
                      type="button"
                      onClick={() => setShowContext((v) => !v)}
                      aria-expanded={showContext}
                      className="flex w-full items-start gap-1.5 px-3 py-2 text-left text-muted-foreground"
                    >
                      <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="flex-1">
                        <span className="font-medium text-foreground">Automatisch dabei: </span>
                        {[
                          shot ? (blackouts.length ? `Bild (${blackouts.length} geschwärzt)` : 'Bild') : null,
                          'Seite',
                          auto.breadcrumbs.length ? `Klickpfad (${auto.breadcrumbs.length} Schritte)` : null,
                          auto.network_errors.length ? `${auto.network_errors.length} Netzwerkfehler` : null,
                          auto.console_errors.length ? `${auto.console_errors.length} Fehlermeldungen` : null,
                          'Browser',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', showContext && 'rotate-180')} aria-hidden />
                    </button>
                    {showContext && (
                      <div className="space-y-2 border-t border-border px-3 py-2 text-muted-foreground">
                        <p>
                          <span className="text-foreground">Seite:</span> {auto.page_path}
                        </p>
                        <p>
                          <span className="text-foreground">Browser:</span> {shortBrowser(auto.user_agent)} · {auto.viewport.w}×{auto.viewport.h}
                        </p>
                        {auto.breadcrumbs.length > 0 && (
                          <div>
                            <p className="text-foreground">Klickpfad (ohne getippte Werte):</p>
                            <ol className="mt-1 max-h-32 space-y-0.5 overflow-y-auto">
                              {auto.breadcrumbs.slice(-12).map((b, i) => (
                                <li key={i} className={cn('truncate', b.type === 'error' && 'text-destructive')}>
                                  {new Date(b.t).toLocaleTimeString('de-DE')} · {b.label}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                        <p>{copy.privacy}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <footer className="border-t border-border px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={reset} disabled={sending}>
                    Abbrechen
                  </Button>
                  <Button size="sm" onClick={send} disabled={sending}>
                    {sending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
                    Senden
                  </Button>
                </div>
                {canNotify && mine.length > 0 && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      {copy.mine} ({mine.length})
                      {mine.some((m) => m.status === 'done') && ` · ${mine.filter((m) => m.status === 'done').length} erledigt`}
                    </summary>
                    <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                      {mine.map((m) => (
                        <li key={m.ticket_no} className="flex gap-2">
                          <span className="shrink-0 tabular-nums text-muted-foreground">{ticketLabel(m.ticket_no)}</span>
                          <span className="min-w-0 flex-1 truncate">{m.summary}</span>
                          <span className={cn('shrink-0', m.status === 'done' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                            {STATUS_FOR_REPORTER[m.status] ?? m.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </footer>
            </aside>
          )}
        </div>
      )}
    </>,
    host,
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClick}
      className="absolute -right-2.5 -top-2.5 hidden h-5 w-5 items-center justify-center rounded-full bg-background text-foreground shadow group-hover:flex"
    >
      <X className="h-3 w-3" />
    </button>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** Verkleinertes Bild mit Rahmen und Schwärzungen, wie es im Ticket ankommt. */
function Preview({ shot, frame, marks, blackouts }: { shot: Screenshot | null; frame: Size; marks: FeedbackMark[]; blackouts: Box[] }) {
  const pct = (b: Box) => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });
  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-border bg-muted"
      style={{ aspectRatio: `${frame.w} / ${frame.h}` }}
    >
      {shot && <img src={shot.dataUrl} alt="Bild der Seite" className="absolute inset-0 h-full w-full" />}
      {blackouts.map((b, i) => (
        <div key={`b${i}`} className="absolute bg-black" style={pct(b)} />
      ))}
      {marks.map((m, i) => (
        <div
          key={`m${i}`}
          className="absolute rounded-sm"
          style={{ ...pct(m), border: `1.5px dashed ${MARK_COLOR}`, background: 'rgba(216, 90, 48, 0.08)' }}
        />
      ))}
    </div>
  );
}
