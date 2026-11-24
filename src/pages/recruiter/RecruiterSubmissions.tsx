import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Honorar } from '@/components/recruiter/Honorar';
import { useRecruiterPipeline, type PipelineStageKey } from '@/hooks/useRecruiterPipeline';
import { useUnifiedTaskInbox, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { buildGuide } from '@/components/recruiter/tasks/taskWindow';
import { isClosedStage, normalizeStage } from '@/lib/submissionStage';
import { fmtDayMonth, fmtMoney } from '@/lib/localeFormat';
import { cn } from '@/lib/utils';

/**
 * Pipeline des Headhunters (Fassung A „Spalten, aufgeräumt“, 25.11.2026).
 * Dieselben sechs Stufen wie der Kasten auf der Aufgaben-Seite (useRecruiterPipeline). Jede Karte sagt,
 * wer dran ist und seit wann; „du bist dran“ kommt aus der Aufgaben-Logik und steht oben in der Spalte.
 * Bis 24.11.2026 standen hier elf farbige Kacheln, Scores und Playbooks.
 */
const STUFEN: PipelineStageKey[] = ['submitted', 'in_review', 'interview_1', 'interview_2', 'offer', 'placed'];
const TAG = 86_400_000;
/** So viele Karten zeigt eine Spalte, bevor „N weitere“ kommt. */
const SICHTBAR = 4;

interface Zeile {
  id: string;
  candidateId: string;
  name: string;
  jobId: string;
  jobTitle: string;
  stufe: PipelineStageKey | null;
  beendet: 'rejected' | 'withdrawn' | null;
  tage: number;
  naechsterTermin: string | null;
  /** Aufgabe, bei der der Headhunter dran ist */
  aufgabe: UnifiedTaskItem | null;
  /** Aus „Wartet auf andere“ */
  wartetNotiz: string | null;
}

export default function RecruiterSubmissions() {
  const { t, i18n } = useTranslation('recruiterSubmissions');
  const { user } = useAuth();
  const navigate = useNavigate();
  const pipeline = useRecruiterPipeline();
  const { allItems, waitingItems, parkedItems } = useUnifiedTaskInbox('all');
  const [roh, setRoh] = useState<any[] | null>(null);
  const [suche, setSuche] = useState('');
  const [stelle, setStelle] = useState('all');
  const [nurIch, setNurIch] = useState(false);
  const [ansicht, setAnsicht] = useState<'spalten' | 'liste'>('spalten');
  const [beendetOffen, setBeendetOffen] = useState(false);
  const [mehr, setMehr] = useState<Partial<Record<PipelineStageKey, boolean>>>({});
  const [handyStufe, setHandyStufe] = useState<PipelineStageKey>('in_review');

  useEffect(() => {
    if (!user) return;
    let weg = false;
    (async () => {
      // Kein eingebetteter jobs(...)-Join: Headhunter lesen Stellen nur über recruiter_jobs_view
      const { data } = await supabase
        .from('submissions')
        .select('id, stage, status, job_id, candidate_id, submitted_at, updated_at, candidates (id, full_name), interviews (scheduled_at, status)')
        .eq('recruiter_id', user.id);
      const rows = (data || []) as any[];
      const jobIds = [...new Set(rows.map((s) => s.job_id).filter(Boolean))] as string[];
      let jobs: Record<string, string> = {};
      if (jobIds.length) {
        const { data: js } = await supabase.from('recruiter_jobs_view').select('id, title').in('id', jobIds);
        jobs = Object.fromEntries(((js || []) as any[]).map((j) => [j.id, j.title]));
      }
      if (!weg) setRoh(rows.map((s) => ({ ...s, jobTitle: jobs[s.job_id] ?? '' })));
    })();
    return () => { weg = true; };
  }, [user?.id]);

  const zeilen = useMemo<Zeile[]>(() => {
    if (!roh) return [];
    const aufgabeJe = new Map<string, UnifiedTaskItem>();
    for (const it of allItems) {
      if (!it.submissionId || it.isStale) continue;
      const vorher = aufgabeJe.get(it.submissionId);
      if (!vorher || it.sortPriority < vorher.sortPriority) aufgabeJe.set(it.submissionId, it);
    }
    const wartetJe = new Map<string, string>();
    for (const it of [...waitingItems, ...parkedItems]) if (it.submissionId) wartetJe.set(it.submissionId, it.parkNote ?? '');
    const jetzt = Date.now();
    return roh.map((s) => {
      const kanon = normalizeStage(s.stage, s.status);
      const zu = isClosedStage(kanon);
      const termin = ((s.interviews || []) as any[])
        .filter((iv) => iv.scheduled_at && !['cancelled', 'declined', 'completed'].includes(iv.status) && new Date(iv.scheduled_at).getTime() >= jetzt)
        .map((iv) => iv.scheduled_at as string).sort()[0] ?? null;
      return {
        id: s.id, candidateId: s.candidate_id, name: s.candidates?.full_name ?? '', jobId: s.job_id, jobTitle: s.jobTitle,
        stufe: zu ? null : pipeline?.stageOf[s.id] ?? null,
        beendet: zu ? (kanon === 'withdrawn' ? 'withdrawn' : 'rejected') : null,
        tage: Math.max(0, Math.floor((jetzt - new Date(s.updated_at ?? s.submitted_at).getTime()) / TAG)),
        naechsterTermin: termin,
        aufgabe: zu ? null : aufgabeJe.get(s.id) ?? null,
        wartetNotiz: wartetJe.get(s.id) ?? null,
      };
    });
  }, [roh, pipeline, allItems, waitingItems, parkedItems]);

  const stellen = useMemo(() => {
    const m = new Map<string, string>();
    for (const z of zeilen) if (z.jobId && z.jobTitle) m.set(z.jobId, z.jobTitle);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [zeilen]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return zeilen.filter((z) =>
      (!q || z.name.toLowerCase().includes(q) || z.jobTitle.toLowerCase().includes(q)) &&
      (stelle === 'all' || z.jobId === stelle) &&
      (!nurIch || !!z.aufgabe));
  }, [zeilen, suche, stelle, nurIch]);

  // In der Spalte: erst wo du dran bist, dann wer am längsten wartet
  const sortiert = (a: Zeile, b: Zeile) => Number(!!b.aufgabe) - Number(!!a.aufgabe) || b.tage - a.tage;
  const jeStufe = (k: PipelineStageKey) => gefiltert.filter((z) => z.stufe === k).sort(sortiert);
  const beendete = gefiltert.filter((z) => z.beendet).sort((a, b) => a.tage - b.tage);
  const laufend = zeilen.filter((z) => z.stufe).length;
  const ichDran = zeilen.filter((z) => z.aufgabe).length;

  const seit = (z: Zeile) => (z.tage === 0 ? t('board.today') : t('board.days', { count: z.tage }));
  /** Zweite Zeile der Karte: deine Aufgabe als Link, sonst ruhig, wer dran ist. */
  const stand = (z: Zeile): { text: string; ich: boolean } => {
    if (z.aufgabe) return { text: buildGuide(z.aufgabe).primary.label, ich: true };
    if (z.beendet) return { text: t(`board.closed.${z.beendet}`), ich: false };
    if (z.naechsterTermin && (z.stufe === 'interview_1' || z.stufe === 'interview_2')) return { text: t('board.interviewOn', { date: fmtDayMonth(z.naechsterTermin, i18n.language) }), ich: false };
    if (z.wartetNotiz) return { text: z.wartetNotiz, ich: false };
    return { text: t(`board.waits.${z.stufe}`), ich: false };
  };

  const karte = (z: Zeile) => {
    const s = stand(z);
    return (
      <div
        key={z.id}
        role="link"
        tabIndex={0}
        onClick={() => navigate(`/recruiter/candidates/${z.candidateId}`)}
        onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) navigate(`/recruiter/candidates/${z.candidateId}`); }}
        className={cn(
          'cursor-pointer rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition-[box-shadow,border-color] hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          s.ich && 'border-klick/60',
        )}
      >
        <p className="truncate font-medium">{z.name}</p>
        <p className="truncate text-xs text-muted-foreground">{z.jobTitle}</p>
        <p className="mt-1.5 text-[13px] leading-snug">
          {s.ich
            ? <button type="button" className="text-left font-medium text-klick hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/recruiter/influence?item=${encodeURIComponent(z.aufgabe!.itemId)}`); }}>{s.text} ›</button>
            : <span className="text-muted-foreground">{s.text}</span>}
        </p>
        <p className={cn('text-xs', z.tage > 21 && !z.beendet && z.stufe !== 'placed' ? 'font-semibold' : 'text-muted-foreground')}>{seit(z)}</p>
      </div>
    );
  };

  const spalte = (k: PipelineStageKey) => {
    const alle = jeStufe(k);
    const st = pipeline?.stages.find((x) => x.key === k);
    const zeigen = mehr[k] ? alle : alle.slice(0, SICHTBAR);
    return (
      <section key={k} className="min-w-0">
        <header className="mb-2 flex items-baseline justify-between gap-2 border-b border-foreground/70 pb-1.5">
          <h2 className="truncate text-sm font-semibold">{t(`pipeline.${k}`)} <span className="tabular-nums text-muted-foreground">· {alle.length}</span></h2>
          {st && st.fee > 0 && k !== 'placed' && <Honorar className="shrink-0 text-xs text-muted-foreground">{fmtMoney(st.fee, i18n.language, { maximumFractionDigits: 0 })}</Honorar>}
        </header>
        <div className="space-y-2">
          {zeigen.map(karte)}
          {alle.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">{t('board.none')}</p>}
          {alle.length > SICHTBAR && (
            <button type="button" className="px-1 text-xs font-medium text-klick hover:underline" onClick={() => setMehr((m) => ({ ...m, [k]: !m[k] }))}>
              {mehr[k] ? t('board.less') : t('board.more', { count: alle.length - SICHTBAR })} ›
            </button>
          )}
        </div>
      </section>
    );
  };

  if (!roh || !pipeline) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const schalter = (wert: 'spalten' | 'liste') => (
    <button
      type="button"
      onClick={() => setAnsicht(wert)}
      className={cn('rounded-full px-3.5 py-1.5 text-sm transition-colors', ansicht === wert ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}
    >{t(`board.view.${wert}`)}</button>
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('board.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('board.running', { count: laufend })}
              {pipeline.totalFee > 0 && <> · <Honorar>{t('board.possible', { fee: fmtMoney(pipeline.totalFee, i18n.language, { maximumFractionDigits: 0 }) })}</Honorar></>}
              {ichDran > 0 && <> · {t('board.yourTurn', { count: ichDran })}</>}
            </p>
          </div>
          <div className="inline-flex shrink-0 self-start rounded-full bg-muted p-1">{schalter('spalten')}{schalter('liste')}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder={t('board.search')} className="h-9 rounded-full pl-9" />
          </div>
          <Select value={stelle} onValueChange={setStelle}>
            <SelectTrigger className="h-9 w-auto max-w-[16rem] rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('board.allJobs')}</SelectItem>
              {stellen.map(([id, titel]) => <SelectItem key={id} value={id}>{titel}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            type="button"
            aria-pressed={nurIch}
            onClick={() => setNurIch((v) => !v)}
            className={cn('h-9 rounded-full border px-3.5 text-sm transition-colors', nurIch ? 'border-foreground bg-foreground text-background' : 'bg-background hover:border-foreground/30')}
          >{t('board.onlyMine')} · {ichDran}</button>
          {zeilen.some((z) => z.beendet) && (
            <span className="text-sm text-muted-foreground sm:ml-auto">
              {t('board.closedCount', { count: zeilen.filter((z) => z.beendet).length })}{' '}
              <button type="button" className="font-medium text-klick hover:underline" onClick={() => setBeendetOffen((v) => !v)}>{beendetOffen ? t('board.hide') : t('board.show')} ›</button>
            </span>
          )}
        </div>

        {zeilen.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-12 text-center">
            <p className="text-[15px] font-semibold">{t('board.empty.title')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t('board.empty.text')}</p>
            <Link to="/recruiter/jobs" className="mt-3 inline-block text-sm font-medium text-klick hover:underline">{t('board.empty.cta')} ›</Link>
          </div>
        ) : ansicht === 'spalten' ? (
          <>
            {/* Handy: Stufen als Reiter, darunter eine Spalte */}
            <div className="md:hidden">
              <div className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1">
                {STUFEN.map((k) => (
                  <button key={k} type="button" onClick={() => setHandyStufe(k)}
                    className={cn('shrink-0 rounded-full px-3 py-1.5 text-sm', handyStufe === k ? 'bg-foreground text-background' : 'bg-muted text-foreground')}>
                    {t(`pipeline.${k}`)} <span className="tabular-nums opacity-70">{jeStufe(k).length}</span>
                  </button>
                ))}
              </div>
              {spalte(handyStufe)}
            </div>
            <div className="hidden overflow-x-auto pb-2 md:block">
              <div className="grid min-w-[60rem] grid-cols-6 gap-3">{STUFEN.map(spalte)}</div>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  {(['candidate', 'job', 'stage', 'since', 'next'] as const).map((h) => <th key={h} className="px-4 py-2.5 font-medium">{t(`board.col.${h}`)}</th>)}
                </tr>
              </thead>
              <tbody>
                {STUFEN.flatMap((k) => jeStufe(k)).map((z) => {
                  const s = stand(z);
                  return (
                    <tr key={z.id} className="cursor-pointer border-b last:border-0 hover:bg-muted/40" onClick={() => navigate(`/recruiter/candidates/${z.candidateId}`)}>
                      <td className="px-4 py-2.5 font-medium">{z.name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{z.jobTitle}</td>
                      <td className="px-4 py-2.5">{z.stufe ? t(`pipeline.${z.stufe}`) : ''}</td>
                      <td className={cn('px-4 py-2.5 tabular-nums', z.tage > 21 && z.stufe !== 'placed' ? 'font-semibold' : 'text-muted-foreground')}>{seit(z)}</td>
                      <td className="px-4 py-2.5">
                        {s.ich
                          ? <button type="button" className="font-medium text-klick hover:underline" onClick={(e) => { e.stopPropagation(); navigate(`/recruiter/influence?item=${encodeURIComponent(z.aufgabe!.itemId)}`); }}>{s.text} ›</button>
                          : <span className="text-muted-foreground">{s.text}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {STUFEN.every((k) => jeStufe(k).length === 0) && <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('board.noneFound')}</p>}
          </div>
        )}

        {beendetOffen && beendete.length > 0 && (
          <section>
            <h2 className="mb-2 border-b pb-1.5 text-sm font-semibold">{t('board.closedTitle')} <span className="tabular-nums text-muted-foreground">· {beendete.length}</span></h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{beendete.map(karte)}</div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
