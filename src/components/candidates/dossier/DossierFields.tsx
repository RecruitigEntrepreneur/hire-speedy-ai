import { KeyboardEvent, ReactNode, createContext, useContext, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Option, parseDigits } from '@/lib/candidateDossier';
import type { OriginMap } from '@/lib/cvImport';
import { hasPhrase, togglePhrase } from '@/lib/interviewSuggestions';

/**
 * Herkunft je Feld (nur auf der Prüfseite des Lebenslauf-Imports gesetzt): Jedes Feld
 * zeigt dann darunter, woher sein Wert kommt – Lebenslauf mit Zitat, berechnet oder
 * Vorschlag zum Prüfen.
 */
export const FieldOriginContext = createContext<OriginMap | null>(null);

function OriginLine({ field }: { field?: string }) {
  const origins = useContext(FieldOriginContext);
  const o = field && origins ? origins[field as keyof OriginMap] : undefined;
  if (!o) return null;
  if (o.source === 'suggestion') return <p className="text-xs text-warning">Vorschlag · bitte prüfen</p>;
  const label = o.source === 'notes' ? 'aus deinen Notizen' : o.source === 'derived' ? o.quote || 'berechnet' : 'aus dem Lebenslauf';
  const quote = o.source !== 'derived' && o.quote ? (o.quote.length > 90 ? `${o.quote.slice(0, 90)}…` : o.quote) : '';
  return (
    <p className="text-xs text-success">
      {label}
      {quote && <span className="text-muted-foreground"> · „{quote}“</span>}
    </p>
  );
}

// Gemeinsame Feld-Bausteine für Bearbeiten-Panel und Interview. Jedes Feld
// bekommt die id "dossier-<feld>", damit "eintragen" direkt hinspringen kann.

export const fieldId = (field: string) => `dossier-${field}`;

export function Field({
  label,
  field,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  field?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)} data-dossier-field={field}>
      <label htmlFor={field ? fieldId(field) : undefined} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
      <OriginLine field={field} />
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const chipClass = (active: boolean) =>
  cn(
    'rounded-md border px-2.5 py-1 text-xs transition-colors',
    active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted',
  );

/** Einfachauswahl. Erneuter Klick hebt die Auswahl auf, "Keine Angabe" ist optional sichtbar. */
export function ChipGroup({
  options,
  value,
  onChange,
  field,
  noneLabel,
}: {
  options: Option[];
  value: string | null;
  onChange: (value: string | null) => void;
  field?: string;
  noneLabel?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" id={field ? fieldId(field) : undefined} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={chipClass(value === o.value)}
          onClick={() => onChange(value === o.value ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
      {noneLabel && (
        <button type="button" role="radio" aria-checked={value == null} className={chipClass(value == null)} onClick={() => onChange(null)}>
          {noneLabel}
        </button>
      )}
    </div>
  );
}

/** Mehrfachauswahl mit optionaler Obergrenze. Unbekannte, schon gespeicherte Werte bleiben sichtbar. */
export function MultiChips({
  options,
  values,
  onChange,
  max,
  field,
  suggested = [],
  allowCustom = false,
}: {
  options: string[];
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
  field?: string;
  /** Vorschläge aus der Akte: gestrichelt hervorgehoben, ein Klick übernimmt. */
  suggested?: string[];
  /** „+ Eigenes": Eintrag, der in keiner Liste steht. */
  allowCustom?: boolean;
}) {
  const [custom, setCustom] = useState<string | null>(null);
  const all = [...options, ...values.filter((v) => !options.includes(v))];
  const full = max != null && values.length >= max;
  const addCustom = () => {
    const v = (custom ?? '').trim();
    if (v && !full && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setCustom(null);
  };
  return (
    <div className="flex flex-wrap gap-1.5" id={field ? fieldId(field) : undefined}>
      {all.map((o) => {
        const active = values.includes(o);
        const isSuggested = !active && suggested.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={active}
            disabled={!active && full}
            title={isSuggested ? 'Vorschlag aus der Akte' : undefined}
            className={cn(
              chipClass(active),
              isSuggested && 'border-dashed border-primary text-primary',
              !active && full && 'cursor-not-allowed text-muted-foreground hover:bg-transparent',
            )}
            onClick={() => onChange(active ? values.filter((v) => v !== o) : [...values, o])}
          >
            {isSuggested && <span className="mr-1">Vorschlag:</span>}
            {o}
          </button>
        );
      })}
      {allowCustom && (custom === null ? (
        <button type="button" className={cn(chipClass(false), 'text-muted-foreground')} disabled={full} onClick={() => setCustom('')}>
          <Plus className="mr-0.5 inline h-3 w-3" /> Eigenes
        </button>
      ) : (
        <input
          autoFocus
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
            if (e.key === 'Escape') setCustom(null);
          }}
          onBlur={addCustom}
          placeholder="Eigener Punkt"
          className="h-7 w-40 rounded-md border border-input bg-background px-2 text-xs outline-none"
        />
      ))}
    </div>
  );
}

/**
 * Antippen statt tippen: Chips schreiben ihre Phrase in ein Freitextfeld (durch Komma
 * getrennt). Der Text bleibt darunter frei bearbeitbar.
 */
export function PhraseChips({
  options,
  value,
  onChange,
  suggested = [],
  field,
  placeholder,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  suggested?: string[];
  field?: string;
  placeholder?: string;
}) {
  const extras = suggested.filter((s) => !options.some((o) => o.toLowerCase() === s.toLowerCase()));
  const all = [...extras, ...options];
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {all.map((o) => {
          const active = hasPhrase(value, o);
          const isSuggested = !active && suggested.includes(o);
          return (
            <button
              key={o}
              type="button"
              aria-pressed={active}
              className={cn(chipClass(active), isSuggested && 'border-dashed border-primary text-primary')}
              onClick={() => onChange(togglePhrase(value, o))}
            >
              {o}
            </button>
          );
        })}
      </div>
      <Textarea
        id={field ? fieldId(field) : undefined}
        value={value}
        rows={1}
        placeholder={placeholder ?? 'Eigene Notiz (optional)'}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[36px] text-sm"
      />
    </div>
  );
}

/** Tags: Enter oder Komma fügt hinzu, Backspace im leeren Feld entfernt den letzten. */
export function TagInput({
  values,
  onChange,
  placeholder,
  field,
  suggestions = [],
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  field?: string;
  /** Vorschläge zum Antippen (z. B. aus dem Lebenslauf), mit optionalem Hinweis. */
  suggestions?: (string | { name: string; hint?: string })[];
}) {
  const sugg = suggestions
    .map((x) => (typeof x === 'string' ? { name: x, hint: undefined as string | undefined } : x))
    .filter((x) => x.name.trim() && !values.some((v) => v.toLowerCase() === x.name.toLowerCase()));
  const [input, setInput] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
    const next = [...values];
    for (const p of parts) if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    if (next.length !== values.length) onChange(next);
    setInput('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (input.trim()) add(input);
    } else if (e.key === 'Backspace' && !input && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <div className="space-y-1.5">
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
          {v}
          <button type="button" aria-label={`${v} entfernen`} className="text-muted-foreground hover:text-destructive" onClick={() => onChange(values.filter((x) => x !== v))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={field ? fieldId(field) : undefined}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => input.trim() && add(input)}
        placeholder={values.length ? '' : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {input.trim() && (
        <button type="button" aria-label="Hinzufügen" className="text-muted-foreground hover:text-foreground" onClick={() => add(input)}>
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
    {sugg.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {sugg.map((x) => (
          <button
            key={x.name}
            type="button"
            className="rounded-md border border-dashed border-primary px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
            onClick={() => onChange([...values, x.name])}
          >
            + {x.name}{x.hint && <span className="text-muted-foreground"> · {x.hint}</span>}
          </button>
        ))}
      </div>
    )}
    </div>
  );
}

/** Jahresgehalt in Euro, Anzeige mit Tausenderpunkt. */
export function MoneyInput({ value, onChange, field, placeholder = '€ / Jahr' }: { value: number | null; onChange: (value: number | null) => void; field?: string; placeholder?: string }) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value != null ? value.toLocaleString('de-DE') : '');
  return (
    <div className="relative">
      <Input
        id={field ? fieldId(field) : undefined}
        inputMode="numeric"
        value={shown}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseDigits(e.target.value));
        }}
        onBlur={() => setText(null)}
        className="pr-7"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
    </div>
  );
}

export function TextField({ value, onChange, field, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; field?: string; placeholder?: string; type?: string }) {
  return <Input id={field ? fieldId(field) : undefined} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function AreaField({ value, onChange, field, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; field?: string; placeholder?: string; rows?: number }) {
  return <Textarea id={field ? fieldId(field) : undefined} value={value} rows={rows} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function NumberField({ value, onChange, field, placeholder, suffix }: { value: number | null; onChange: (v: number | null) => void; field?: string; placeholder?: string; suffix?: string }) {
  return (
    <div className="relative">
      <Input
        id={field ? fieldId(field) : undefined}
        inputMode="numeric"
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/[^\d]/g, ''), 10);
          onChange(Number.isFinite(n) ? n : null);
        }}
        className={suffix ? 'pr-14' : undefined}
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
}

/** Scrollt im nächsten scrollbaren Vorfahren zum Feld und setzt den Fokus. */
export function focusDossierField(field: string) {
  const el = document.getElementById(fieldId(field)) ?? document.querySelector<HTMLElement>(`[data-dossier-field="${field}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const focusable = el.matches('input, textarea, button, select') ? el : el.querySelector<HTMLElement>('input, textarea, button');
  window.setTimeout(() => focusable?.focus({ preventScroll: true }), 250);
}
