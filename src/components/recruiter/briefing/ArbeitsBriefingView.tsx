import type { ReactNode } from 'react';
import {
  Banknote, Bike, Calculator, Check, CircleDashed, Clock, GraduationCap, HeartPulse, Home, IdCard, Laptop, Linkedin, Lock,
  PhoneCall, PiggyBank, Plane, Sparkles, Train, TrendingUp, UserPlus, Users, type LucideIcon,
} from 'lucide-react';
import { SCHRITTE, type Schritt, type SchrittId } from '@/lib/arbeitsBriefing';

/**
 * Das Briefing nach den fünf Arbeitsschritten (21.10.2026). Nur Angaben des
 * Kunden, Frage links, Antwort rechts; Lücken klein am Ende jedes Schritts,
 * Vertrauliches mit Schloss. Das Werkzeug des Schritts steht neben der Frage.
 */
const SYMBOLE: [RegExp, LucideIcon][] = [
  [/examen|weiterbildung|fortbildung|schulung|kurs/i, GraduationCap], [/head of|perspektive|karriere|entwicklung|leitung/i, TrendingUp],
  [/homeoffice|remote|mobil/i, Home], [/gleitzeit|kernzeit|arbeitszeit|flexib/i, Clock], [/urlaub/i, Plane],
  [/altersvorsorge|bav|pension/i, PiggyBank], [/ticket|bahn|öpnv/i, Train], [/rad|bike|leasing/i, Bike],
  [/gesundheit|sport|fitness/i, HeartPulse], [/laptop|hardware|ausstattung/i, Laptop], [/gehalt|bonus|prämie/i, Banknote], [/team|kolleg/i, Users],
];
const symbol = (t: string) => SYMBOLE.find(([re]) => re.test(t))?.[1] ?? Sparkles;

export interface SchrittWerkzeug { label: string; icon: LucideIcon; onClick: () => void }

function Vertraulich() {
  return <span title="Nur für dich, nie in Anzeige oder Ansprache" className="ml-2 inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 align-[1px] text-[10px] font-medium text-amber-700"><Lock className="h-2.5 w-2.5" aria-hidden="true" />nur für dich</span>;
}

function Abschnitt({ s, nr, werkzeug, children }: { s: Schritt; nr: number; werkzeug?: SchrittWerkzeug; children: ReactNode }) {
  return <section id={`briefing-${s.id}`} className="scroll-mt-24 space-y-4 border-t border-border pt-7 first:border-t-0 first:pt-0">
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm text-primary">{nr}</span>{s.frage}
      </h2>
      {werkzeug && <button type="button" onClick={werkzeug.onClick} className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"><werkzeug.icon className="h-4 w-4" aria-hidden="true" />{werkzeug.label}</button>}
    </div>
    {children}
    {s.offen.length > 0 && <p className="flex items-start gap-2 text-sm text-amber-700"><CircleDashed className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span>Offen: {s.offen.map(f => f.label).join(' · ')}</span></p>}
  </section>;
}

/** Kurze Kriterien als Pillen, lange als Häkchen-Zeilen darunter. */
function Chips({ werte }: { werte: string[] }) {
  const kurz = werte.filter(c => c.length <= 40);
  const lang = werte.filter(c => c.length > 40);
  return <div className="space-y-2">
    {kurz.length > 0 && <ul className="flex flex-wrap gap-1.5">{kurz.map(c => <li key={c} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-0.5 text-sm"><Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />{c}</li>)}</ul>}
    {lang.length > 0 && <ul className="space-y-1">{lang.map(c => <li key={c} className="flex gap-2.5"><Check className="mt-1.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />{c}</li>)}</ul>}
  </div>;
}

function Zeilen({ s }: { s: Schritt }) {
  if (!s.zeilen.length) return null;
  return <dl className="grid gap-x-6 gap-y-3 text-[15px] leading-7 sm:grid-cols-[11rem_minmax(0,1fr)]">
    {s.zeilen.map(z => <div key={z.label} className="contents">
      <dt className="text-sm leading-7 text-muted-foreground">{z.label}</dt>
      <dd className="min-w-0">
        {z.chips ? <Chips werte={z.chips} /> : z.wert}
        {z.vertraulich && <Vertraulich />}
      </dd>
    </div>)}
  </dl>;
}

export function ArbeitsBriefingView({ schritte, werkzeuge }: { schritte: Schritt[]; werkzeuge: Partial<Record<SchrittId, SchrittWerkzeug>> }) {
  return <div className="max-w-[48rem] space-y-7">
    {schritte.map((s, i) => <Abschnitt key={s.id} s={s} nr={i + 1} werkzeug={werkzeuge[s.id]}>
      {s.benefits && s.benefits.length > 0 && <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Benefits</p>
        <ul className="grid gap-2 sm:grid-cols-2">{s.benefits.map(b => { const Icon = symbol(b); return <li key={b} className="flex items-start gap-3 rounded-lg bg-muted/50 px-3.5 py-2.5 text-sm leading-6"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />{b.charAt(0).toUpperCase() + b.slice(1)}</li>; })}</ul>
        {s.beleg && <blockquote className="border-l-2 border-border pl-4 text-sm italic leading-6 text-muted-foreground">„{s.beleg}“</blockquote>}
      </div>}
      <Zeilen s={s} />
      {!s.zeilen.length && !s.benefits?.length && !s.offen.length && <p className="text-sm text-muted-foreground">Dazu hat der Kunde nichts angegeben.</p>}
    </Abschnitt>)}
  </div>;
}

/** Rechte Leiste im Briefing: Sprungmarken und Zeichen. */
export function ArbeitsBriefingLeiste({ offen, onKundenFragen, revealed }: { offen: number; onKundenFragen: () => void; revealed: boolean }) {
  return <nav aria-label="Springen zu" className="space-y-5">
    <div className="space-y-0.5">
      <p className="px-2 pb-1 text-xs text-muted-foreground">Springen zu</p>
      {SCHRITTE.map((s, i) => <a key={s.id} href={`#briefing-${s.id}`} onClick={e => { e.preventDefault(); document.getElementById(`briefing-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground">
        <span className="w-4 text-xs tabular-nums">{i + 1}</span>{s.kurz}
      </a>)}
    </div>
    {offen > 0 && <div className="space-y-1">
      <button type="button" onClick={onKundenFragen} disabled={!revealed}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-amber-700 hover:bg-amber-500/10 disabled:cursor-default disabled:opacity-60">
        <CircleDashed className="h-4 w-4" aria-hidden="true" />Kunden fragen · {offen} offen
      </button>
      <p className="px-2 text-xs text-muted-foreground">{revealed ? 'Eine Mail mit allen offenen Punkten.' : 'Geht, sobald du „Ich suche“ gedrückt hast.'}</p>
    </div>}
    <p className="px-2 text-xs leading-5 text-muted-foreground"><Vertraulich /><span className="mt-1 block">nie in Anzeige oder Ansprache</span></p>
  </nav>;
}

export const WERKZEUG_SYMBOL = { verdienst: Calculator, expose: IdCard, ansprache: Linkedin, leitfaden: PhoneCall, vorstellen: UserPlus };
