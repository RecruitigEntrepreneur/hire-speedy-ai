import type { MouseEvent, ReactNode } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { MoreVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { dateFnsLocale } from '@/lib/candidateDateLocale';
import { intlLocale } from '@/i18n/languages';
import { kandidatKuerzel, type KandidatenStand, type Vorgang } from '@/lib/kandidatenStand';
import { cn } from '@/lib/utils';
import type { Candidate } from './CandidateCard';
import type { PoolEintrag } from '@/lib/talentPool';
import { usePoolStand } from './pool/PoolFenster';
import { usePool } from '@/hooks/usePool';

/** Anstehende Aufgabe zum Kandidaten (aus der Aufgaben-Seite). */
export interface KarteAufgabe { label: string; onOpen: () => void }

export interface KandidatKarteProps {
  candidate: Candidate;
  stand: KandidatenStand | null;
  /** Anzahl passender offener Stellen; null solange gerechnet wird. */
  passend: number | null;
  aufgabe: KarteAufgabe | null;
  cvMissing: boolean;
  /** Eintrag im Talent Pool, falls vorhanden */
  pool?: PoolEintrag | null;
  onMelden?: (c: Candidate) => void;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onView: (c: Candidate) => void;
  onPassend: (c: Candidate) => void;
  onEdit: (c: Candidate) => void;
  onDelete: (c: Candidate) => void;
  onAssignTag: (id: string) => void;
  onAddToPool: (c: Candidate) => void;
}

const datum = (iso: string | null, lang: string) => (iso ? new Date(iso).toLocaleDateString(intlLocale(lang), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

/** Stufe eines Vorgangs als Wort, gleiche Wörter wie auf der Pipeline. */
export function useStufenText() {
  const { t } = useTranslation('recruiterSubmissions');
  return (v: Vorgang) => t(`stage.${v.stage}`, { defaultValue: v.stage }) as string;
}

/** Eckdaten in einer Zeile: „Senior · 12 Jahre · 85.000 € · ab Apr. 2027“. Leer, wenn nichts bekannt ist. */
export function useEckdaten() {
  const { t, i18n } = useTranslation(['candidates', 'candidateDetail']);
  return (c: Candidate): string[] => {
    const teile: string[] = [];
    const sen = (c as { seniority?: string | null }).seniority;
    if (sen) teile.push(t(`candidateDetail:facts.seniority.${sen}`, { defaultValue: sen }) as string);
    if (c.experience_years != null) teile.push(t('candidates:list.years', { count: c.experience_years }) as string);
    if (c.expected_salary) teile.push(`${Math.round(c.expected_salary).toLocaleString(intlLocale(i18n.language))} €`);
    const ab = (c as { availability_date?: string | null }).availability_date;
    if (ab) {
      const d = new Date(ab);
      teile.push(d <= new Date()
        ? t('candidates:card.availableNow') as string
        : t('candidates:card.availableFrom', { date: format(d, 'MMM yyyy', { locale: dateFnsLocale(i18n.language) }) }) as string);
    }
    return teile;
  };
}

/** Der Stand unten auf Karte bzw. in der Liste. */
export function StandZeilen({ stand, passend, aufgabe, onPassend, kompakt = false, pool, onMelden }: {
  stand: KandidatenStand | null;
  passend: number | null;
  aufgabe: KarteAufgabe | null;
  onPassend: () => void;
  kompakt?: boolean;
  pool?: PoolEintrag | null;
  onMelden?: () => void;
}) {
  const { t, i18n } = useTranslation('candidates');
  const stufe = useStufenText();
  const poolStand = usePoolStand();
  const { poolName } = usePool();
  const link = 'font-medium text-klick hover:underline';
  const stop = (fn: () => void) => (e: MouseEvent) => { e.stopPropagation(); fn(); };
  if (!stand) return <span className="text-muted-foreground">…</span>;

  let zeilen: ReactNode;
  if (pool && stand.art !== 'prozess') {
    // Talent Pool (25.11.2026): wer später dran ist, zeigt Grund, Fälligkeit und den Link zum Melden
    const ps = poolStand(pool);
    zeilen = <>
      <p className="truncate"><span className="font-medium"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-foreground align-middle" aria-hidden="true" />{poolName(pool) ?? t('pool.label')}</span><span className="text-muted-foreground"> · {t(`pool.reason.${pool.pool_type}`)}</span></p>
      <p className={ps.faellig ? 'font-semibold' : 'text-muted-foreground'}>{ps.text}</p>
      {!kompakt && <p className="truncate text-muted-foreground">{[t(`pool.rhythm.${pool.contact_frequency === 'monthly' ? 'quarterly' : pool.contact_frequency}`), pool.notes ? `„${pool.notes}“` : null].filter(Boolean).join(' · ')}</p>}
      {ps.faellig && onMelden && <p><button type="button" className={cn(link, kompakt && 'text-xs')} onClick={stop(onMelden)}>{t('pool.contactNow')} ›</button></p>}
    </>;
  } else if (stand.art === 'frei' && kompakt) {
    // In der Liste stehen die passenden Stellen in einer eigenen Spalte.
    zeilen = <p>{t('stand.free')}</p>;
  } else if (stand.art === 'frei') {
    zeilen = <p>
      {!kompakt && <><span className="font-medium">{t('stand.free')}</span><span className="text-muted-foreground"> · </span></>}
      {passend == null ? <span className="text-muted-foreground">…</span>
        : passend > 0 ? <button type="button" className={link} onClick={stop(onPassend)}>{t(kompakt ? 'stand.matchesShort' : 'stand.matches', { count: passend })} ›</button>
        : <span className="text-muted-foreground">{t('stand.noMatch')}</span>}
    </p>;
  } else if (stand.art === 'prozess') {
    const h = stand.haupt;
    // Stufe oben, Stelle darunter: lange Stellentitel werden so nicht abgeschnitten
    zeilen = <>
      <p className="truncate">
        {!kompakt && <><span className="font-medium">{t('stand.process')}</span><span className="text-muted-foreground"> · </span></>}
        <span>{stufe(h)}</span>
      </p>
      {h.jobTitle && <p className={cn('truncate text-muted-foreground', kompakt && 'text-xs')}>{h.jobTitle}</p>}
      {!kompakt && stand.weitere.length === 1 && <p className="truncate text-muted-foreground">+ {[stand.weitere[0].jobTitle, stufe(stand.weitere[0])].filter(Boolean).join(' · ')}</p>}
      {!kompakt && stand.weitere.length > 1 && <p className="text-muted-foreground">{t('stand.more', { count: stand.weitere.length })}</p>}
    </>;
  } else {
    const zusatz = stand.startKommt ? t('stand.startOn', { date: datum(stand.start, i18n.language) })
      : stand.garantieVorbei ? t('stand.guaranteeOver')
      : stand.garantieBis ? t('stand.guaranteeUntil', { date: datum(stand.garantieBis, i18n.language) })
      : null;
    // Firma in der ersten Zeile, Start bzw. Garantie darunter, damit nichts abgeschnitten wird
    zeilen = <>
      <p className="truncate">
        <span className="mr-1 inline-block rounded-full bg-green-500/10 px-2 py-px text-xs font-medium text-green-700 dark:text-green-500">{t('stand.placed')}</span>
        {stand.vorgang.company && <span className="text-muted-foreground">{t('stand.placedAt', { company: stand.vorgang.company })}</span>}
      </p>
      {!kompakt && zusatz && <p className="text-muted-foreground">{zusatz}</p>}
    </>;
  }

  return <div className="space-y-0.5">
    {zeilen}
    {aufgabe && stand.art !== 'frei' && <p className="truncate"><button type="button" className={cn(link, kompakt && 'text-xs')} onClick={stop(aufgabe.onOpen)}>{aufgabe.label} ›</button></p>}
  </div>;
}

/** Menü „⋮“: Profil, Kontakt, Pflege, Löschen (Kontakt zieht von der Karte hierher). */
export function KandidatMenue({ c, onView, onEdit, onAssignTag, onAddToPool, onDelete, imPool = false }: {
  c: Candidate; onView: () => void; onEdit: () => void; onAssignTag: () => void; onAddToPool: () => void; onDelete: () => void; imPool?: boolean;
}) {
  const { t } = useTranslation('candidates');
  const linkedin = (c as { linkedin_url?: string | null }).linkedin_url;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={(e) => e.stopPropagation()} aria-label={t('list.actions')}>
        <MoreVertical className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenuItem onClick={onView}>{t('actions.viewDetails')}</DropdownMenuItem>
      {c.phone && <DropdownMenuItem onClick={() => { window.location.href = `tel:${c.phone}`; }}>{t('actions.call')}</DropdownMenuItem>}
      {c.email && <DropdownMenuItem onClick={() => { window.location.href = `mailto:${c.email}`; }}>{t('actions.sendEmail')}</DropdownMenuItem>}
      {linkedin && <DropdownMenuItem onClick={() => window.open(linkedin, '_blank')}>{t('actions.openLinkedin')}</DropdownMenuItem>}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onEdit}>{t('actions.edit')}</DropdownMenuItem>
      <DropdownMenuItem onClick={onAssignTag}>{t('actions.manageTags')}</DropdownMenuItem>
      <DropdownMenuItem onClick={onAddToPool}>{t('pool.menuAdd')}</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">{t('actions.delete')}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/**
 * Kandidaten-Karte „aufgeräumt“ (Vorschlag 1, 24.11.2026): jede Karte gleich aufgebaut und gleich hoch.
 * Kürzel, Name, Rolle · Ort, eine Zeile Eckdaten, bis zu drei Skills, unten der echte Stand mit Link.
 * Auswahl-Kreis erst beim Überfahren (am Handy immer).
 */
export function KandidatKarte(p: KandidatKarteProps) {
  const { t } = useTranslation('candidates');
  const eckdaten = useEckdaten();
  const c = p.candidate;
  const teile = eckdaten(c);
  const rolle = [c.job_title, (c as { city?: string | null }).city].filter(Boolean).join(' · ');
  const skills = c.skills ?? [];

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => p.onView(c)}
      // Enter nur auf der Karte selbst; auf Link, Menü oder Häkchen darin gilt deren eigene Aktion
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) p.onView(c); }}
      className={cn(
        'group relative flex min-h-[13rem] cursor-pointer flex-col rounded-xl border bg-card p-4 text-left transition-[box-shadow,border-color] hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        p.isSelected && 'border-foreground/40 ring-1 ring-foreground/20',
      )}
    >
      <div className={cn('absolute right-12 top-4 transition-opacity', p.isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 max-sm:opacity-100')}
        onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={p.isSelected} onCheckedChange={(v) => p.onSelect(c.id, !!v)} aria-label={c.full_name} className="rounded-full" />
      </div>

      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold text-foreground">{kandidatKuerzel(c.full_name)}</span>
        <div className="min-w-0 flex-1 pr-6">
          <p className="truncate text-[15px] font-semibold leading-tight tracking-tight">{c.full_name}</p>
          <p className={cn('mt-0.5 line-clamp-2 text-[13px] leading-snug', rolle ? 'text-muted-foreground' : 'text-muted-foreground/70')}>{rolle || t('card.roleOpen')}</p>
        </div>
        <KandidatMenue c={c} onView={() => p.onView(c)} onEdit={() => p.onEdit(c)} onAssignTag={() => p.onAssignTag(c.id)} onAddToPool={() => p.onAddToPool(c)} onDelete={() => p.onDelete(c)} imPool={!!p.pool} />
      </div>

      <p className="mt-3 text-[13px]">
        {teile.length
          ? <>{teile.join(' · ')}{p.cvMissing && <span className="text-muted-foreground"> · {t('cvMissing.label')}</span>}</>
          : <span className="text-muted-foreground">{[p.cvMissing ? t('cvMissing.label') : null, t('card.factsOpen')].filter(Boolean).join(' · ')}</span>}
      </p>

      {skills.length > 0 && <div className="mt-2 flex flex-wrap gap-1">
        {skills.slice(0, 3).map((s) => <span key={s} className="max-w-[11rem] truncate rounded-full bg-secondary px-2.5 py-0.5 text-xs">{s}</span>)}
        {skills.length > 3 && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">+{skills.length - 3}</span>}
      </div>}

      <div className="mt-auto pt-4">
        <div className="border-t border-border pt-3 text-[13px]">
          <StandZeilen stand={p.stand} passend={p.passend} aufgabe={p.aufgabe} onPassend={() => p.onPassend(c)} pool={p.pool} onMelden={p.onMelden ? () => p.onMelden!(c) : undefined} />
        </div>
      </div>
    </div>
  );
}
