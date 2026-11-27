/**
 * Offene Stellen, die vielleicht passen (13.11.2026), in der Kandidatenakte:
 *   1 Karte: die ersten 3 offenen Stellen mit Fakten neben den Angaben des Kandidaten
 *   2 Fenster „Alle ansehen“: zur Rolle, weitere Stellen, nach festen Regeln ausgeschlossen
 *
 * Abgleich mit festen Regeln (lib/offeneStellen.ts), keine KI-Stufen mehr: keine Bewertung,
 * der Headhunter entscheidet. Ein Klick auf eine Stelle öffnet ihr Mandatsbriefing; eingereicht
 * wird dort, nachdem er „Ich suche“ gedrückt hat.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from '@/lib/candidateDateLocale';
import { Briefcase, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useCandidateDossier } from '@/hooks/useCandidateDossier';
import { useJobActivation } from '@/hooks/useJobActivation';
import type { MatchV41Row } from '@/hooks/useMatchV41';
import { STELLEN_SPALTEN, offeneStellenAbgleichen, stelleMeta, type AbgleichErgebnis, type KandidatAngaben, type StelleAbgleich, type StelleInfo } from '@/lib/offeneStellen';
import { genitiv, vorname } from '@/lib/vorstellen';
import { cn } from '@/lib/utils';

/** Ort · Arbeitsmodell · Budget, auch für „Vorbereiten“ in den Aufgaben. */
export function jobMeta(r: MatchV41Row): string {
  return r.job ? stelleMeta(r.job) : '';
}

type Status = (jobId: string) => string | null;

function StelleZeile({ a, rollenFakt, status }: { a: StelleAbgleich; rollenFakt?: string | null; status: Status }) {
  const s = status(a.stelle.id);
  const fakten = [rollenFakt, ...a.fakten].filter(Boolean).join(' · ');
  return (
    <li>
      <Link to={`/recruiter/jobs/${a.stelle.id}`} className="group flex items-center gap-3 py-2.5">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium group-hover:underline">{a.stelle.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{stelleMeta(a.stelle)}</span>
          {fakten && <span className="block text-xs text-muted-foreground">{fakten}</span>}
          {/* Am Handy steht der Stand unter dem Text, sonst bleibt für den Text zu wenig Breite */}
          {s && <span className="mt-0.5 block text-xs font-medium text-foreground/80 sm:hidden">{s}</span>}
        </span>
        {s && <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{s}</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

const SPALTEN = STELLEN_SPALTEN;

function useOffeneStellen(candidateId: string) {
  const { user } = useAuth();
  const stellen = useQuery({
    queryKey: ['offene-stellen'],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruiter_jobs_view')
        .select(SPALTEN)
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return ((data ?? []) as unknown as StelleInfo[]).filter((s) => s.id);
    },
  });
  const vorgestellt = useQuery({
    queryKey: ['offene-stellen-vorgestellt', candidateId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('submissions')
        .select('job_id, submitted_at')
        .eq('candidate_id', candidateId)
        .eq('recruiter_id', user!.id);
      return new Map(((data ?? []) as { job_id: string | null; submitted_at: string | null }[])
        .filter((s) => s.job_id)
        .map((s) => [s.job_id as string, s.submitted_at]));
    },
  });
  return { stellen, vorgestellt };
}

export function PassendeStellenCard({ candidateId, firstName }: {
  candidateId: string;
  firstName: string;
}) {
  const { t, i18n } = useTranslation(['candidateDetail', 'candidateTerms']);
  const akte = useCandidateDossier(candidateId);
  const { stellen, vorgestellt } = useOffeneStellen(candidateId);
  const { isActivated } = useJobActivation();
  const [fenster, setFenster] = useState<null | 'liste' | 'gruende'>(null);
  // „N Stellen passen ›“ aus der Kandidatenliste öffnet hier direkt die Liste (24.11.2026)
  const [params, setParams] = useSearchParams();

  const f = akte.form;
  const v = vorname(f.full_name || firstName);
  const ergebnis = useMemo<AbgleichErgebnis | null>(() => {
    if (akte.loading || !stellen.data) return null;
    const k: KandidatAngaben = {
      vorname: v,
      job_title: f.job_title,
      target_roles: f.target_roles,
      city: f.city,
      remote_preference: f.remote_preference,
      expected_salary: f.expected_salary,
      salary_minimum: f.salary_minimum,
      relocation_willing: f.relocation_willing,
      languages: f.languages,
    };
    return offeneStellenAbgleichen(k, stellen.data);
    // i18n.language: Fakten und Gründe sind Text in der Sprache der Oberfläche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [akte.loading, stellen.data, v, f.job_title, f.target_roles, f.city, f.remote_preference, f.expected_salary, f.salary_minimum, f.relocation_willing, f.languages, i18n.language]);

  const status: Status = (jobId) => {
    const am = vorgestellt.data?.get(jobId);
    if (vorgestellt.data?.has(jobId)) {
      return am ? t('openJobs.presentedOn', { date: format(new Date(am), t('openJobs.dateFormat'), { locale: dateFnsLocale(i18n.language) }) }) : t('openJobs.presented');
    }
    return isActivated(jobId) ? t('openJobs.activated') : null;
  };

  useEffect(() => {
    if (!ergebnis || params.get('stellen') !== '1') return;
    setFenster('liste');
    const next = new URLSearchParams(params);
    next.delete('stellen');
    setParams(next, { replace: true });
  }, [ergebnis, params, setParams]);

  const zurRolle = ergebnis?.zurRolle ?? [];
  const offen = [...zurRolle, ...(ergebnis?.weitere ?? [])];
  const top = offen.slice(0, 3);
  const ausgeschlossen = ergebnis?.ausgeschlossen.length ?? 0;
  const rollenFakt = ergebnis?.rollenQuelle === 'wunsch' ? t('openJobs.roleWish', { genitive: genitiv(v), name: v }) : t('openJobs.roleToday');

  return (
    <Card data-tour="dossier.jobs">
      <CardHeader className="space-y-1 pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-[15px] font-semibold tracking-tight">{t('openJobs.title')}</CardTitle>
          {offen.length > 0 && (
            <button type="button" className="shrink-0 text-sm font-medium text-klick hover:underline" onClick={() => setFenster('liste')}>
              {t('openJobs.viewAll', { n: offen.length })} ›
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t('openJobs.intro')}</p>
      </CardHeader>
      <CardContent>
        {stellen.error ? (
          <p className="py-1 text-sm text-destructive">{t('openJobs.loadFailed')}</p>
        ) : !ergebnis ? (
          <div className="space-y-3 py-1">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : top.length === 0 ? (
          <div className="space-y-1 py-1 text-sm text-muted-foreground">
            <p>{ausgeschlossen > 0 ? t('openJobs.allExcluded') : t('openJobs.none')}</p>
            {ausgeschlossen > 0 && (
              <button type="button" className="text-xs text-foreground hover:underline" onClick={() => setFenster('gruende')}>
                {t('openJobs.reasons')}
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {top.map((a) => <StelleZeile key={a.stelle.id} a={a} rollenFakt={a.rolle ? rollenFakt : null} status={status} />)}
          </ul>
        )}
      </CardContent>

      {ergebnis && (
        <OffeneStellenFenster
          open={!!fenster}
          gruendeOffen={fenster === 'gruende'}
          onClose={() => setFenster(null)}
          name={v}
          ergebnis={ergebnis}
          status={status}
          aktiviert={isActivated}
          vorgestellt={(id) => !!vorgestellt.data?.has(id)}
        />
      )}
    </Card>
  );
}

type Reiter = 'alle' | 'aktiviert' | 'vorgestellt';

function GruppenKopf({ titel, rechts, onClick }: { titel: string; rechts?: string; onClick?: () => void }) {
  const inhalt = (
    <>
      <span className="text-xs font-medium text-muted-foreground">{titel}</span>
      {rechts && <span className="truncate text-xs text-muted-foreground">{rechts}</span>}
    </>
  );
  const klasse = 'flex w-full items-baseline justify-between gap-3 border-b border-border pb-1.5 pt-5 text-left';
  return onClick
    ? <button type="button" onClick={onClick} className={cn(klasse, 'hover:text-foreground')}>{inhalt}</button>
    : <div className={klasse}>{inhalt}</div>;
}

function OffeneStellenFenster({ open, gruendeOffen, onClose, name: v, ergebnis, status, aktiviert, vorgestellt }: {
  open: boolean;
  gruendeOffen: boolean;
  onClose: () => void;
  name: string;
  ergebnis: AbgleichErgebnis;
  status: Status;
  aktiviert: (jobId: string) => boolean;
  vorgestellt: (jobId: string) => boolean;
}) {
  const { t } = useTranslation('candidateDetail');
  const [reiter, setReiter] = useState<Reiter>('alle');
  const [suche, setSuche] = useState('');
  const [weitereAuf, setWeitereAuf] = useState(false);
  const [ausAuf, setAusAuf] = useState<boolean | null>(null);
  const [grundAuf, setGrundAuf] = useState<string | null>(null);

  // Jedes Öffnen beginnt aufgeräumt.
  useEffect(() => {
    if (!open) return;
    setReiter('alle'); setSuche(''); setWeitereAuf(false); setAusAuf(null); setGrundAuf(null);
  }, [open]);

  const q = suche.trim().toLowerCase();
  const passt = (a: StelleAbgleich) =>
    (reiter === 'alle' || (reiter === 'aktiviert' ? aktiviert(a.stelle.id) : vorgestellt(a.stelle.id)))
    && (!q || `${a.stelle.title} ${stelleMeta(a.stelle)}`.toLowerCase().includes(q));

  const alleOffen = [...ergebnis.zurRolle, ...ergebnis.weitere];
  const zahl: Record<Reiter, number> = {
    alle: alleOffen.length,
    aktiviert: [...alleOffen, ...ergebnis.ausgeschlossen].filter((a) => aktiviert(a.stelle.id)).length,
    vorgestellt: [...alleOffen, ...ergebnis.ausgeschlossen].filter((a) => vorgestellt(a.stelle.id)).length,
  };
  const REITER: Record<Reiter, string> = { alle: t('jobs.filter.alle'), aktiviert: t('openJobs.activated'), vorgestellt: t('openJobs.tabPresented') };

  const mitRolle = ergebnis.rollenQuelle !== null;
  const rolle = ergebnis.zurRolle.filter(passt);
  const weitere = ergebnis.weitere.filter(passt);
  const aus = ergebnis.ausgeschlossen.filter(passt);
  const gefiltert = reiter !== 'alle' || !!q;
  // Eingeklappt nur, wenn oben Stellen zur Rolle stehen und nicht gesucht oder gefiltert wird.
  const weitereGanz = weitereAuf || gefiltert || !mitRolle || rolle.length === 0;
  const ausOffen = ausAuf ?? (gruendeOffen || gefiltert);

  const nachGrund = new Map<string, StelleAbgleich[]>();
  for (const a of aus) nachGrund.set(a.ausschluss!, [...(nachGrund.get(a.ausschluss!) ?? []), a]);
  const gruende = [...nachGrund.entries()].sort((x, y) => y[1].length - x[1].length);

  const g = { genitive: genitiv(v), name: v };
  const sortierung = ergebnis.rollenQuelle === 'wunsch'
    ? t('openJobs.sortWish', g)
    : ergebnis.rollenQuelle === 'heute'
      ? t('openJobs.sortToday', g)
      : t('openJobs.sortPlace');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 p-0 sm:max-w-[640px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="space-y-1.5 border-b border-border px-6 pb-4 pt-6 text-left">
          <DialogTitle>{t('openJobs.dialogTitle', { name: v })}</DialogTitle>
          <DialogDescription>{sortierung} {t('openJobs.rules')}</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder={t('openJobs.search')} className="h-8 w-52 pl-8 text-sm" />
            </div>
            {(Object.keys(REITER) as Reiter[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReiter(r)}
                className={cn('rounded-full border px-2.5 py-1 text-xs', reiter === r ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:bg-muted')}
              >
                {REITER[r]} {zahl[r]}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          {mitRolle && (
            <>
              <GruppenKopf
                titel={`${ergebnis.rollenQuelle === 'wunsch' ? t('openJobs.roleWish', g) : t('openJobs.roleToday')} · ${rolle.length}`}
                rechts={ergebnis.rollen.join(', ')}
              />
              {rolle.length ? (
                <ul className="divide-y divide-border">{rolle.map((a) => <StelleZeile key={a.stelle.id} a={a} status={status} />)}</ul>
              ) : (
                <p className="py-3 text-sm text-muted-foreground">{gefiltert ? t('openJobs.noHits') : t('openJobs.noneForRole')}</p>
              )}
            </>
          )}

          <GruppenKopf
            titel={`${mitRolle ? t('openJobs.otherJobs') : t('openJobs.openJobs')} · ${weitere.length}`}
            rechts={mitRolle && rolle.length > 0 && !gefiltert && weitere.length > 3 ? (weitereAuf ? t('openJobs.collapse') : t('openJobs.expand')) : undefined}
            onClick={mitRolle && rolle.length > 0 && !gefiltert && weitere.length > 3 ? () => setWeitereAuf((x) => !x) : undefined}
          />
          {weitere.length ? (
            <ul className="divide-y divide-border">
              {(weitereGanz ? weitere : weitere.slice(0, 3)).map((a) => <StelleZeile key={a.stelle.id} a={a} status={status} />)}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">{gefiltert ? t('openJobs.noHits') : t('openJobs.noOthers')}</p>
          )}
          {!weitereGanz && weitere.length > 3 && (
            <p className="py-2 text-xs text-muted-foreground">
              {t('openJobs.more', { n: weitere.length - 3 })} <button type="button" className="text-foreground hover:underline" onClick={() => setWeitereAuf(true)}>{t('openJobs.showAll')}</button>
            </p>
          )}

          {aus.length > 0 && (
            <>
              <GruppenKopf
                titel={`${t('openJobs.excluded')} · ${aus.length}`}
                rechts={ausOffen ? t('openJobs.collapse') : t('openJobs.reasonsOpen')}
                onClick={() => setAusAuf(!ausOffen)}
              />
              {ausOffen && (
                <ul className="divide-y divide-border">
                  {gruende.map(([grund, liste]) => (
                    <li key={grund}>
                      <button type="button" onClick={() => setGrundAuf(grundAuf === grund ? null : grund)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm">
                        <span>{grund}</span>
                        <span className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                          {t('openJobs.jobs', { count: liste.length })}
                          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', grundAuf === grund && 'rotate-90')} />
                        </span>
                      </button>
                      {grundAuf === grund && (
                        <ul className="mb-2 divide-y divide-border border-l border-border pl-3">
                          {liste.map((a) => <StelleZeile key={a.stelle.id} a={a} status={status} />)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
          <span className="text-xs text-muted-foreground">{t('openJobs.footer')}</span>
          <Button variant="outline" size="sm" onClick={onClose}>{t('openJobs.close')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
