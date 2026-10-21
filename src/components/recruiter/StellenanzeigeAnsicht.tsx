import { Banknote, Bike, Check, Clock, GraduationCap, HeartPulse, Home, Laptop, PiggyBank, Plane, Sparkles, Train, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Posting, PostingBlock } from '@/lib/jobPosting';

/**
 * Die Anzeige als gut strukturierte Stellenanzeige (21.10.2026): lesbare
 * Breite, normale Überschriften, „Das bieten wir“ als Raster mit Symbolen,
 * „So läuft es ab“ als Schritte. Ohne Herkunfts-Etiketten -- die stehen im
 * Briefing; Matchunt sieht sie in der Vorschau (AnzeigeAnsicht).
 */
const SYMBOLE: [RegExp, LucideIcon][] = [
  [/examen|weiterbildung|fortbildung|schulung|akademie|kurs/i, GraduationCap],
  [/head of|perspektive|karriere|entwicklung|aufstieg|leitung/i, TrendingUp],
  [/homeoffice|home-office|remote|mobil/i, Home],
  [/gleitzeit|kernzeit|arbeitszeit|flexib/i, Clock],
  [/urlaub/i, Plane],
  [/altersvorsorge|bav|pension/i, PiggyBank],
  [/ticket|bahn|öpnv|jobticket/i, Train],
  [/rad|bike|leasing/i, Bike],
  [/gesundheit|sport|fitness/i, HeartPulse],
  [/laptop|hardware|ausstattung|technik/i, Laptop],
  [/gehalt|bonus|prämie|€/i, Banknote],
  [/team|kolleg/i, Users],
];
const symbol = (t: string) => SYMBOLE.find(([re]) => re.test(t))?.[1] ?? Sparkles;

/** Punkte mit „ · “ einzeln, lange Absätze nicht als Punkt. */
function aufteilen(werte: string[]): { punkte: string[]; absaetze: string[] } {
  const punkte: string[] = [];
  const absaetze: string[] = [];
  for (const w of werte) {
    for (const t of w.split(/\s·\s/).map(x => x.trim()).filter(Boolean)) (t.length > 140 ? absaetze : punkte).push(t);
  }
  return { punkte, absaetze };
}
const ohneVorteil = (t: string) => t.replace(/\s*\b(von vorteil|wünschenswert)\b.*$/i, '').trim();

function Abschnitt({ titel, children }: { titel: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="text-lg font-semibold tracking-tight">{titel}</h2>{children}</section>;
}

function Punkte({ werte, icon: Icon }: { werte: string[]; icon?: LucideIcon }) {
  return <ul className="space-y-1.5">{werte.map(w => <li key={w} className="flex gap-3">
    {Icon ? <Icon className="mt-1.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" /> : <span aria-hidden className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/70" />}
    <span>{w}</span>
  </li>)}</ul>;
}

function Block({ b }: { b: PostingBlock }) {
  const { punkte, absaetze } = aufteilen(b.bullets);
  if (b.id === 'angebot') {
    return <Abschnitt titel={b.title}>
      {b.lead && <p>{b.lead}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {punkte.map(p => { const Icon = symbol(p); return <div key={p} className="flex items-start gap-3 rounded-lg bg-muted/50 px-3.5 py-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /><span className="text-sm leading-6">{p}</span></div>; })}
      </div>
      {absaetze.map(a => <p key={a}>{a}</p>)}
      {b.nachsatz && <blockquote className="border-l-2 border-border pl-4 text-sm italic leading-6 text-muted-foreground">{b.nachsatz.replace(/^Ein Beispiel:\s*/, '')}</blockquote>}
    </Abschnitt>;
  }
  if (b.id === 'ablauf') {
    const schritte = punkte.filter(p => !/^vom ja bis zum vertrag/i.test(p));
    // „Vom Ja bis zum Vertrag: ca. 7 Tage“ nur, wenn kein Schritt die Frist schon nennt (21.10.2026).
    const vertrag = punkte.find(p => /^vom ja bis zum vertrag/i.test(p));
    const schonGenannt = vertrag && schritte.some(s => /\d+\s*(werk)?tag/i.test(s));
    return <Abschnitt titel={b.title}>
      <ol className="space-y-0">
        {schritte.map((s, i) => {
          const ziel = i === schritte.length - 1 && /angebot|vertrag/i.test(s);
          return <li key={s} className="relative flex items-start gap-3 pb-4 last:pb-0">
            {i < schritte.length - 1 && <span aria-hidden className="absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px bg-border" />}
            <span className={cn('relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs', ziel ? 'bg-emerald-500/15 text-emerald-600' : 'bg-primary/10 text-primary')}>{ziel ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
            <span className="text-[15px] leading-6">{s}</span>
          </li>;
        })}
      </ol>
      {vertrag && !schonGenannt && <p className="text-sm text-muted-foreground">{vertrag}</p>}
    </Abschnitt>;
  }
  if (b.id === 'team') {
    // Eine Zeile statt einzelner Punkte: „Team aus 4 Personen · berichtet an: Abteilungsleitung“.
    const zeile = punkte.map((p, i) => (i ? p.charAt(0).toLowerCase() + p.slice(1) : p)).join(' · ');
    return <Abschnitt titel={b.title}>
      {b.lead && <p>{b.lead}</p>}
      {zeile && <p className="text-sm text-muted-foreground">{zeile}</p>}
    </Abschnitt>;
  }
  if (b.id === 'profil') {
    const zwingend = b.gruppen?.find(g => g.titel === 'Zwingend')?.bullets ?? [];
    const vorteil = (b.gruppen?.find(g => g.titel === 'Von Vorteil')?.bullets ?? []).map(ohneVorteil).filter(Boolean);
    return <Abschnitt titel={b.title}>
      {b.lead && <p>{b.lead}</p>}
      {zwingend.length > 0 && <Punkte werte={zwingend} icon={Check} />}
      {vorteil.length > 0 && <p className="text-sm"><span className="text-muted-foreground">Von Vorteil: </span>{vorteil.join(' · ')}</p>}
      {punkte.map(p => <p key={p} className="text-sm text-muted-foreground">{p}</p>)}
    </Abschnitt>;
  }
  return <Abschnitt titel={b.title}>
    {b.lead && <p>{b.lead}</p>}
    {punkte.length > 0 && <Punkte werte={punkte} />}
    {absaetze.map(a => <p key={a}>{a}</p>)}
    {b.gruppen?.map(g => <div key={g.titel} className="space-y-1.5"><p className="font-medium">{g.titel}</p><Punkte werte={g.bullets} /></div>)}
    {b.nachsatz && (/^Arbeitsalltag:\s*/.test(b.nachsatz)
      ? <div className="space-y-1 pt-1"><h3 className="text-[15px] font-semibold">Ein typischer Tag</h3><p>{b.nachsatz.replace(/^Arbeitsalltag:\s*/, '')}</p></div>
      : <p className="text-muted-foreground">{b.nachsatz}</p>)}
  </Abschnitt>;
}

export function StellenanzeigeAnsicht({ posting }: { posting: Posting }) {
  const k = posting.kontakt;
  const kuerzel = (k?.name ?? '').trim().split(/\s+/).slice(0, 2).map(t => t[0]?.toUpperCase()).join('');
  return <div className="max-w-[42rem] space-y-9 text-[15px] leading-7">
    {posting.blocks.map(b => <Block key={b.id} b={b} />)}
    {k?.name && <section className="flex items-center gap-3 border-t border-border pt-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">{kuerzel || '·'}</span>
      <div className="text-sm leading-6"><p className="text-muted-foreground">Deine Ansprechperson</p><p>{[k.name, k.email, k.phone].filter(Boolean).join(' · ')}</p></div>
    </section>}
  </div>;
}
