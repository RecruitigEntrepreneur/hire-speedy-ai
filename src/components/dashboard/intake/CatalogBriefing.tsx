import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  BRIEF_QUESTIONS, completeness, nextQuestion,
  type BriefQuestion, type BriefSlot, type CatalogState, type Known,
} from '@/lib/briefCatalog';
import { AlertTriangle, Check, CheckCircle2, Circle, Loader2, Sparkles } from 'lucide-react';

/**
 * Das Briefing, gefuehrt vom Katalog.
 *
 * Loest DynamicBriefing ab, das die Fragen von einem Modell erfinden liess.
 * Gemessen an einer echten Stelle: 97 Fragen ohne Abschluss, danach EIN
 * Muss-Kriterium in der Datenbank, Fortschritt 65 -> 85 -> 40 -> 85.
 *
 * Hier stellt der Katalog die Fragen -- im Wortlaut aus Markos
 * Briefing-Leitfaden. Das Modell tut nur noch zwei Dinge: es erntet aus einer
 * freien Antwort die Zeilen, die darin mitbeantwortet wurden, und stellt
 * hoechstens eine Nachfrage. Die ist sichtbar als Nachfrage gekennzeichnet,
 * damit sie nicht mit einer Katalogfrage verwechselt wird.
 *
 * Der Fortschritt wird GERECHNET. Er kann nicht mehr fallen.
 *
 * KEIN LADEBILDSCHIRM: die naechste Katalogfrage steht sofort da, weil sie
 * nicht erst erzeugt werden muss. Der KI-Aufruf laeuft im Hintergrund und
 * traegt nach -- trifft er ein, verschwinden geerntete Zeilen aus der
 * Restliste, waehrend der Kunde schon die naechste Frage liest.
 */

interface FollowUp {
  id: string;
  question: string;
  why: string;
  chips: string[];
  multi: boolean;
  fills_slot: string | null;
}

interface Props {
  type: 'full-time' | 'freelance';
  jobDraft: Record<string, unknown>;
  state: CatalogState;
  onState: (updater: (prev: CatalogState) => CatalogState) => void;
  onDone: () => void;
  askAi?: (payload: Record<string, unknown>) => Promise<Record<string, any>>;
}

/** Anzeige eines bereits bekannten Werts in der Bestaetigungszeile. */
const zeige = (v: unknown): string => {
  if (Array.isArray(v)) return v.join(' · ');
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('min' in o || 'max' in o) {
      const a = o.min ? Number(o.min).toLocaleString('de-DE') : null;
      const b = o.max ? Number(o.max).toLocaleString('de-DE') : null;
      return a && b ? `${a} – ${b}` : (a ?? b ?? '—');
    }
  }
  return String(v ?? '');
};

const QUELLE: Record<string, string> = {
  ad: 'aus der Anzeige',
  enrich: 'aus dem Impressum',
  inherit: 'aus Ihrem Firmenprofil',
  derive: 'aus Ihrer Antwort abgeleitet',
  answer: '',
};

export function CatalogBriefing({ type, jobDraft, state, onState, onDone, askAi }: Props) {
  /** Entwurf der Antworten auf die gerade sichtbaren Zeilen. */
  const [entwurf, setEntwurf] = useState<Record<string, unknown>>({});
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [fuAuswahl, setFuAuswahl] = useState<string[]>([]);
  const [fuText, setFuText] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const nr = useRef(0);

  const naechste = nextQuestion(state.known, type, state.askedQuestions);
  const fortschritt = completeness(state.known, type);

  // Die gerechnete Zahl wandert in den Zustand, damit der Autosave sie
  // mitnimmt -- intake_drafts.completeness und spaeter jobs.intake_completeness
  // lesen von dort. Frueher stand hier die Schaetzung des Modells.
  useEffect(() => {
    if (state.completeness !== fortschritt.pct) {
      onState((p) => ({ ...p, completeness: fortschritt.pct }));
    }
  }, [fortschritt.pct, state.completeness, onState]);

  /**
   * Ernte-Aufruf. Laeuft im Hintergrund; der Kunde wartet nie darauf.
   * Ein ueberholter Aufruf darf nichts mehr schreiben.
   */
  const ernten = useCallback(
    async (frage: BriefQuestion | null, antwort: string, offen: BriefSlot[]) => {
      const meine = ++nr.current;
      setLaeuft(true);
      try {
        const request = {
          contract_type: type,
          job_draft: jobDraft,
          question: frage
            ? {
                key: frage.key,
                text: frage.text,
                slots: frage.slots.map((s) => ({ key: s.key, label: s.label, form: s.form, chips: s.chips })),
              }
            : undefined,
          answer: antwort,
          open_slots: offen.map((s) => ({ key: s.key, label: s.label, form: s.form, chips: s.chips })),
          known: Object.fromEntries(
            Object.entries(state.known).map(([k, v]) => [k, v?.value]),
          ),
          asked_followups: state.askedFollowups,
        };
        const data = askAi
          ? await askAi(request)
          : await supabase.functions.invoke('intake-questions', { body: request })
              .then((r) => { if (r.error) throw r.error; return r.data as Record<string, any>; });

        if (meine !== nr.current) return;
        if (!data || data.error) throw new Error(data?.error ?? 'no data');

        onState((p) => {
          const known: Known = { ...p.known };
          // Geerntetes fuellt nur LEERE Zeilen. Was der Kunde selbst gesagt
          // hat, gewinnt immer -- sonst ueberschreibt eine Ableitung seine
          // ausdrueckliche Angabe.
          for (const [k, v] of Object.entries(data.slot_values ?? {})) {
            if (!known[k]) known[k] = { value: v, from: 'derive' };
          }
          return {
            ...p,
            known,
            aiAvailable: true,
            model: data.model ?? p.model,
            conflicts: [...p.conflicts, ...(Array.isArray(data.conflicts) ? data.conflicts : [])],
            envelopePatch: { ...p.envelopePatch, ...(data.reveal_envelope_patch ?? {}) },
          };
        });
        if (data.follow_up) setFollowUp(data.follow_up as FollowUp);
      } catch (e) {
        if (meine !== nr.current) return;
        // Kein Abbruch: der Katalog traegt das Briefing auch ohne KI. Frueher
        // fiel hier alles auf einen statischen Fragenkatalog zurueck.
        console.warn('[CatalogBriefing] Ernte nicht moeglich — Katalog laeuft weiter:', e);
        onState((p) => ({ ...p, aiAvailable: false }));
      } finally {
        if (meine === nr.current) setLaeuft(false);
      }
    },
    [type, jobDraft, askAi, state.known, state.askedFollowups, onState],
  );

  // Erster Aufruf: aus dem Entwurf ernten, bevor die erste Frage gestellt wird.
  const geerntet = useRef(false);
  useEffect(() => {
    if (geerntet.current) return;
    geerntet.current = true;
    const offen = BRIEF_QUESTIONS.flatMap((q) => q.slots).filter((s) => !state.known[s.key]);
    void ernten(null, '', offen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!naechste) {
    return (
      <div className="rounded-xl border bg-card p-5 text-center">
        <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-primary" />
        <p className="text-sm font-semibold">Das Briefing ist vollständig.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Alle {fortschritt.fragenGesamt} Pflichtfragen sind beantwortet.
        </p>
        <Button className="mt-3" size="sm" onClick={onDone}>Weiter</Button>
      </div>
    );
  }

  const { frage, fragen, bestaetigen } = naechste;

  const setz = (key: string, v: unknown) => setEntwurf((p) => ({ ...p, [key]: v }));
  const um = (key: string, chip: string) =>
    setEntwurf((p) => {
      const cur = Array.isArray(p[key]) ? (p[key] as string[]) : [];
      return { ...p, [key]: cur.includes(chip) ? cur.filter((c) => c !== chip) : [...cur, chip] };
    });

  const gefuellt = (s: BriefSlot) => {
    const v = entwurf[s.key];
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === 'object') return Object.values(v).some((x) => String(x ?? '').trim());
    return String(v ?? '').trim().length > 0;
  };
  const kannWeiter = fragen.filter((s) => s.required).every(gefuellt);

  const absenden = (unbekannt = false) => {
    const known: Known = { ...state.known };
    const worte: string[] = [];
    for (const s of fragen) {
      const v = unbekannt ? undefined : entwurf[s.key];
      if (v === undefined || (Array.isArray(v) && v.length === 0)) continue;
      known[s.key] = { value: v, from: 'answer' };
      worte.push(`${s.label}: ${zeige(v)}`);
    }
    const antwort = worte.join('\n');
    const askedQuestions = [...state.askedQuestions, frage.key];
    onState((p) => ({ ...p, known, askedQuestions }));
    setEntwurf({});

    // Ernten laeuft im Hintergrund gegen die Zeilen, die DANACH noch offen
    // sind -- sonst wuerde das Modell in gerade beantwortete hineinschreiben.
    const restOffen = BRIEF_QUESTIONS.flatMap((q) => q.slots).filter((s) => !known[s.key]);
    if (antwort) void ernten(frage, antwort, restOffen);
  };

  const followUpAbsenden = () => {
    if (!followUp) return;
    const teile = [...fuAuswahl];
    if (fuText.trim()) teile.push(fuText.trim());
    const text = teile.join(' · ');
    onState((p) => {
      const known: Known = { ...p.known };
      if (followUp.fills_slot && text) known[followUp.fills_slot] = { value: text, from: 'answer' };
      return { ...p, known, askedFollowups: [...p.askedFollowups, followUp.id] };
    });
    setFollowUp(null);
    setFuAuswahl([]);
    setFuText('');
  };

  return (
    <div className="space-y-3">
      {/* ---- Fortschritt: gerechnet, in Fragen statt Prozent ---- */}
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold">Briefing</span>
        <span className="text-muted-foreground">
          {fortschritt.fragenGesamt - fortschritt.fragenOffen} von {fortschritt.fragenGesamt} Fragen
        </span>
        <div className="ml-auto flex gap-0.5">
          {BRIEF_QUESTIONS.map((q) => (
            <span
              key={q.key}
              title={q.text}
              className={cn(
                'h-1 w-4 rounded-full',
                state.askedQuestions.includes(q.key) ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
      </div>

      {/* ---- Die Katalogfrage ---- */}
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {frage.chapter}
        </p>
        {frage.intro && (
          <p className="mb-1 text-xs italic text-muted-foreground">{frage.intro}</p>
        )}
        <p className="mb-3 text-sm font-medium leading-snug">{frage.text}</p>

        {/* Was schon dasteht — gezeigt statt gefragt. */}
        {bestaetigen.length > 0 && (
          <div className="mb-3 space-y-1 rounded-lg border border-border/60 bg-accent/30 p-2.5">
            {bestaetigen.map((s) => (
              <p key={s.key} className="flex items-start gap-1.5 text-xs">
                <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span className="text-muted-foreground">{s.label}:</span>
                <span className="font-medium">{zeige(state.known[s.key]?.value)}</span>
                {QUELLE[state.known[s.key]?.from ?? ''] && (
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {QUELLE[state.known[s.key]!.from]}
                  </span>
                )}
              </p>
            ))}
          </div>
        )}

        {/* Eine Zeile je offener Slot. */}
        <div className="space-y-3">
          {fragen.map((s) => (
            <div key={s.key}>
              <p className="mb-1.5 text-xs text-muted-foreground">
                {s.label}
                {!s.required && <span className="ml-1 text-[10px]">(optional)</span>}
              </p>
              <SlotEingabe slot={s} wert={entwurf[s.key]} onSet={(v) => setz(s.key, v)} onToggle={(c) => um(s.key, c)} />
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => absenden(true)}>
            Weiß ich nicht
          </Button>
          <Button size="sm" className="ml-auto h-7 px-3 text-xs" disabled={!kannWeiter}
                  onClick={() => absenden()}>
            Weiter
          </Button>
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" /> {frage.why}
        </p>
      </div>

      {/* ---- Die eine Nachfrage, ausdruecklich als solche gekennzeichnet ---- */}
      {followUp && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-3 w-3" /> Nachfrage
          </p>
          <p className="mb-2.5 text-sm font-medium leading-snug">{followUp.question}</p>
          {followUp.chips.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {followUp.chips.map((c) => (
                <button key={c} type="button"
                  onClick={() => setFuAuswahl((p) =>
                    followUp.multi
                      ? (p.includes(c) ? p.filter((x) => x !== c) : [...p, c])
                      : [c])}
                  className={cn(
                    'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                    fuAuswahl.includes(c)
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input value={fuText} onChange={(e) => setFuText(e.target.value)}
                   placeholder="Ergänzen …" className="h-7 text-xs"
                   onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); followUpAbsenden(); } }} />
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                    onClick={() => { setFollowUp(null); setFuAuswahl([]); setFuText(''); }}>
              Überspringen
            </Button>
            <Button size="sm" className="h-7 px-3 text-xs" onClick={followUpAbsenden}>OK</Button>
          </div>
          {followUp.why && <p className="mt-2 text-[11px] text-muted-foreground">{followUp.why}</p>}
        </div>
      )}

      {/* ---- Widersprueche: gemeldet statt still ueberschrieben ---- */}
      {state.conflicts.map((c, i) => (
        <div key={`${c.slot}-${i}`} className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <span>{c.note || `Zu „${c.slot}" steht schon „${c.existing}" — jetzt „${c.neu}".`}</span>
          <button type="button" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => onState((p) => ({ ...p, conflicts: p.conflicts.filter((_, j) => j !== i) }))}>
            ×
          </button>
        </div>
      ))}

      {/* ---- Was noch fehlt: das Ende ist sichtbar ---- */}
      <div className="rounded-xl border bg-card p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Was noch fehlt
          {laeuft && <Loader2 className="h-3 w-3 animate-spin" />}
        </p>
        {(() => {
          // Die gerade gestellte Frage gehoert nicht in die Restliste -- sie
          // stand sonst gleichzeitig oben als Frage und hier als "fehlt noch".
          const rest = BRIEF_QUESTIONS.filter(
            (q) => !state.askedQuestions.includes(q.key) && q.key !== frage.key,
          );
          return (
            <div className="space-y-1">
              {rest.slice(0, 7).map((q) => (
                <p key={q.key} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Circle className={cn('mt-1 h-2 w-2 shrink-0',
                    q.rank === 1 ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                  <span className="line-clamp-1">{q.text}</span>
                </p>
              ))}
              {rest.length > 7 && (
                <p className="pl-3.5 text-xs text-muted-foreground">… und {rest.length - 7} weitere</p>
              )}
              {rest.length === 0 && (
                <p className="text-xs text-muted-foreground">Das war die letzte Frage.</p>
              )}
            </div>
          );
        })()}
        <p className="mt-2 border-t pt-2 text-[11px] text-muted-foreground">
          Sie können jederzeit übergeben — Lücken lassen sich später ergänzen.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SlotEingabe({
  slot, wert, onSet, onToggle,
}: {
  slot: BriefSlot;
  wert: unknown;
  onSet: (v: unknown) => void;
  onToggle: (chip: string) => void;
}) {
  const gewaehlt = Array.isArray(wert) ? (wert as string[]) : [];

  if (slot.form === 'chips' || slot.form === 'multi') {
    const multi = slot.form === 'multi';
    // Ohne Vorgaben (z. B. die 3 Muss-Kriterien) wird getippt statt geklickt.
    if (!slot.chips?.length) {
      return (
        <FreieListe werte={gewaehlt} onChange={onSet} />
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {slot.chips.map((c) => {
          const an = multi ? gewaehlt.includes(c) : wert === c;
          return (
            <button key={c} type="button"
              onClick={() => (multi ? onToggle(c) : onSet(an ? undefined : c))}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                an ? 'border-primary bg-primary/10 text-foreground'
                   : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
              )}>
              {an && <Check className="h-2.5 w-2.5 shrink-0" />}
              {c}
            </button>
          );
        })}
      </div>
    );
  }

  if (slot.form === 'range') {
    const v = (wert ?? {}) as { min?: string; max?: string };
    return (
      <div className="flex items-center gap-2">
        <Input type="number" placeholder="von" value={v.min ?? ''} className="h-8 text-xs"
               onChange={(e) => onSet({ ...v, min: e.target.value })} />
        <span className="text-xs text-muted-foreground">bis</span>
        <Input type="number" placeholder="bis" value={v.max ?? ''} className="h-8 text-xs"
               onChange={(e) => onSet({ ...v, max: e.target.value })} />
      </div>
    );
  }

  if (slot.form === 'number') {
    return <Input type="number" value={String(wert ?? '')} className="h-8 text-xs"
                  onChange={(e) => onSet(e.target.value)} />;
  }

  if (slot.form === 'date') {
    return <Input type="date" value={String(wert ?? '')} className="h-8 text-xs"
                  onChange={(e) => onSet(e.target.value)} />;
  }

  // 'ai' und 'text': freie Antwort. Bei 'ai' erntet das Modell daraus.
  return (
    <Textarea value={String(wert ?? '')} rows={slot.form === 'ai' ? 3 : 2}
              placeholder="In Ihren Worten …" className="text-xs"
              onChange={(e) => onSet(e.target.value)} />
  );
}

/** Freie Aufzaehlung ohne Vorgaben — fuer die drei Muss-Kriterien. */
function FreieListe({ werte, onChange }: { werte: string[]; onChange: (v: string[]) => void }) {
  const [neu, setNeu] = useState('');
  const hinzu = () => {
    const t = neu.trim();
    if (!t || werte.includes(t)) return;
    onChange([...werte, t]);
    setNeu('');
  };
  return (
    <div>
      {werte.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {werte.map((w) => (
            <button key={w} type="button" onClick={() => onChange(werte.filter((x) => x !== w))}
              className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs">
              <Check className="h-2.5 w-2.5" /> {w} <span className="text-muted-foreground">×</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={neu} onChange={(e) => setNeu(e.target.value)} placeholder="Eintragen und Enter …"
               className="h-8 text-xs"
               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); hinzu(); } }} />
        <Button size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={!neu.trim()} onClick={hinzu}>
          +
        </Button>
      </div>
    </div>
  );
}
