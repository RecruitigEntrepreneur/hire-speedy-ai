import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, ExternalLink, FileDown } from 'lucide-react';
import i18n from '@/i18n';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { BewerberStatusPill } from '@/components/candidates/BewerberStatusPill';
import type { BewerberItem } from '@/hooks/useBewerber';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { useVertragStand } from '@/components/client/settings/VertragSettings';
import { taskMainLabel, type ClientDoneItem, type ClientTask } from '@/lib/clientTasksApi';
import { experienceBandLabel, regionLabel, remoteLabel } from '@/lib/clientCandidateLabels';
import { fmtDate, fmtDayMonth, fmtMoney, fmtTime, fmtWeekdayDayMonth } from '@/lib/localeFormat';
import { cn } from '@/lib/utils';
import { SectionCard, linkBtn } from './JobControl';

/**
 * Unterseiten der Kunden-Stellenseite (14.11.2026): Übersicht + Kandidaten · Interviews ·
 * Markt & Headhunter · Vertrag & Kosten · Team & Verlauf. Jede mit eigener Adresse
 * (/dashboard/jobs/:id/<reiter>). Sie zeigen die vorhandenen Daten gefiltert auf die Stelle;
 * Entscheidungen fallen weiter im Kandidatenprofil bzw. in den bestehenden Fenstern.
 */

export type JobTab = 'uebersicht' | 'kandidaten' | 'interviews' | 'markt' | 'vertrag' | 'team' | 'auswertung';
export const JOB_TABS: JobTab[] = ['uebersicht', 'kandidaten', 'interviews', 'markt', 'vertrag', 'team', 'auswertung'];
export const isJobTab = (v: string | undefined): v is JobTab => !!v && (JOB_TABS as string[]).includes(v);

const band = (v: string | null | undefined) => (v && v !== 'Nicht angegeben' ? experienceBandLabel(v) : '');
const daysSince = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)) : 0);

/** Reiter unter dem Kopf. Punkt = dort wartet etwas auf Sie. */
export function JobTabsBar({ jobId, active, counts, dots }: {
  jobId: string; active: JobTab; counts: Partial<Record<JobTab, number>>; dots: Partial<Record<JobTab, boolean>>;
}) {
  const { t } = useTranslation('clientJobs');
  return (
    <nav data-tour="job.tabs" className="-mb-px mt-4 flex gap-1 overflow-x-auto border-b" aria-label={t('tabs.label')}>
      {JOB_TABS.map((tab) => (
        <Link
          key={tab}
          to={tab === 'uebersicht' ? `/dashboard/jobs/${jobId}` : `/dashboard/jobs/${jobId}/${tab}`}
          aria-current={active === tab ? 'page' : undefined}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
            active === tab ? 'border-klick font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {t(`tabs.${tab}`)}
          {counts[tab] ? <span className="text-xs text-muted-foreground">{counts[tab]}</span> : null}
          {dots[tab] && <span className="h-1.5 w-1.5 rounded-full bg-klick" aria-label={t('tabs.waiting')} />}
        </Link>
      ))}
    </nav>
  );
}

// ================================================================== Kandidaten

type CandFilter = 'alle' | 'mine' | 'neu' | 'pruefung' | 'interview' | 'angebot' | 'abgesagt';

export function CandidatesTab({ items, tasks, jobId, onOpen }: { items: BewerberItem[]; tasks: ClientTask[]; jobId: string; onOpen: (t: ClientTask) => void }) {
  const { t } = useTranslation('clientJobs');
  const { t: tr } = useTranslation();
  useTranslation('clientCandidates');
  const navigate = useNavigate();
  const [filter, setFilter] = useState<CandFilter>('alle');
  const [picked, setPicked] = useState<string[]>([]);
  const [compare, setCompare] = useState(false);
  const [openReason, setOpenReason] = useState<string | null>(null);
  const taskBySub = useMemo(() => new Map(tasks.filter((x) => x.submissionId).map((x) => [x.submissionId as string, x])), [tasks]);

  const running = items.filter((i) => i.tab !== 'archiv');
  const rejected = items.filter((i) => i.archiveKind === 'abgelehnt');
  const counts: Record<CandFilter, number> = {
    alle: running.length,
    mine: running.filter((i) => taskBySub.has(i.submissionId) || i.isMyTurn).length,
    neu: running.filter((i) => i.tab === 'neu').length,
    pruefung: running.filter((i) => i.tab === 'pruefung').length,
    interview: running.filter((i) => i.tab === 'interview').length,
    angebot: running.filter((i) => i.tab === 'angebot').length,
    abgesagt: rejected.length,
  };
  const shown = (filter === 'abgesagt' ? rejected
    : filter === 'alle' ? running
    : filter === 'mine' ? running.filter((i) => taskBySub.has(i.submissionId) || i.isMyTurn)
    : running.filter((i) => i.tab === filter))
    .slice().sort((a, b) => Number(taskBySub.has(b.submissionId)) - Number(taskBySub.has(a.submissionId)) || (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  const pickedItems = picked.map((id) => items.find((i) => i.submissionId === id)).filter(Boolean) as BewerberItem[];

  const reasons = new Map<string, BewerberItem[]>();
  for (const i of rejected) {
    const k = i.rejectReason ?? '';
    reasons.set(k, [...(reasons.get(k) ?? []), i]);
  }
  const reasonLabel = (k: string) => (k ? i18n.t(`clientCandidates:rejection.reasons.${k}`, { defaultValue: k }) : t('cand.noReason'));
  const maxReason = Math.max(1, ...[...reasons.values()].map((v) => v.length));

  return (
    <div className="space-y-4">
      <SectionCard
        title={t('cand.title', { count: running.length })}
        aside={<button type="button" className={linkBtn} onClick={() => navigate(`/dashboard/candidates?job=${jobId}&tab=alle`)}>{t('cand.inbox')}<ChevronRight className="h-3 w-3" /></button>}
      >
        {/* Apple-Stil (22.11.2026): Filter als ruhige graue Pillen wie die Reiter der Dashboard-Kacheln */}
        <div role="tablist" className="handy-wischen flex flex-wrap gap-1">
          {(['alle', 'mine', 'neu', 'pruefung', 'interview', 'angebot', 'abgesagt'] as CandFilter[]).map((f) => (
            <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={cn('h-7 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors', filter === f ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
              {t(`cand.filter.${f}`)} <span className="font-normal">{counts[f]}</span>
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('cand.empty')}</p>
        ) : (
          <>
          {/* Handy: eine Karte je Kandidat, rechts der Stand (in der Tabelle abgeschnitten). */}
          <ul className="mt-3 md:hidden">
            {shown.map((item) => {
              const task = taskBySub.get(item.submissionId);
              // Ohne Namen ist die Rolle die Hauptzeile, die Kennung steht leise darunter (wie auf dem Dashboard).
              const line = [item.fullName ? item.currentRole : item.currentRole ? item.anonymizedName : null, regionLabel(item.region), fmtDayMonth(item.submittedAt)].filter(Boolean).join(' · ');
              return (
                <li key={item.submissionId} className="flex items-start gap-3 border-t py-2.5">
                  <span className="w-4 shrink-0 pt-0.5">
                    {filter !== 'abgesagt' && (
                      <Checkbox checked={picked.includes(item.submissionId)} onCheckedChange={() => toggle(item.submissionId)} aria-label={t('cand.pick')} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => navigate(`/dashboard/candidates/${item.submissionId}`)} className="block max-w-full truncate text-left text-sm font-medium hover:underline">
                      {item.fullName || item.currentRole || item.anonymizedName}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">{line || '–'}</p>
                  </div>
                  <div className="flex max-w-[48%] shrink-0 flex-col items-end gap-0.5 text-right">
                    {filter === 'abgesagt' ? (
                      <span className="text-xs text-muted-foreground">{reasonLabel(item.rejectReason ?? '')}</span>
                    ) : task ? (
                      <>
                        <button type="button" className="whitespace-nowrap text-xs font-medium text-klick hover:underline" onClick={() => onOpen(task)}>{taskMainLabel(task.kind)} ›</button>
                        <span className="text-[11px] text-muted-foreground">{t('cand.since', { count: daysSince(task.since) })}</span>
                      </>
                    ) : (
                      <BewerberStatusPill item={item} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="w-8 pb-2 font-normal" />
                  <th className="pb-2 font-normal">{t('cand.col.candidate')}</th>
                  <th className="pb-2 font-normal">{t('cand.col.facts')}</th>
                  <th className="pb-2 font-normal">{t('cand.col.submitted')}</th>
                  <th className="pb-2 font-normal">{t('cand.col.state')}</th>
                  <th className="pb-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {shown.map((item) => {
                  const task = taskBySub.get(item.submissionId);
                  const facts = [band(item.experienceBand), regionLabel(item.region), item.availabilityDate ? t('cand.from', { date: fmtDayMonth(item.availabilityDate) }) : item.noticePeriod, item.salaryBand].filter(Boolean).join(' · ');
                  return (
                    <tr key={item.submissionId} className="border-t align-top">
                      <td className="py-2.5">
                        {filter !== 'abgesagt' && (
                          <Checkbox checked={picked.includes(item.submissionId)} onCheckedChange={() => toggle(item.submissionId)} aria-label={t('cand.pick')} />
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <button type="button" onClick={() => navigate(`/dashboard/candidates/${item.submissionId}`)} className="text-left font-medium hover:underline">
                          {item.fullName || item.currentRole || item.anonymizedName}
                        </button>
                        <p className="text-xs text-muted-foreground">{(item.fullName ? item.currentRole : item.currentRole ? item.anonymizedName : null) || '–'}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">{facts || '–'}</td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">{fmtDayMonth(item.submittedAt)}</td>
                      <td className="py-2.5 pr-3">
                        {filter === 'abgesagt' ? (
                          <span className="text-xs text-muted-foreground">{reasonLabel(item.rejectReason ?? '')}</span>
                        ) : task ? (
                          <span className="text-xs">{task.title}<span className="block text-muted-foreground">{t('cand.since', { count: daysSince(task.since) })}</span></span>
                        ) : (
                          <BewerberStatusPill item={item} />
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        {task ? (
                          <button type="button" className="whitespace-nowrap text-xs font-medium text-klick hover:underline" onClick={() => onOpen(task)}>{taskMainLabel(task.kind)} ›</button>
                        ) : (
                          <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/60" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {filter !== 'abgesagt' && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">{picked.length ? t('cand.picked', { count: picked.length }) : t('cand.pickHint')}</p>
            <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={picked.length < 2} onClick={() => setCompare(true)}>{t('cand.compare', { count: picked.length })}</Button>
          </div>
        )}
      </SectionCard>

      {compare && pickedItems.length >= 2 && (
        <CompareCard items={pickedItems} onClose={() => setCompare(false)} />
      )}

      <SectionCard title={t('cand.rejectedTitle', { count: rejected.length })}>
        {rejected.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('cand.rejectedNone')}</p>
        ) : (
          <div className="space-y-2">
            {[...reasons.entries()].sort((a, b) => b[1].length - a[1].length).map(([k, list]) => (
              <div key={k || 'none'}>
                <button type="button" onClick={() => setOpenReason(openReason === k ? null : k)} className="flex w-full items-center justify-between gap-3 text-left text-sm">
                  <span>{reasonLabel(k)}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">{list.length}<ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openReason === k && 'rotate-180')} /></span>
                </button>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className={cn('h-1.5 rounded-full', k ? 'bg-klick/70' : 'bg-border')} style={{ width: `${(list.length / maxReason) * 100}%` }} /></div>
                {openReason === k && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {list.map((i) => (
                      <li key={i.submissionId}>
                        <button type="button" className="hover:text-foreground hover:underline" onClick={() => navigate(`/dashboard/candidates/${i.submissionId}`)}>
                          {i.fullName || i.anonymizedName}{i.currentRole ? ` · ${i.currentRole}` : ''}{i.rejectedAt ? ` · ${fmtDayMonth(i.rejectedAt)}` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {reasons.has('') && <p className="pt-1 text-xs text-muted-foreground">{t('cand.noReasonHint')}</p>}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/** Vergleich ausgewählter Kandidaten: nur Fakten aus dem Profil, keine Bewertung durch Matchunt. */
function CompareCard({ items, onClose }: { items: BewerberItem[]; onClose: () => void }) {
  const { t } = useTranslation('clientJobs');
  const navigate = useNavigate();
  const rows: [string, (i: BewerberItem) => ReactNode][] = [
    [t('cockpit.final.role'), (i) => i.currentRole || '–'],
    [t('cockpit.final.experience'), (i) => band(i.experienceBand) || '–'],
    [t('cockpit.final.available'), (i) => (i.availabilityDate ? fmtDate(i.availabilityDate) : i.noticePeriod || '–')],
    [t('cockpit.final.pay'), (i) => i.salaryBand || '–'],
    [t('cockpit.final.region'), (i) => [regionLabel(i.region), i.remotePreference ? remoteLabel(i.remotePreference, '') : ''].filter(Boolean).join(' · ') || '–'],
    [t('cand.summary'), (i) => (i.aiSummary ? `„${i.aiSummary.length > 140 ? `${i.aiSummary.slice(0, 140)}…` : i.aiSummary}“` : '–')],
    [t('cockpit.final.stage'), (i) => <BewerberStatusPill item={i} className="max-md:whitespace-normal max-md:rounded-lg" />],
  ];
  // Am Handy wie „Finalisten vergleichen“: feste Spalten zum Wischen, Bezeichnung bleibt stehen.
  const fest = 'max-md:sticky max-md:left-0 max-md:z-10 max-md:bg-card max-md:pr-2';
  return (
    <SectionCard title={t('cockpit.final.title')} aside={<button type="button" className={linkBtn} onClick={onClose}>{t('cand.closeCompare')}</button>}>
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[28rem] text-xs [grid-template-columns:var(--cmp)] max-md:min-w-0 max-md:w-max max-md:[grid-template-columns:var(--cmp-handy)]"
          style={{ '--cmp': `minmax(7rem,1fr) repeat(${items.length}, minmax(0,1.3fr))`, '--cmp-handy': `6.5rem repeat(${items.length}, 9rem)` } as CSSProperties}
        >
          <span className={fest} />
          {items.map((f) => (
            <button key={f.submissionId} type="button" onClick={() => navigate(`/dashboard/candidates/${f.submissionId}`)} className="truncate pb-1.5 text-left text-sm font-medium hover:underline">
              {f.fullName || f.anonymizedName}
            </button>
          ))}
          {rows.map(([label, cell]) => (
            <div key={label} className="contents">
              <span className={cn('border-t py-1.5 text-muted-foreground', fest)}>{label}</span>
              {items.map((f) => <span key={f.submissionId} className="border-t py-1.5 pr-3">{cell(f)}</span>)}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t('cand.compareNote')}</p>
    </SectionCard>
  );
}

// ================================================================== Interviews

/** Apple-Stil (22.11.2026): kein oranger Punkt, Handlungen als Textlinks (Blau nur für die eine Handlung je Zeile). */
export function InterviewsTab({ interviews, feedbackDue }: { interviews: AgendaInterview[]; feedbackDue: AgendaInterview[] }) {
  const { t } = useTranslation('clientJobs');
  const navigate = useNavigate();
  const now = Date.now();
  const due = new Set(feedbackDue.map((x) => x.id));
  const profile = (iv: AgendaInterview, open?: string) => navigate(`/dashboard/candidates/${iv.submissionId}`, open ? { state: { open } } : undefined);
  const upcoming = interviews.filter((iv) => iv.scheduledAt && Date.parse(iv.scheduledAt) >= now && !['cancelled', 'canceled'].includes(iv.status))
    .sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!));
  const open = interviews.filter((iv) => !iv.scheduledAt && !['cancelled', 'canceled'].includes(iv.status));
  const past = interviews.filter((iv) => iv.scheduledAt && Date.parse(iv.scheduledAt) < now && !due.has(iv.id))
    .sort((a, b) => Date.parse(b.scheduledAt!) - Date.parse(a.scheduledAt!));
  const fmtWhen = (iso: string) => `${fmtWeekdayDayMonth(iso)}, ${fmtTime(iso)}`;
  const format = (iv: AgendaInterview) => (iv.meetingType ? t(`iv.type.${iv.meetingType}`, { defaultValue: iv.meetingType }) : '');

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-4">
        {feedbackDue.length > 0 && (
          <SectionCard title={t('iv.feedbackTitle', { count: feedbackDue.length })}>
            {feedbackDue.map((iv) => (
              <div key={iv.id} className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0">
                <div className="min-w-0">
                  <p className="truncate text-sm"><span className="font-medium">{iv.candidateName}</span>{iv.scheduledAt ? ` · ${fmtWhen(iv.scheduledAt)}` : ''}</p>
                  <p className="text-xs text-muted-foreground">{t('iv.feedbackWaiting', { count: daysSince(iv.scheduledAt) })}</p>
                </div>
                <button type="button" className="shrink-0 whitespace-nowrap text-xs font-medium text-klick hover:underline" onClick={() => profile(iv, 'feedback')}>{t('iv.giveFeedback')} ›</button>
              </div>
            ))}
          </SectionCard>
        )}

        <SectionCard title={t('iv.upcomingTitle')} aside={<button type="button" className={linkBtn} onClick={() => navigate('/dashboard/interviews')}>{t('iv.all')}<ChevronRight className="h-3 w-3" /></button>}>
          {upcoming.length === 0 && open.length === 0 ? (
            <>
              <p className="text-sm">{t('cockpit.dates.emptyTitle')}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t('cockpit.dates.emptyText')}</p>
            </>
          ) : (
            <>
              {upcoming.map((iv) => (
                <div key={iv.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0">
                  <div className="w-12 shrink-0 rounded-lg bg-secondary py-1 text-center">
                    <p className="text-[11px] text-muted-foreground">{new Date(iv.scheduledAt!).toLocaleDateString(i18n.language, { weekday: 'short' })}</p>
                    <p className="text-sm font-semibold">{new Date(iv.scheduledAt!).getDate()}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm"><span className="font-medium">{iv.candidateName}</span> · {fmtTime(iv.scheduledAt!)} · {iv.durationMinutes} {t('iv.min')}{format(iv) ? ` · ${format(iv)}` : ''}</p>
                    <p className="text-xs text-muted-foreground">{iv.confirmed ? t('iv.confirmed') : t('iv.unconfirmed')}{iv.onsiteAddress ? ` · ${iv.onsiteAddress}` : ''}</p>
                  </div>
                  {iv.joinUrl && (
                    <a href={iv.joinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-klick hover:underline">{t('iv.join')}<ExternalLink className="h-3 w-3" /></a>
                  )}
                  <button type="button" className="shrink-0 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground" onClick={() => profile(iv)}>{t('iv.open')} ›</button>
                </div>
              ))}
              {open.map((iv) => (
                <div key={iv.id} className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm"><span className="font-medium">{iv.candidateName}</span> · {t('iv.proposed', { count: iv.proposedSlots.length })}</p>
                    <p className="text-xs text-muted-foreground">{iv.counterSlots.length ? t('iv.counter') : t('iv.waitingCandidate', { count: daysSince(iv.createdAt) })}</p>
                  </div>
                  <button type="button" className="shrink-0 whitespace-nowrap text-xs text-muted-foreground hover:text-foreground" onClick={() => profile(iv)}>{t('iv.open')} ›</button>
                </div>
              ))}
            </>
          )}
        </SectionCard>
      </div>

      <SectionCard title={t('iv.pastTitle', { count: past.length })}>
        {past.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('iv.pastNone')}</p>
        ) : past.map((iv) => (
          <button key={iv.id} type="button" onClick={() => profile(iv)} className="flex w-full items-center justify-between gap-3 border-t py-2 text-left first:border-t-0 hover:bg-muted/40">
            <span className="min-w-0">
              <span className="block truncate text-sm"><span className="font-medium">{iv.candidateName}</span> · {fmtDayMonth(iv.scheduledAt!)}</span>
              <span className="block truncate text-xs text-muted-foreground">{iv.feedback ? t('iv.withFeedback') : t('iv.noFeedback')}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
          </button>
        ))}
      </SectionCard>
    </div>
  );
}

// ================================================================== Markt & Headhunter

export function MarketTab({ searchersNode, searchSentence, items, budgetLabel, openQuestions, done, onAnswer, previewNode, onRequestChange, canRequest }: {
  searchersNode: ReactNode; searchSentence: string | null; items: BewerberItem[]; budgetLabel: string | null;
  openQuestions: ClientTask[]; done: ClientDoneItem[]; onAnswer: (t: ClientTask) => void; previewNode: ReactNode;
  onRequestChange: () => void; canRequest: boolean;
}) {
  const { t } = useTranslation('clientJobs');
  useTranslation('clientCandidates');
  const wishes = items.filter((i) => i.salaryBand).map((i) => ({ name: i.fullName || i.anonymizedName, band: i.salaryBand, out: i.archiveKind === 'abgelehnt' }));
  const reasons = new Map<string, number>();
  for (const i of items) if (i.archiveKind === 'abgelehnt') reasons.set(i.rejectReason ?? '', (reasons.get(i.rejectReason ?? '') ?? 0) + 1);
  const answered = done.filter((d) => d.kind === 'recruiter_question' && d.answer).sort((a, b) => b.doneAt.localeCompare(a.doneAt));

  return (
    <div className="space-y-4">
      {searchSentence && <p className="text-sm">{searchSentence}</p>}
      {searchersNode}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <SectionCard title={t('market.title')}>
          <p className="text-sm">{budgetLabel ? t('market.budget', { budget: budgetLabel }) : t('market.noBudget')}</p>
          {wishes.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">{t('market.noWishes')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {wishes.map((w, n) => (
                <li key={`${w.name}-${n}`} className={cn('flex justify-between gap-3', w.out && 'text-muted-foreground')}>
                  <span className="truncate">{w.name}{w.out ? ` · ${t('market.rejected')}` : ''}</span><span className="shrink-0 font-medium">{w.band}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm">{t('market.reasonsTitle')}</p>
          <p className="text-xs text-muted-foreground">
            {reasons.size === 0 ? t('market.reasonsNone') : [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k ? i18n.t(`clientCandidates:rejection.reasons.${k}`, { defaultValue: k }) : t('cand.noReason')} ${n}×`).join(' · ')}
          </p>
          {canRequest && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
              <p className="text-xs text-muted-foreground">{t('market.adjustHint')}</p>
              <button type="button" className="shrink-0 whitespace-nowrap text-xs font-medium text-klick hover:underline" onClick={onRequestChange}>{t('cockpit.speed.changeCta')} ›</button>
            </div>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title={t('market.questionsTitle')}>
            {openQuestions.map((q) => (
              <div key={q.key} className="flex items-center justify-between gap-3 border-t py-2 first:border-t-0">
                <p className="min-w-0 text-sm">{q.detail || q.title}<span className="block text-xs text-muted-foreground">{q.who}</span></p>
                <button type="button" className="shrink-0 whitespace-nowrap text-xs font-medium text-klick hover:underline" onClick={() => onAnswer(q)}>{t('cockpit.speed.answer')} ›</button>
              </div>
            ))}
            {answered.map((q) => (
              <div key={q.key} className="border-t py-2 first:border-t-0">
                <p className="text-sm">{q.label}</p>
                <p className="text-xs text-muted-foreground">{q.answer} · {fmtDayMonth(q.doneAt)}</p>
              </div>
            ))}
            {openQuestions.length === 0 && answered.length === 0 && <p className="text-sm text-muted-foreground">{t('market.questionsNone')}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{t('cockpit.speed.questionsHint')}</p>
          </SectionCard>
          {previewNode}
        </div>
      </div>
    </div>
  );
}

// ================================================================== Vertrag & Kosten

export function ContractTab({ facts, konditionenNode, canSeeFee, costLine, offers, onRequestChange, canRequest }: {
  facts: [string, string][]; konditionenNode: ReactNode; canSeeFee: boolean; costLine: string | null; offers: BewerberItem[];
  onRequestChange: () => void; canRequest: boolean;
}) {
  const { t } = useTranslation('clientJobs');
  const { t: ts } = useTranslation('clientSettings');
  const navigate = useNavigate();
  const vertrag = useVertragStand();
  const a = vertrag.data?.agreement ?? null;
  const openPdf = async () => {
    if (!a?.signed_document_path) return;
    const { data, error } = await supabase.storage.from('mandate-documents').createSignedUrl(a.signed_document_path, 300);
    if (error || !data?.signedUrl) { toast.error(t('contract.pdfError')); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <SectionCard title={t('contract.agreed')} aside={canRequest ? <button type="button" className={linkBtn} onClick={onRequestChange}>{t('cockpit.agreement.change')}<ChevronRight className="h-3 w-3" /></button> : undefined}>
          {facts.length > 0 && (
            <dl className="mb-3 space-y-1 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>
              ))}
            </dl>
          )}
          {konditionenNode}
        </SectionCard>

        <SectionCard title={t('contract.framework')}>
          {vertrag.isLoading ? (
            <p className="text-sm text-muted-foreground">…</p>
          ) : !a ? (
            <p className="text-sm text-muted-foreground">{t('contract.noFramework')}</p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm">{a.agreement_number ? t('contract.number', { number: a.agreement_number }) : t('contract.frameworkName')}</p>
                <p className="text-xs text-muted-foreground">
                  {ts(`vertrag.status.${a.status}`, { defaultValue: a.status })}
                  {a.countersigned_at ? ` · ${t('contract.signedOn', { date: fmtDate(a.countersigned_at) })}` : a.customer_signed_at ? ` · ${t('contract.signedOn', { date: fmtDate(a.customer_signed_at) })}` : ''}
                </p>
              </div>
              {a.signed_document_path && <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 px-2.5 text-xs" onClick={openPdf}><FileDown className="h-3 w-3" />PDF</Button>}
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{t('contract.frameworkHint')}</p>
        </SectionCard>
      </div>

      <div className="space-y-4">
        {canSeeFee && (
          <SectionCard title={t('contract.costTitle')}>
            {costLine ? <p className="text-sm">{costLine}</p> : <p className="text-sm text-muted-foreground">{t('contract.costNone')}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{t('contract.costHint')}</p>
          </SectionCard>
        )}

        <SectionCard title={t('contract.offersTitle', { count: offers.length })}>
          {offers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('contract.offersNone')}</p>
          ) : offers.map((o) => (
            <button key={o.submissionId} type="button" onClick={() => navigate(`/dashboard/candidates/${o.submissionId}`)} className="flex w-full items-center justify-between gap-3 border-t py-2 text-left first:border-t-0 hover:bg-muted/40">
              <span className="min-w-0 truncate text-sm"><span className="font-medium">{o.fullName || o.anonymizedName}</span>{o.currentRole ? ` · ${o.currentRole}` : ''}</span>
              <BewerberStatusPill item={o} />
            </button>
          ))}
        </SectionCard>

        <SectionCard title={t('contract.placementsTitle')}>
          <p className="text-sm text-muted-foreground">{t('contract.placementsText')}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <button type="button" className={cn(linkBtn, 'font-medium text-klick hover:text-klick hover:underline')} onClick={() => navigate('/dashboard/besetzungen')}>{t('contract.placementsLink')}<ChevronRight className="h-3 w-3" /></button>
            {canSeeFee && <button type="button" className={cn(linkBtn, 'font-medium text-klick hover:text-klick hover:underline')} onClick={() => navigate('/dashboard/rechnungen')}>{t('contract.invoicesLink')}<ChevronRight className="h-3 w-3" /></button>}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

/** Kosten-Beispiel: Contracting = Tagessatz × 20 Tage im Monat; Festanstellung = Honorar % × Gehalt (nur mit Zahlen, nichts geschätzt). */
export function costLineOf(input: { freelance: boolean; dayMin?: number | null; dayMax?: number | null; daysPerWeek?: number | null; feePct?: number | null; salaryMin?: number | null; salaryMax?: number | null }, t: (k: string, o?: Record<string, unknown>) => string): string | null {
  if (input.freelance) {
    const rates = [input.dayMin, input.dayMax].filter((v): v is number => !!v);
    if (!rates.length) return null;
    const rate = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length);
    const days = Math.round((input.daysPerWeek ?? 5) * 4);
    return t('contract.costFreelance', { rate: fmtMoney(rate), days, total: fmtMoney(rate * days) });
  }
  if (!input.feePct) return null;
  const sal = [input.salaryMin, input.salaryMax].filter((v): v is number => !!v);
  if (!sal.length) return t('contract.costPermNoSalary', { pct: input.feePct });
  const mid = Math.round(sal.reduce((a, b) => a + b, 0) / sal.length);
  return t('contract.costPerm', { pct: input.feePct, salary: fmtMoney(mid), total: fmtMoney(Math.round((mid * input.feePct) / 100)) });
}

// ================================================================== Team & Verlauf

export type HistoryKind = 'kandidaten' | 'interviews' | 'stelle' | 'team';
export interface HistoryEvent { when: string; text: string; kind: HistoryKind; who?: string | null }

export function TeamTab({ teamNode, events, summaryNode }: { teamNode: ReactNode; events: HistoryEvent[]; summaryNode: ReactNode }) {
  const { t } = useTranslation('clientJobs');
  const [kind, setKind] = useState<HistoryKind | 'alle'>('alle');
  const shown = events.filter((e) => kind === 'alle' || e.kind === kind);
  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-4">
        {teamNode}
        {summaryNode}
      </div>
      <SectionCard title={t('team.historyTitle')}>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {(['alle', 'kandidaten', 'interviews', 'stelle', 'team'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={cn('h-7 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors', kind === k ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
              {t(`team.filter.${k}`)}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('team.historyNone')}</p>
        ) : (
          <ul>
            {shown.map((e, n) => (
              <li key={`${e.when}-${n}`} className="flex gap-3 border-t py-2 text-sm first:border-t-0">
                <span className="w-12 shrink-0 text-xs text-muted-foreground">{fmtDayMonth(e.when)}</span>
                <span className="min-w-0">{e.text}{e.who ? <span className="text-xs text-muted-foreground"> · {e.who}</span> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
