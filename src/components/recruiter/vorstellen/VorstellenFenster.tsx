// Einreichungsweg „Vorstellen“ (09.11.2026, Marko: „maximal professionell den gesamten
// Einreichungsweg“). Ein Fenster mit fester Breite und linker Spalte, egal ob vom Profil
// (Stelle wählen) oder von der Stelle (Kandidat wählen):
//
//   Auswahl → Kundenfrage (nur beim ersten Mal je Firma) → Passung → Kundenansicht → Abschicken → Fertig
//
// Ersetzt das Formular vom 13./14.10.2026 („ein Fenster, kein Prüfschritt“) – Marko hat die
// Schritte am 09.11.2026 freigegeben. Was bleibt: Muss-Kriterien prüft die KI im Hintergrund und
// sperrt nie (DSGVO Art. 22, EU AI Act); harte Warnungen bestätigt der Headhunter per Klick;
// unpassende Kandidaten (Matching „ausgeschlossen“, auch Sperrliste) sind gesperrt.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import {
  AlertCircle, Check, ChevronLeft, ChevronRight, EyeOff, FileText, FileUp, Loader2, Mail, MessageCircle, MessageSquareX, Search, Send, ShieldCheck, Upload, UserCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { intlLocale } from '@/i18n/languages';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { LebenslaufAblage } from '@/components/candidates/LebenslaufAblage';
import { InterviewInsightsCard } from '@/components/candidates/client/ClientCandidateCards';
import { verfuegbarAus, type InterviewInsights } from '@/components/candidates/client/useCandidateInsights';
import { LebenslaufAnfragenFenster } from '@/components/recruiter/termin/LebenslaufAnfragenFenster';
import { ClientQuestionFlow } from '@/components/recruiter/search/ClientQuestionFlow';
import { useActivationGate } from '@/components/recruiter/ActivateJobDialog';
import { fetchDossier } from '@/hooks/useCandidateDossier';
import { confirmCvCurrent, cvViewUrl } from '@/hooks/useCandidateCv';
import { useMatchV41 } from '@/hooks/useMatchV41';
import { usePoolFit } from '@/hooks/usePoolFit';
import { ablageAnfragen, ablageMelden } from '@/lib/lebenslaufAblage';
import { anonymizeRegionBroad, candidateAnonCode } from '@/lib/anonymization';
import { cvAgeMonths, cvStandDate, formatCvDate, isCvStale, type CurrentCv } from '@/lib/candidateCv';
import { WORK_MODEL_OPTIONS, formatEuro, optionLabel, type DossierForm, type Readiness } from '@/lib/candidateDossier';
import { term } from '@/lib/candidateTerms';
import { clientTextIssues } from '@/lib/clientTextCheck';
import { functionError } from '@/lib/functionError';
import { useVerdecke } from '@/lib/honorarVerdeckt';
import { candidateLanguage } from '@/lib/localeFormat';
import { wunschBand } from '@/lib/interviewViews';
import { mySearches, type MySearch } from '@/lib/jobSearch';
import { FIT_LABEL, byFit, fitOf, isFitting, type Fit } from '@/lib/matchFit';
import { earningFor } from '@/lib/submissionNotify';
import type { FitJob } from '@/lib/fitCheck';
import { getRecruiterCriteria } from '@/lib/recruiterBriefing';
import { useVorstellung, type Vorstellung } from './useVorstellung';
import { bescheidBetreff, bescheidText, genitiv, passungsZahl, passungsZeilen, vorname } from '@/lib/vorstellen';
import { useRecruiterKontakt } from '@/hooks/useRecruiterKontakt';

type JobRow = Record<string, unknown> & { id: string; title: string };
type Schritt = 'auswahl' | 'kundenfrage' | 'passung' | 'kunde' | 'abschicken' | 'fertig';

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === 'number' ? v : null);
// Texte im Namespace recruiterVorstellen
const NS = 'recruiterVorstellen';

const budget = (j: Record<string, unknown> | null, t: TFunction) => {
  const min = num(j?.salary_min), max = num(j?.salary_max);
  return max ? (min ? `${Math.round(min / 1000)}–${Math.round(max / 1000)}k` : t('rail.budgetUpTo', { k: Math.round(max / 1000) })) : null;
};
const buero = (j: Record<string, unknown> | null, t: TFunction) => {
  const tage = num(j?.onsite_days_required);
  const typ = str(j?.remote_type);
  if (typ === 'remote') return t('rail.remote');
  if (tage) return t('rail.officeDays', { count: tage });
  return typ === 'hybrid' ? t('rail.hybrid') : typ === 'onsite' ? t('rail.onsite') : null;
};
/** Datum in der Sprache der Oberfläche */
const datum = (v: string | number | Date, lang: string) => new Date(v).toLocaleDateString(intlLocale(lang));
/** „8 J. · München · 85.000 €“ */
const eckdaten = (f: Pick<DossierForm, 'experience_years' | 'city' | 'expected_salary'>, t: TFunction) =>
  [f.experience_years ? t('rail.yearsShort', { n: f.experience_years }) : null, f.city || null, f.expected_salary ? formatEuro(f.expected_salary) : null].filter(Boolean).join(' · ');

// ---------------------------------------------------------------------------
// Rahmen: Kopf mit Schrittleiste, linke Spalte, Inhalt, Fuß
// ---------------------------------------------------------------------------

function Rahmen({ schritte, aktuell, rail, children, fuss }: { schritte: Exclude<Schritt, 'fertig'>[]; aktuell: Schritt; rail: ReactNode; children: ReactNode; fuss: ReactNode }) {
  const { t } = useTranslation(NS);
  const idx = aktuell === 'fertig' ? schritte.length : schritte.indexOf(aktuell as Exclude<Schritt, 'fertig'>);
  return (
    <div className="flex max-h-[88vh] min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-5 py-3 pr-12 max-md:pr-5">
        <DialogTitle className="text-base font-semibold max-md:pr-8">{t('title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('description')}</DialogDescription>
        {/* Handy (17.11.2026): Schritte in einer Zeile, notfalls zum Wischen */}
        <ol className="handy-wischen flex flex-wrap items-center gap-1 text-xs text-muted-foreground max-md:w-full max-md:min-w-0">
          {schritte.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 opacity-50 max-md:hidden" aria-hidden />}
              <span className={cn('rounded-full px-2 py-0.5 max-md:px-1.5', i === idx ? 'bg-foreground text-background' : i < idx ? 'text-foreground' : '')} aria-current={i === idx ? 'step' : undefined}>
                {i < idx && <Check className="mr-0.5 inline h-3 w-3" aria-hidden />}{t(`steps.${s}`)}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[13rem_minmax(0,1fr)]">
        <aside className="hidden min-h-0 overflow-y-auto border-r border-border bg-card p-4 md:block">{rail}</aside>
        <div className="min-h-0 min-w-0 overflow-y-auto p-5">{children}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">{fuss}</div>
    </div>
  );
}

function RailBlock({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="mb-1 text-xs font-medium text-muted-foreground">{titel}</p>
      {children}
    </div>
  );
}

function StelleRail({ job, firma }: { job: JobRow | null; firma: string | null }) {
  const { t, i18n } = useTranslation(NS);
  const verdecke = useVerdecke();
  if (!job) return null;
  const geld = earningFor(job);
  return (
    <RailBlock titel={t('rail.job')}>
      <p className="text-sm font-medium leading-snug">{job.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {[firma, [str(job.industry), str(job.location)].filter(Boolean).join(' · '), [budget(job, t), buero(job, t)].filter(Boolean).join(' · ')].filter(Boolean).map((z) => <span key={z} className="block">{z}</span>)}
        {geld && <span className="mt-1 block text-foreground">{verdecke(t('rail.forYou', { amount: geld.toLocaleString(intlLocale(i18n.language)) }))}</span>}
      </p>
    </RailBlock>
  );
}

// ---------------------------------------------------------------------------
// Fenster
// ---------------------------------------------------------------------------

export function VorstellenFenster({
  open,
  onOpenChange,
  candidate = null,
  job: jobProp = null,
  jobId: jobIdProp = null,
  initialJobId = null,
  onSubmitted,
  onOpenInterview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Vom Profil: Kandidat steht fest, gewählt wird die Stelle. Von der Stelle mit „für“: beides fest. */
  candidate?: { id: string; name: string } | null;
  /** Von der Stelle: Stelle steht fest (Zeile aus recruiter_jobs_view). */
  job?: JobRow | null;
  /** Von der Stelle, wenn nur die ID bekannt ist (Schnell-Einreichen in der Jobliste). */
  jobId?: string | null;
  /** Aus „Passende Stellen“: diese Stelle gleich öffnen, wenn sie aktiv ist. */
  initialJobId?: string | null;
  onSubmitted?: () => void;
  /** Interview fortsetzen; danach öffnet der Aufrufer das Vorstellen wieder (Profil). */
  onOpenInterview?: (candidateId: string, jobId: string | null) => void;
}) {
  const { t } = useTranslation(NS);
  const stelleFest = !!(jobProp || jobIdProp);
  const kandidatFest = !!candidate;
  const [schritt, setSchritt] = useState<Schritt>('auswahl');
  const [job, setJob] = useState<JobRow | null>(jobProp);
  const [kandidat, setKandidat] = useState<{ id: string; name: string } | null>(candidate);
  const [mitKundenfrage, setMitKundenfrage] = useState(false);
  const [searches, setSearches] = useState<Map<string, MySearch>>(new Map());

  // Bei jedem Öffnen frisch: feste Teile übernehmen, sonst bei der Auswahl beginnen.
  useEffect(() => {
    if (!open) return;
    setJob(jobProp);
    setKandidat(candidate);
    setMitKundenfrage(false);
    setSchritt(stelleFest && kandidatFest ? 'passung' : 'auswahl');
    mySearches().then((rows) => setSearches(new Map((rows ?? []).map((r) => [r.job_id, r])))).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Nur die ID bekannt: Stelle nachladen.
  useEffect(() => {
    if (!open || jobProp || !jobIdProp) return;
    supabase.from('recruiter_jobs_view').select('*').eq('id', jobIdProp).maybeSingle()
      .then(({ data }) => { if (data) setJob(data as unknown as JobRow); });
  }, [open, jobProp, jobIdProp]);

  const firma = job ? str(job.company_name) ?? searches.get(job.id)?.company_name ?? null : null;
  const schritte = useMemo(() => {
    const s: Exclude<Schritt, 'fertig'>[] = [];
    if (!(stelleFest && kandidatFest)) s.push('auswahl');
    if (mitKundenfrage) s.push('kundenfrage');
    s.push('passung', 'kunde', 'abschicken');
    return s;
  }, [stelleFest, kandidatFest, mitKundenfrage]);

  const zurAuswahl = () => {
    if (!stelleFest) setJob(null);
    if (!kandidatFest) setKandidat(null);
    setMitKundenfrage(false);
    setSchritt('auswahl');
  };

  const stelleGewaehlt = (j: JobRow) => {
    setJob(j);
    // Vor der ersten Einreichung muss „Kennst du X schon?“ beantwortet sein.
    if (!searches.get(j.id)?.client_declaration) { setMitKundenfrage(true); setSchritt('kundenfrage'); }
    else setSchritt('passung');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl gap-0 overflow-hidden p-0" data-tour="vorstellen.window">
        {schritt === 'auswahl' && kandidatFest && kandidat ? (
          <StellenWahl kandidat={kandidat} searches={searches} initialJobId={initialJobId} schritte={schritte}
            onWahl={stelleGewaehlt} onClose={() => onOpenChange(false)} />
        ) : schritt === 'auswahl' && job ? (
          <KandidatWahl job={job} firma={firma} schritte={schritte}
            onWahl={(k) => { setKandidat(k); setSchritt('passung'); }} onClose={() => onOpenChange(false)} />
        ) : schritt === 'kundenfrage' && job && kandidat ? (
          <Rahmen schritte={schritte} aktuell="kundenfrage" rail={<><StelleRail job={job} firma={firma} /><RailBlock titel={t('rail.candidate')}><p className="text-sm font-medium">{kandidat.name}</p></RailBlock></>}
            fuss={<><Button variant="outline" onClick={zurAuswahl}><ChevronLeft className="mr-1 h-4 w-4" />{t('back')}</Button><span className="text-xs text-muted-foreground">{t('clientQuestion.onceHint')}</span></>}>
            <ClientQuestionFlow jobId={job.id} jobTitle={job.title} companyName={firma}
              onDone={(answer) => {
                setSearches((m) => new Map(m).set(job.id, { ...(m.get(job.id) as MySearch), client_declaration: answer === 'no' ? 'no:none' : 'client:pending' }));
                if (answer === 'direct_position') { toast.message(t('clientQuestion.searchRests')); zurAuswahl(); return; }
                setSchritt('passung');
              }} />
          </Rahmen>
        ) : job && kandidat ? (
          <VorstellenAblauf key={`${job.id}:${kandidat.id}`} job={job} firma={firma} kandidat={kandidat} schritt={schritt} setSchritt={setSchritt} schritte={schritte}
            auswahlMoeglich={!(stelleFest && kandidatFest)} kandidatFest={kandidatFest} stelleFest={stelleFest}
            onAuswahl={zurAuswahl} onClose={() => onOpenChange(false)} onSubmitted={onSubmitted} onOpenInterview={onOpenInterview} />
        ) : (
          <div className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground">
            <DialogTitle className="sr-only">{t('title')}</DialogTitle>
            <Loader2 className="h-4 w-4 animate-spin" /> {t('loading')}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Auswahl vom Profil: Stelle wählen
// ---------------------------------------------------------------------------

function StellenWahl({ kandidat, searches, initialJobId, schritte, onWahl, onClose }: {
  kandidat: { id: string; name: string };
  searches: Map<string, MySearch>;
  initialJobId: string | null;
  schritte: Exclude<Schritt, 'fertig'>[];
  onWahl: (j: JobRow) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const gate = useActivationGate();
  const verdecke = useVerdecke();
  const { t, i18n } = useTranslation(NS);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [eingereicht, setEingereicht] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [vorgewaehlt, setVorgewaehlt] = useState(false);
  const name = vorname(kandidat.name);

  // Nur Stellen, zu denen der Kandidat laut Matching passt (wie „Passende Stellen“ im Profil).
  const match = useMatchV41(kandidat.id);
  const fitByJob = useMemo(() => new Map<string, Fit>(match.rows.map((r) => [r.job_id, fitOf(r.tier, r.override?.decision)])), [match.rows]);
  const matchDown = match.unavailable || !!match.error;
  const zeigt = (j: JobRow) => matchDown || eingereicht.has(j.id) || isFitting(fitByJob.get(j.id));

  useEffect(() => {
    if (!user) return;
    gate.refetch();
    Promise.all([
      supabase.from('recruiter_jobs_view').select('*').eq('status', 'published').order('created_at', { ascending: false }),
      supabase.from('submissions').select('job_id').eq('candidate_id', kandidat.id).eq('recruiter_id', user.id),
    ]).then(([j, s]) => {
      setJobs(((j.data ?? []) as unknown as JobRow[]).filter((x) => x.id && x.title));
      setEingereicht(new Set(((s.data ?? []) as Array<{ job_id: string | null }>).map((x) => x.job_id ?? '').filter(Boolean)));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, kandidat.id]);

  // Aus „Passende Stellen“: aktive Stelle gleich öffnen.
  useEffect(() => {
    if (vorgewaehlt || !initialJobId || loading || gate.loading) return;
    setVorgewaehlt(true);
    const found = jobs.find((j) => j.id === initialJobId);
    if (found && gate.isActivated(found.id) && !eingereicht.has(found.id)) onWahl(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJobId, loading, gate.loading, jobs, eingereicht]);

  const q = query.trim().toLowerCase();
  const gefiltert = jobs.filter((j) => !q || [j.title, j.location, j.industry].some((v) => typeof v === 'string' && v.toLowerCase().includes(q)));
  const sortiert = (l: JobRow[]) => [...l].sort((a, b) => {
    const fa = fitByJob.get(a.id), fb = fitByJob.get(b.id);
    return fa && fb ? byFit(fa, fb) : fa ? -1 : fb ? 1 : 0;
  });
  const aktiv = sortiert(gefiltert.filter((j) => gate.isActivated(j.id) && zeigt(j)));
  const weitere = sortiert(gefiltert.filter((j) => !gate.isActivated(j.id) && zeigt(j)));
  const fitPill = (j: JobRow) => {
    const f = fitByJob.get(j.id);
    return isFitting(f) ? <Pill>{term(FIT_LABEL[f!])}</Pill> : null;
  };
  const unterzeile = (j: JobRow) => {
    const geld = earningFor(j);
    return [str(j.industry), str(j.location), budget(j, t), geld ? verdecke(t('rail.forYou', { amount: geld.toLocaleString(intlLocale(i18n.language)) })) : null].filter(Boolean).join(' · ');
  };

  return (
    <Rahmen schritte={schritte} aktuell="auswahl"
      rail={<KandidatRailSchlicht id={kandidat.id} name={kandidat.name} />}
      fuss={<><Button variant="outline" onClick={onClose}>{t('cancel')}</Button><span className="text-xs text-muted-foreground">{t('jobPick.footerHint')}</span></>}>
      <h3 className="mb-3 text-lg font-semibold">{t('jobPick.title', { name })}</h3>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('jobPick.search')} className="pl-8" autoFocus />
      </div>
      {loading || gate.loading || (match.loading && !matchDown) ? (
        <Lade text={t('jobPick.loading')} />
      ) : (
        <div className="space-y-5">
          <Gruppe titel={t('jobPick.mySearches', { used: gate.activeCount, max: gate.maxSlots })}>
            {aktiv.length === 0 ? (
              <Leer>{q ? t('jobPick.noneMatchQuery') : t('jobPick.noneFits', { name })}</Leer>
            ) : aktiv.map((j) => (
              eingereicht.has(j.id) ? (
                <Zeile key={j.id} gedimmt titel={j.title} unter={t('jobPick.alreadyHere', { name })} rechts={<Pill>{t('jobPick.presented')}</Pill>} />
              ) : (
                <Zeile key={j.id} stelle={j.id} titel={j.title} unter={unterzeile(j)} rechts={<>{fitPill(j)}<ChevronRight className="h-4 w-4 text-muted-foreground" /></>} onClick={() => onWahl(j)} />
              )
            ))}
          </Gruppe>
          {weitere.length > 0 && (
            <Gruppe titel={t('jobPick.moreFitting')}>
              {weitere.map((j) => (
                <Zeile key={j.id} titel={j.title} unter={unterzeile(j)}
                  rechts={typeof j.paused_at === 'string' && j.paused_at ? <span className="text-xs text-muted-foreground">{t('jobPick.paused')}</span> : <>{fitPill(j)}<Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => { onClose(); navigate(`/recruiter/jobs/${j.id}?fuer=${kandidat.id}`); }}>{t('jobPick.view')}</Button></>} />
              ))}
            </Gruppe>
          )}
        </div>
      )}
    </Rahmen>
  );
}

function KandidatRailSchlicht({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation(NS);
  // Rohdaten merken, Texte erst beim Anzeigen bilden (folgt der Sprache)
  const [r, setR] = useState<{ form: DossierForm; interview: boolean; cv: CurrentCv | null } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchDossier(id).then(({ form: f, readiness, cv }) => {
      if (!alive) return;
      setR({ form: f, interview: !!readiness.items.find((i) => i.key === 'interview')?.ok, cv });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [id]);
  const stand = r ? [r.interview ? t('rail.interviewDone') : t('rail.interviewOpen'), r.cv ? t('rail.cvDated', { date: formatCvDate(cvStandDate(r.cv)) }) : t('rail.cvMissing')].join('\n') : '';
  return (
    <RailBlock titel={t('rail.candidate')}>
      <p className="text-sm font-medium leading-snug">{name}</p>
      {r && (
        <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
          {[r.form.job_title, eckdaten(r.form, t)].filter(Boolean).join('\n')}
          {'\n\n'}{stand}
        </p>
      )}
    </RailBlock>
  );
}

// ---------------------------------------------------------------------------
// Auswahl von der Stelle: Kandidat wählen
// ---------------------------------------------------------------------------

interface KandidatInfo { id: string; full_name: string; job_title: string | null }
interface Bereitschaft { readiness: Readiness; form: DossierForm; cv: CurrentCv | null }

function KandidatWahl({ job, firma, schritte, onWahl, onClose }: {
  job: JobRow;
  firma: string | null;
  schritte: Exclude<Schritt, 'fertig'>[];
  onWahl: (k: { id: string; name: string }) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(NS);
  const [alle, setAlle] = useState<KandidatInfo[]>([]);
  const [alleFast, setAlleFast] = useState(false);
  const [vorgestellt, setVorgestellt] = useState<Map<string, string | null>>(new Map());
  const [schonListe, setSchonListe] = useState<KandidatInfo[]>([]);
  const [bereit, setBereit] = useState<Map<string, Bereitschaft>>(new Map());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('candidates').select('id, full_name, job_title').eq('recruiter_id', user.id).order('created_at', { ascending: false }).limit(80)
      .then(({ data }) => setAlle((data ?? []) as KandidatInfo[]));
    supabase.from('submissions').select('candidate_id, submitted_at').eq('job_id', job.id).eq('recruiter_id', user.id)
      .then(async ({ data }) => {
        const rows = (data ?? []) as Array<{ candidate_id: string; submitted_at: string | null }>;
        setVorgestellt(new Map(rows.map((s) => [s.candidate_id, s.submitted_at])));
        // Auch Vorgestellte, die nicht (mehr) als passend gelten oder älter sind: wer schon im Rennen ist.
        if (!rows.length) { setSchonListe([]); return; }
        const { data: c } = await supabase.from('candidates').select('id, full_name, job_title').in('id', rows.map((r) => r.candidate_id));
        setSchonListe((c ?? []) as KandidatInfo[]);
      });
  }, [user, job.id]);

  // Nur passende Kandidaten (Matching je Stelle, fehlende im Hintergrund geprüft).
  const pool = usePoolFit(job.id, alle.map((k) => k.id));
  const passend = useMemo(() => alle.filter((k) => isFitting(pool.fit.get(k.id))).sort((a, b) => byFit(pool.fit.get(a.id)!, pool.fit.get(b.id)!)), [alle, pool.fit]);

  // Bereitschaft je passendem Kandidaten (Interview, Einschätzung, Lebenslauf)
  useEffect(() => {
    const offen = passend.filter((k) => !bereit.has(k.id)).slice(0, 30);
    if (!offen.length) return;
    let alive = true;
    Promise.all(offen.map((k) => fetchDossier(k.id).then((d) => [k.id, d] as const).catch(() => null))).then((rows) => {
      if (!alive) return;
      setBereit((m) => {
        const n = new Map(m);
        for (const r of rows) {
          if (!r) continue;
          const [id, d] = r;
          n.set(id, { readiness: d.readiness, cv: d.cv, form: d.form });
        }
        return n;
      });
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passend]);

  const q = query.trim().toLowerCase();
  const sichtbar = passend.filter((k) => !q || [k.full_name, k.job_title].some((v) => (v ?? '').toLowerCase().includes(q)));
  const jetzt = sichtbar.filter((k) => !vorgestellt.has(k.id) && bereit.get(k.id)?.readiness.isReady);
  // Wer am nächsten dran ist, steht oben.
  const fast = sichtbar.filter((k) => !vorgestellt.has(k.id) && bereit.has(k.id) && !bereit.get(k.id)!.readiness.isReady)
    .sort((a, b) => bereit.get(b.id)!.readiness.done - bereit.get(a.id)!.readiness.done);
  const FAST_ERST = 5;
  const schon = schonListe
    .filter((k) => !q || [k.full_name, k.job_title].some((v) => (v ?? '').toLowerCase().includes(q)))
    .sort((a, b) => String(vorgestellt.get(b.id) ?? '').localeCompare(String(vorgestellt.get(a.id) ?? '')));
  const laedt = pool.checking || sichtbar.some((k) => !vorgestellt.has(k.id) && !bereit.has(k.id));

  // Anklickbar wie alle anderen (09.11.2026: „wir können keinen wählen“): Was fehlt,
  // steht im nächsten Schritt mit dem Knopf, der es löst.
  const fehlt = (b: Bereitschaft) => {
    const m = b.readiness.missing.map((x) => x.label);
    if (!m.length) return '';
    const list = m.slice(0, 2).join(', ');
    return m.length > 2 ? t('candidatePick.missingMore', { list, count: m.length - 2 }) : t('candidatePick.missing', { list });
  };
  // Rolle und Eckdaten, in der Sprache der Oberfläche
  const infoVon = (b?: Bereitschaft) => (b ? [b.form.job_title || null, eckdaten(b.form, t) || null].filter(Boolean).join(' · ') : '');

  return (
    <Rahmen schritte={schritte} aktuell="auswahl" rail={<StelleRail job={job} firma={firma} />}
      fuss={<><Button variant="outline" onClick={onClose}>{t('cancel')}</Button><span className="text-xs text-muted-foreground">{t('candidatePick.footerHint')}</span></>}>
      <h3 className="mb-3 text-lg font-semibold">{t('candidatePick.title')}</h3>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('candidatePick.search')} className="pl-8" autoFocus />
      </div>
      <div className="space-y-5">
        <Gruppe titel={t('candidatePick.readyNow', { count: jetzt.length })}>
          {jetzt.length === 0 ? (
            <Leer>{laedt ? t('checking') : t('candidatePick.noneReady')}</Leer>
          ) : jetzt.map((k) => (
            <Zeile key={k.id} avatar={k.full_name} titel={k.full_name} unter={infoVon(bereit.get(k.id)) || k.job_title || ''}
              rechts={<><Pill>{term(FIT_LABEL[pool.fit.get(k.id)!])}</Pill><ChevronRight className="h-4 w-4 text-muted-foreground" /></>}
              onClick={() => onWahl({ id: k.id, name: k.full_name })} />
          ))}
        </Gruppe>
        {fast.length > 0 && (
          <Gruppe titel={t('candidatePick.notReady', { count: fast.length })}>
            {(alleFast || q ? fast : fast.slice(0, FAST_ERST)).map((k) => {
              const r = bereit.get(k.id)!.readiness;
              return (
                <Zeile key={k.id} avatar={k.full_name} titel={k.full_name} unter={fehlt(bereit.get(k.id)!)}
                  rechts={<><span className="text-xs text-muted-foreground">{t('candidatePick.progress', { done: r.done, total: r.total })}</span><ChevronRight className="h-4 w-4 text-muted-foreground" /></>}
                  onClick={() => onWahl({ id: k.id, name: k.full_name })} />
              );
            })}
            {!alleFast && !q && fast.length > FAST_ERST && (
              <button type="button" className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground" onClick={() => setAlleFast(true)}>
                {t('candidatePick.showAll', { count: fast.length })}
              </button>
            )}
          </Gruppe>
        )}
        {schon.length > 0 && (
          <Gruppe titel={t('candidatePick.alreadyPresented', { count: schon.length })}>
            {schon.map((k) => {
              const am = vorgestellt.get(k.id);
              return <Zeile key={k.id} gedimmt avatar={k.full_name} titel={k.full_name} unter={am ? t('candidatePick.presentedOn', { date: datum(am, i18n.language) }) : t('candidatePick.presentedAlready')} />;
            })}
          </Gruppe>
        )}
        {laedt && jetzt.length > 0 && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {t('candidatePick.checkingMore')}</p>}
        <LebenslaufAblage onFiles={(fs) => ablageMelden(ablageAnfragen(fs))}>
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
            <FileUp className="h-4 w-4 shrink-0" />
            {t('candidatePick.dropHint')}
          </div>
        </LebenslaufAblage>
      </div>
    </Rahmen>
  );
}

// ---------------------------------------------------------------------------
// Ablauf für einen Kandidaten bei einer Stelle
// ---------------------------------------------------------------------------

function VorstellenAblauf({ job, firma, kandidat, schritt, setSchritt, schritte, auswahlMoeglich, kandidatFest, stelleFest, onAuswahl, onClose, onSubmitted, onOpenInterview }: {
  job: JobRow;
  firma: string | null;
  kandidat: { id: string; name: string };
  schritt: Schritt;
  setSchritt: (s: Schritt) => void;
  schritte: Exclude<Schritt, 'fertig'>[];
  auswahlMoeglich: boolean;
  kandidatFest: boolean;
  stelleFest: boolean;
  onAuswahl: () => void;
  onClose: () => void;
  onSubmitted?: () => void;
  onOpenInterview?: (candidateId: string, jobId: string | null) => void;
}) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation(NS);
  const v = useVorstellung(job.id, kandidat.id, job);
  const f = v.akte.form;
  const name = vorname(f.full_name || kandidat.name);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [cvOpen, setCvOpen] = useState(false);
  const [anfragenOpen, setAnfragenOpen] = useState(false);

  const mussTexte = useMemo(() => getRecruiterCriteria(job as never).required ?? [], [job]);
  const zeilen = useMemo(() => passungsZeilen(f, job as FitJob, v.fit.items, v.musts, new Date(), mussTexte), [f, job, v.fit.items, v.musts, mussTexte]);
  const zahl = passungsZahl(zeilen);
  const abweichungen = zeilen.filter((z) => z.status === 'weicht');
  const offeneWarnung = v.fit.warnings.some((w) => !v.confirmed.has(w.rule));

  const interviewOeffnen = () => {
    if (onOpenInterview) onOpenInterview(kandidat.id, job.id);
    else { onClose(); navigate(`/recruiter/candidates/${kandidat.id}?interview=live`); }
  };

  const abschicken = async () => {
    setBusy(true);
    const r = await v.submit();
    setBusy(false);
    if (r.error) { toast.error(t('flow.submitFailed', { error: r.error })); return; }
    setSubmissionId(r.id);
    setSchritt('fertig');
    onSubmitted?.();
  };

  const rail = (
    <>
      <StelleRail job={job} firma={firma} />
      <RailBlock titel={t('rail.candidate')}>
        <p className="text-sm font-medium leading-snug">{f.full_name || kandidat.name}</p>
        {!v.akte.loading && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {[f.job_title, [f.experience_years ? t('rail.yearsShort', { n: f.experience_years }) : null, f.city || null].filter(Boolean).join(' · '), f.expected_salary ? formatEuro(f.expected_salary) : null].filter(Boolean).map((z) => <span key={z} className="block">{z}</span>)}
            <span className="mt-2 block">{v.akte.readiness.items.find((i) => i.key === 'interview')?.ok ? t('rail.interviewDone') : t('rail.interviewOpen')}</span>
            <span className="block">{v.akte.cv ? t('rail.cvDatedOk', { date: formatCvDate(cvStandDate(v.akte.cv)) }) : t('rail.cvMissing')}</span>
            {submissionId && <span className="mt-2 block text-foreground">{t('rail.presentedOn', { date: datum(new Date(), i18n.language) })}</span>}
          </p>
        )}
      </RailBlock>
    </>
  );

  const zurueckZurAuswahl = auswahlMoeglich
    ? <Button variant="outline" onClick={onAuswahl}><ChevronLeft className="mr-1 h-4 w-4" />{kandidatFest ? t('flow.otherJob') : t('flow.otherCandidate')}</Button>
    : <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>;

  // --- Passung --------------------------------------------------------------
  if (schritt === 'passung') {
    const fehlt = v.akte.readiness.missing;
    const cvFehlt = fehlt.some((m) => m.key === 'lebenslauf');
    const interviewFehlt = fehlt.filter((m) => m.key !== 'lebenslauf');
    const weiterOk = !v.akte.loading && !v.blocked && !v.pruefungLaeuft && !offeneWarnung;
    return (
      <Rahmen schritte={schritte} aktuell="passung" rail={rail}
        fuss={<>{zurueckZurAuswahl}<Button data-tour="vorstellen.next" onClick={() => setSchritt('kunde')} disabled={!weiterOk}>
          {v.pruefungLaeuft ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{t('checking')}</> : <>{abweichungen.length && !v.blocked ? t('fit.continueAnyway') : t('next')}<ChevronRight className="ml-1 h-4 w-4" /></>}
        </Button></>}>
        {v.akte.loading ? <Lade text={t('fit.loadingFile')} /> : (
          <>
            {(fehlt.length > 0 || v.duplicate || v.excluded) ? (
              <>
                <h3 className="text-lg font-semibold">{v.duplicate || v.excluded ? t('fit.blockedTitle', { name }) : t('fit.todoTitle')}</h3>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">
                  {v.duplicate ? t('fit.duplicate', { name }) : v.excluded ? t('fit.excludedShort') : t('fit.todoText', { name })}
                </p>
                <div className="divide-y divide-border rounded-xl border border-border">
                  {v.excluded && (
                    <ToDo icon={<ShieldCheck className="h-4 w-4" />} text={v.sperrgrund ? t('fit.blocklist', { nameGen: genitiv(name) }) : v.match?.exclusion?.text ? t('fit.excludedReason', { name, reason: v.match.exclusion.text }) : t('fit.excluded', { name })} />
                  )}
                  {!v.duplicate && !v.excluded && interviewFehlt.length > 0 && (
                    <ToDo icon={<MessageCircle className="h-4 w-4" />} text={t('fit.interviewMissing', { list: interviewFehlt.map((m) => m.label).join(', ') })}
                      aktion={<Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={interviewOeffnen}>{v.akte.hasNotes ? t('fit.continueInterview') : t('fit.startInterview')}</Button>} />
                  )}
                  {!v.duplicate && !v.excluded && cvFehlt && (
                    <ToDo icon={<FileText className="h-4 w-4" />} text={t('fit.cvMissing')}
                      aktion={<span className="flex gap-1.5"><Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setCvOpen(true)}><Upload className="mr-1 h-3.5 w-3.5" />{t('fit.upload')}</Button><Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => setAnfragenOpen(true)}><Mail className="mr-1 h-3.5 w-3.5" />{t('fit.requestFrom', { name })}</Button></span>} />
                  )}
                </div>
                {!v.duplicate && !v.excluded && <p className="mt-3 text-xs text-muted-foreground">{t('fit.afterTodo')}</p>}
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold">{t('fit.title', { name })}</h3>
                <p className="mb-4 mt-1 text-sm text-muted-foreground">
                  {zahl.gesamt === 0 ? t('fit.noCriteria') : zahl.passt === zahl.gesamt ? t('fit.allMatch', { count: zahl.gesamt }) : t('fit.someMatch', { passt: zahl.passt, count: zahl.gesamt })}
                </p>
                <PassungsTabelle zeilen={zeilen} name={name} confirmed={v.confirmed} onConfirm={v.toggleConfirmed} />
                {v.matchLoad === 'loading' && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {t('fit.mustChecking')}</p>}
                {v.matchLoad === 'failed' && <p className="mt-2 text-xs text-muted-foreground">{t('fit.mustFailed')}</p>}
                <p className="mb-2 mt-5 text-xs font-medium text-muted-foreground">{t('fit.also')}</p>
                <div className="space-y-1.5 text-sm">
                  {v.matchLoad === 'ready' && <Hinweis icon={<Check className="h-4 w-4" />}>{t('fit.notBlocked', { company: firma ?? t('fit.theCompany'), nameGen: genitiv(name) })}</Hinweis>}
                  {v.absagen.map((a) => <Hinweis key={a} icon={<MessageSquareX className="h-4 w-4" />}>{t('fit.priorRejection', { reason: a })}</Hinweis>)}
                  {v.match?.summary && <Hinweis icon={<Search className="h-4 w-4" />}>{t('fit.matchingSummary', { summary: v.match.summary })}</Hinweis>}
                </div>
              </>
            )}
          </>
        )}
        <CvUploadDialog open={cvOpen} onOpenChange={setCvOpen} existingCandidateId={kandidat.id} onCandidateCreated={() => { void v.akte.reload(); }} />
        <LebenslaufAnfragenFenster open={anfragenOpen} onOpenChange={setAnfragenOpen} candidate={{ id: kandidat.id, vorname: name, email: f.email || null }} />
      </Rahmen>
    );
  }

  // --- Kundenansicht --------------------------------------------------------
  if (schritt === 'kunde') {
    return (
      <Rahmen schritte={schritte} aktuell="kunde" rail={rail}
        fuss={<><Button variant="outline" onClick={() => setSchritt('passung')}><ChevronLeft className="mr-1 h-4 w-4" />{t('back')}</Button><Button data-tour="vorstellen.next" onClick={() => setSchritt('abschicken')}>{t('next')}<ChevronRight className="ml-1 h-4 w-4" /></Button></>}>
        <Kundenansicht v={v} kandidatId={kandidat.id} name={name} firma={firma} />
      </Rahmen>
    );
  }

  // --- Abschicken -----------------------------------------------------------
  if (schritt === 'abschicken') {
    const darf = consent && !v.blocked && !offeneWarnung && !v.pruefungLaeuft && !busy;
    const zustimmungAm = f.presentation_consent === true && f.presentation_consent_at ? datum(f.presentation_consent_at, i18n.language) : null;
    return (
      <Rahmen schritte={schritte} aktuell="abschicken" rail={rail}
        fuss={<><Button variant="outline" onClick={() => setSchritt('kunde')}><ChevronLeft className="mr-1 h-4 w-4" />{t('back')}</Button>
          <Button data-tour="vorstellen.send" onClick={() => void abschicken()} disabled={!darf}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}{t('send.button', { name })}</Button></>}>
        <h3 className="text-lg font-semibold">{firma ? t('send.titleCompany', { name, company: firma }) : t('send.titleJob', { name, job: job.title })}</h3>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">{t('send.subtitle')}</p>
        <div className="space-y-2 rounded-xl border border-border p-3.5 text-sm">
          {abweichungen.length > 0
            ? <Hinweis icon={<AlertCircle className="h-4 w-4 font-medium text-foreground" />}>{t('send.deviations', { count: abweichungen.length, list: abweichungen.map((z) => z.key.startsWith('muss') ? t('send.mustCriterion') : z.label).join(', ') })} · <button type="button" className="underline underline-offset-2" onClick={() => setSchritt('passung')}>{t('view')}</button></Hinweis>
            : <Hinweis icon={<Check className="h-4 w-4" />}>{t('send.allMatch')}</Hinweis>}
          <Hinweis icon={<UserCheck className="h-4 w-4" />}>{t('send.anonProfile')} · <button type="button" className="underline underline-offset-2" onClick={() => setSchritt('kunde')}>{t('view')}</button></Hinweis>
          <CvZeile cv={v.akte.cv} onNeu={() => setCvOpen(true)} />
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3.5 py-3 text-sm">
          <Checkbox className="mt-0.5" data-tour="vorstellen.consent" checked={consent} onCheckedChange={(c) => setConsent(c === true)} />
          <span>
            {firma ? t('send.consentCompany', { name, company: firma }) : t('send.consentGeneric', { name })}
            {zustimmungAm && <span className="mt-1 block text-xs text-muted-foreground">{t('send.consentInInterview', { date: zustimmungAm, name })}</span>}
          </span>
        </label>
        <CvUploadDialog open={cvOpen} onOpenChange={setCvOpen} existingCandidateId={kandidat.id} onCandidateCreated={() => { void v.akte.reload(); }} />
      </Rahmen>
    );
  }

  // --- Fertig ---------------------------------------------------------------
  return (
    <Rahmen schritte={schritte} aktuell="fertig" rail={rail}
      fuss={<><Button variant="outline" onClick={onClose}>{t('close')}</Button>
        {auswahlMoeglich && <Button variant="outline" onClick={onAuswahl}>{kandidatFest ? t('done.anotherJob', { name }) : t('done.anotherCandidate')}</Button>}</>}>
      <Fertig name={name} firma={firma} jobTitle={job.title} ort={str(job.location)} email={f.email} submissionId={submissionId} stelleFest={stelleFest} />
    </Rahmen>
  );
}

// ---------------------------------------------------------------------------
// Bausteine der Schritte
// ---------------------------------------------------------------------------

function PassungsTabelle({ zeilen, name, confirmed, onConfirm }: { zeilen: ReturnType<typeof passungsZeilen>; name: string; confirmed: Set<string>; onConfirm: (rule: string, on: boolean) => void }) {
  const { t } = useTranslation(NS);
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full table-fixed text-sm">
        <colgroup><col className="w-[18%]" /><col className="w-[31%]" /><col className="w-[31%]" /><col className="w-[20%]" /></colgroup>
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-normal" />
            <th className="px-3 py-2 font-normal">{name}</th>
            <th className="px-3 py-2 font-normal">{t('table.job')}</th>
            <th className="px-3 py-2 font-normal" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {zeilen.map((z) => (
            <tr key={z.key} title={z.satz} className="align-top">
              <td className="px-3 py-2 text-xs text-muted-foreground">{z.label}</td>
              <td className="px-3 py-2 break-words">{z.kandidat}</td>
              <td className="px-3 py-2 break-words text-muted-foreground">{z.stelle || '—'}</td>
              <td className={cn('px-3 py-2 text-xs', z.status === 'weicht' ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {z.urteil}
                {z.bestaetigen && (
                  <label className="mt-1 flex cursor-pointer items-start gap-1.5 text-foreground">
                    <Checkbox className="mt-0.5 h-3.5 w-3.5" checked={confirmed.has(z.key)} onCheckedChange={(c) => onConfirm(z.key, c === true)} />
                    <span>{t('table.presentAnyway')}</span>
                  </label>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Kundenansicht({ v, kandidatId, name, firma }: { v: Vorstellung; kandidatId: string; name: string; firma: string | null }) {
  const { t } = useTranslation(NS);
  const f = v.akte.form;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [text, setText] = useState('');
  const [speichert, setSpeichert] = useState(false);
  const insights: InterviewInsights = {
    interview_date: f.interview_date,
    interview_type: (f.interview_type || null) as InterviewInsights['interview_type'],
    change_motivation: f.summary_motivation.trim() || f.change_motivation,
    change_motivation_tags: f.change_motivation_tags,
    why_now: f.why_now,
    offer_requirements: f.offer_requirements,
    notice_period: f.notice_period || null,
    earliest_start_date: f.availability_date || null,
    leadership_scope: (f.leadership_scope || null) as InterviewInsights['leadership_scope'],
    leadership_team_size: f.leadership_team_size,
    leadership_also_functional: f.leadership_also_functional,
    leadership_functional_size: f.leadership_functional_size,
    other_applications: null,
    salary_wish: wunschBand(f.expected_salary),
  };
  const fehler = clientTextIssues(f).filter((i) => i.level === 'danger');
  const fakten = [
    [t('client.salaryWish'), wunschBand(f.expected_salary)],
    [t('client.available'), verfuegbarAus(insights)],
  ].filter(([, w]) => w) as [string, string][];

  const speichern = async () => {
    setSpeichert(true);
    const r = await v.akte.save({ ...f, summary_motivation: text.trim() });
    setSpeichert(false);
    if (!r.ok) { toast.error(r.error ?? t('client.saveFailed')); return; }
    setBearbeiten(false);
    toast.success(t('client.saved'));
  };

  return (
    <>
      <h3 className="text-lg font-semibold">{firma ? t('client.titleCompany', { company: firma }) : t('client.titleGeneric')}</h3>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">{t('client.subtitle')}</p>
      <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{t('client.anonCode', { code: candidateAnonCode(kandidatId) })}</p>
          <p className="font-medium">{f.job_title || t('client.candidateFallback')}</p>
          <p className="text-sm text-muted-foreground">{[f.experience_years ? t('client.yearsExperience', { count: f.experience_years }) : null, f.city ? t('client.region', { region: anonymizeRegionBroad(f.city) }) : null, optionLabel(WORK_MODEL_OPTIONS, f.remote_preference)].filter(Boolean).join(' · ')}</p>
        </div>
        {/* Gehalt und Verfügbarkeit stehen in der Karte; nur ohne Karte (keine Zustimmung) hier. */}
        {f.presentation_consent === false && fakten.length > 0 && (
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            {fakten.map(([l, w]) => <div key={l}><dt className="text-xs text-muted-foreground">{l}</dt><dd>{w}</dd></div>)}
          </dl>
        )}
        {f.presentation_consent === false ? (
          <p className="text-sm font-medium text-foreground">{t('client.noConsent', { name })}</p>
        ) : (
          <InterviewInsightsCard interview={insights} recruiterNotes={null} />
        )}
        {bearbeiten ? (
          <div className="space-y-2">
            <p className="text-xs font-medium">{t('client.whyLabel')}</p>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void speichern()} disabled={speichert || !text.trim()}>{speichert && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{t('save')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setBearbeiten(false)}>{t('cancel')}</Button>
            </div>
          </div>
        ) : (
          <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => { setText(f.summary_motivation.trim() || f.change_motivation); setBearbeiten(true); }}>{t('client.whyEdit')}</button>
        )}
      </div>
      <div className="mt-4 space-y-1.5 text-sm">
        <Hinweis icon={<FileText className="h-4 w-4" />}>{t('client.alsoSees')}</Hinweis>
        <Hinweis icon={<EyeOff className="h-4 w-4" />}>{t('client.hidden')}</Hinweis>
        {fehler.length === 0
          ? <Hinweis icon={<Check className="h-4 w-4" />}>{t('client.textChecked')}</Hinweis>
          : fehler.map((i) => <Hinweis key={i.field + i.message} icon={<AlertCircle className="h-4 w-4 font-medium text-foreground" />}>{i.message}</Hinweis>)}
      </div>
    </>
  );
}

function CvZeile({ cv, onNeu }: { cv: CurrentCv | null; onNeu: () => void }) {
  const { t } = useTranslation(NS);
  const [bestaetigt, setBestaetigt] = useState(false);
  if (!cv) return <Hinweis icon={<FileText className="h-4 w-4" />}>{t('cv.missing')}</Hinweis>;
  const oeffnen = async () => {
    const url = await cvViewUrl(cv);
    if (url) window.open(url, '_blank', 'noopener'); else toast.error(t('cv.openFailed'));
  };
  if (isCvStale(cv) && !bestaetigt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Hinweis icon={<FileText className="h-4 w-4" />}>{cvAgeMonths(cv) < 1 ? t('cv.staleUnderMonth', { date: formatCvDate(cvStandDate(cv)) }) : t('cv.stale', { date: formatCvDate(cvStandDate(cv)), count: cvAgeMonths(cv) })}</Hinweis>
        <span className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => void confirmCvCurrent(cv.id).then(() => setBestaetigt(true)).catch((e) => toast.error(e instanceof Error ? e.message : t('cv.notSaved')))}>{t('cv.yesCurrent')}</Button>
          <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={onNeu}>{t('cv.uploadNew')}</Button>
        </span>
      </div>
    );
  }
  return (
    <Hinweis icon={<FileText className="h-4 w-4" />}>
      {t('cv.forAfterConsent')} <button type="button" className="underline underline-offset-2" onClick={() => void oeffnen()}>{cv.file_name}</button> · {t('cv.asOf', { date: formatCvDate(cvStandDate(cv)) })}
    </Hinweis>
  );
}

function Fertig({ name, firma, jobTitle, ort, email, submissionId, stelleFest }: { name: string; firma: string | null; jobTitle: string; ort: string | null; email: string; submissionId: string | null; stelleFest: boolean }) {
  const { t } = useTranslation(NS);
  const [offen, setOffen] = useState(false);
  const [text, setText] = useState(() => bescheidText(jobTitle, ort));
  const [sendet, setSendet] = useState(false);
  const [gesendet, setGesendet] = useState(false);
  // Gruß und Unterschrift wie beim Versand (recruiter-notify): Vorname, darunter Name, Matchunt, Telefon.
  const kontakt = useRecruiterKontakt();
  const hhName = (kontakt?.name ?? '').trim();
  const hhVorname = hhName.split(/\s+/)[0] || '';

  const senden = async () => {
    if (!submissionId) return;
    setSendet(true);
    const { data, error } = await supabase.functions.invoke('recruiter-notify', {
      // lang: Sprache des Textes (Headhunter), damit Anrede und Gruß beim Versand dazu passen
      body: { action: 'candidate_message', submissionId, text: text.trim(), subject: bescheidBetreff(jobTitle), kind: 'vorgestellt', lang: candidateLanguage() },
    });
    const fehler = await functionError(error, data);
    setSendet(false);
    if (fehler) { toast.error(fehler); return; }
    setGesendet(true);
    setOffen(false);
    toast.success(t('done.toastNotified', { name }));
  };

  return (
    <>
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border"><Check className="h-4 w-4" /></span>
        <div>
          <h3 className="text-lg font-semibold">{firma ? t('done.titleCompany', { name, company: firma }) : t('done.titleJob', { name, job: jobTitle })}</h3>
          <p className="text-sm text-muted-foreground">{stelleFest ? t('done.statusAtJob') : t('done.statusAtProfile')}</p>
        </div>
      </div>
      <ol className="ml-2 space-y-3 border-l border-border pl-5 text-sm">
        <Schrittpunkt aktiv titel={t('done.now')}>{t('done.nowText', { nameGen: genitiv(name) })}</Schrittpunkt>
        <Schrittpunkt titel={t('done.in5Days')}>{t('done.in5DaysText')}</Schrittpunkt>
        <Schrittpunkt titel={t('done.afterYes')}>{t('done.afterYesText')}</Schrittpunkt>
      </ol>
      <div className="mt-6 rounded-xl border border-border p-3.5">
        {gesendet ? (
          <Hinweis icon={<Check className="h-4 w-4" />}>{t('done.messageSent', { name })}</Hinweis>
        ) : offen ? (
          <div className="space-y-2.5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t('done.mailTo', { name, email })} <span className="text-foreground/90">{bescheidBetreff(jobTitle)}</span><br />
              {t('done.mailNote')}
            </p>
            {/* Die ganze Mail, wie sie ankommt: Grau setzt der Versand, nur der Rahmen ist änderbar. */}
            <div className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed">
              <p className="text-muted-foreground">{t('mail.hello', { name })}</p>
              <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={7}
                className="my-2 border-dashed px-2.5 py-2 text-sm leading-relaxed" aria-label={t('done.messageAria', { name })} />
              <p className="whitespace-pre-line text-muted-foreground">{`${t('mail.regards')}\n${hhVorname || t('mail.yourFirstName')}`}</p>
              {hhName && <p className="mt-1.5 text-xs text-muted-foreground">{hhName} · {t('mail.via')}{kontakt?.phone ? ` · ${kontakt.phone}` : ''}</p>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void senden()} disabled={sendet || !text.trim()}>{sendet ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}{t('done.send')}</Button>
              <Button size="sm" variant="ghost" onClick={() => setOffen(false)}>{t('cancel')}</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Hinweis icon={<Mail className="h-4 w-4" />}>{t('done.notifyHint', { name })}</Hinweis>
            {email.trim()
              ? <Button size="sm" onClick={() => setOffen(true)}><Mail className="mr-1.5 h-3.5 w-3.5" />{t('done.notifyButton', { name })}</Button>
              : <span className="text-xs text-muted-foreground">{t('done.noEmail')}</span>}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Kleine Bausteine
// ---------------------------------------------------------------------------

function Schrittpunkt({ titel, aktiv = false, children }: { titel: string; aktiv?: boolean; children: ReactNode }) {
  return (
    <li className="relative">
      <span className={cn('absolute -left-[1.6rem] top-1.5 h-2 w-2 rounded-full', aktiv ? 'bg-foreground' : 'bg-muted-foreground/50')} aria-hidden />
      <p className="font-medium">{titel}</p>
      <p className="text-muted-foreground">{children}</p>
    </li>
  );
}

function Hinweis({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <p className="flex items-start gap-2"><span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span><span className="min-w-0">{children}</span></p>;
}

function ToDo({ icon, text, aktion }: { icon: ReactNode; text: string; aktion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 text-sm">
      <span className="flex min-w-0 items-start gap-2"><span className="mt-0.5 shrink-0 text-muted-foreground">{icon}</span>{text}</span>
      {aktion}
    </div>
  );
}

function Gruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{titel}</p>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">{children}</div>
    </section>
  );
}

const initialen = (n: string) => n.split(/\s+/).filter((p) => p && p.toLowerCase() !== 'test').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

function Zeile({ titel, unter, rechts, onClick, gedimmt = false, avatar, stelle }: { titel: string; unter?: string; rechts?: ReactNode; onClick?: () => void; gedimmt?: boolean; avatar?: string; /** Anker für den Rundgang: Kennung der Stelle */ stelle?: string }) {
  const inhalt = (
    <>
      {avatar && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold">{initialen(avatar) || '?'}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{titel}</span>
        {unter && <span className="block truncate text-xs text-muted-foreground">{unter}</span>}
      </span>
      {rechts && <span className="flex shrink-0 items-center gap-2">{rechts}</span>}
    </>
  );
  const cls = cn('flex w-full items-center gap-3 px-3 py-2.5 text-left', gedimmt && 'opacity-50');
  return onClick
    ? <button type="button" data-job-row={stelle} className={cn(cls, 'transition-colors hover:bg-muted/50')} onClick={onClick}>{inhalt}</button>
    : <div className={cls}>{inhalt}</div>;
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{children}</span>;
}

function Leer({ children }: { children: ReactNode }) {
  return <p className="px-3 py-4 text-center text-xs text-muted-foreground">{children}</p>;
}

function Lade({ text }: { text: string }) {
  return <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {text}</div>;
}
