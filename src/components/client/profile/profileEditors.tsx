import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { X, Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { CompanyContact, OfficeLocation } from '@/lib/companyProfileOptions';

/**
 * Wiederverwendbare Profil-Editoren (Phase 1).
 * Bewusst generisch gehalten: dieselben Bausteine speisen später das Positions-Intake.
 */

// ── Mehrfachauswahl als Chips (Benefits, Kultur, Persönlichkeit) ─────────────
export function ChipMultiSelect({
  options, value, onChange, allowCustom = true, customPlaceholder = 'Eigenes ergänzen …',
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  allowCustom?: boolean;
  customPlaceholder?: string;
}) {
  const [custom, setCustom] = useState('');
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  const addCustom = () => {
    const t = custom.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setCustom('');
  };
  const customSelected = value.filter((v) => !options.includes(v));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {opt}
            </button>
          );
        })}
        {customSelected.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-3 py-1 text-xs text-primary-foreground"
          >
            {opt} <X className="h-3 w-3" />
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
            }}
            placeholder={customPlaceholder}
            className="h-8 text-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={addCustom} className="h-8">
            Hinzufügen
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Freie Tag-Eingabe (E-Mail-Domains, Ziel-/No-Go-Unternehmen) ──────────────
export function TagInput({
  value, onChange, placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim().replace(/,$/, '').trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput('');
  };
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 font-normal">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== tag))}
                className="hover:text-destructive"
                aria-label={`${tag} entfernen`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
        }}
        onBlur={add}
        placeholder={placeholder}
      />
    </div>
  );
}

// ── Priorisierte, geordnete Liste (Arbeitgeberargumente Top 3-5) ─────────────
export function PriorityList({
  options, value, onChange, max = 5,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (opt: string) => {
    if (!value.includes(opt) && value.length < max) onChange([...value, opt]);
  };
  const available = options.filter((o) => !value.includes(o));

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ol className="space-y-1.5">
          {value.map((opt, i) => (
            <li key={opt} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="flex-1">{opt}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="nach oben">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="nach unten">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onChange(value.filter((v) => v !== opt))}
                className="text-muted-foreground hover:text-destructive" aria-label="entfernen">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {value.length < max && available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((opt) => (
            <button key={opt} type="button" onClick={() => add(opt)}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground">
              + {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Geordneter Prozess-Builder (Standard-Bewerbungsprozess) ──────────────────
export function HiringProcessEditor({
  value, onChange, stepOptions,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  stepOptions: string[];
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ol className="space-y-1.5">
          {value.map((step, i) => (
            <li key={`${step}-${i}`} className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="flex-1">{step}</span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="nach oben">
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="nach unten">
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                className="text-muted-foreground hover:text-destructive" aria-label="entfernen">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      <Select value="" onValueChange={(v) => v && onChange([...value, v])}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="+ Prozessschritt hinzufügen" />
        </SelectTrigger>
        <SelectContent>
          {stepOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Ansprechpartner-Editor (Stammdaten, kein Login) ──────────────────────────
export function ContactsEditor({
  value, onChange, roles,
}: {
  value: CompanyContact[];
  onChange: (v: CompanyContact[]) => void;
  roles: string[];
}) {
  const update = (i: number, patch: Partial<CompanyContact>) => {
    const next = [...value];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () =>
    onChange([...value, { first_name: '', last_name: '', position: '', email: '', phone: '', role: roles[0] }]);

  return (
    <div className="space-y-3">
      {value.map((c, i) => (
        <div key={i} className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Ansprechpartner {i + 1}</span>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-destructive" aria-label="entfernen">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Input value={c.first_name} onChange={(e) => update(i, { first_name: e.target.value })} placeholder="Vorname" />
            <Input value={c.last_name} onChange={(e) => update(i, { last_name: e.target.value })} placeholder="Nachname" />
            <Input value={c.position} onChange={(e) => update(i, { position: e.target.value })} placeholder="Position (z. B. Head of HR)" />
            <Select value={c.role} onValueChange={(v) => update(i, { role: v })}>
              <SelectTrigger><SelectValue placeholder="Rolle" /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="email" value={c.email} onChange={(e) => update(i, { email: e.target.value })} placeholder="E-Mail" />
            <Input value={c.phone} onChange={(e) => update(i, { phone: e.target.value })} placeholder="Telefon" />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-2 h-4 w-4" />Ansprechpartner hinzufügen
      </Button>
    </div>
  );
}

// ── Standorte-Editor ─────────────────────────────────────────────────────────
export function OfficeLocationsEditor({
  value, onChange, types,
}: {
  value: OfficeLocation[];
  onChange: (v: OfficeLocation[]) => void;
  types: string[];
}) {
  const update = (i: number, patch: Partial<OfficeLocation>) => {
    const next = [...value];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const add = () =>
    onChange([...value, { name: '', city: '', country: 'Deutschland', address: '', type: types[0] }]);

  return (
    <div className="space-y-3">
      {value.map((loc, i) => (
        <div key={i} className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Standort {i + 1}</span>
            <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="text-muted-foreground hover:text-destructive" aria-label="entfernen">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <Input value={loc.city} onChange={(e) => update(i, { city: e.target.value })} placeholder="Stadt" />
            <Input value={loc.country} onChange={(e) => update(i, { country: e.target.value })} placeholder="Land" />
            <Select value={loc.type} onValueChange={(v) => update(i, { type: v })}>
              <SelectTrigger><SelectValue placeholder="Standorttyp" /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={loc.address || ''} onChange={(e) => update(i, { address: e.target.value })} placeholder="Adresse (optional)" />
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-2 h-4 w-4" />Standort hinzufügen
      </Button>
    </div>
  );
}
