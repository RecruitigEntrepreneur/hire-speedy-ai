import { useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, addMonths, format, formatDistanceToNow, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { intlLocale } from '@/i18n/languages';
import { dateFnsLocale } from '@/components/recruiter/termin/datum';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import {
  useRecruiterInterviewAgenda,
  type RecruiterInterview,
  type RecruiterInterviewAgenda,
} from '@/hooks/useRecruiterInterviewAgenda';
import type { RecruiterTerminVariant } from '@/components/interview/agenda/RecruiterTerminSheet';
import { TerminFenster, firmaOderBranche, type TerminAufgabe } from '@/components/recruiter/termin/TerminFenster';
import { useRecruiterPipeline } from '@/hooks/useRecruiterPipeline';
import { useUnifiedTaskInbox } from '@/hooks/useUnifiedTaskInbox';
import { buildGuide } from '@/components/recruiter/tasks/taskWindow';
import { meetingTypeLabel } from '@/components/interview/agenda/meetingType';
import { cn } from '@/lib/utils';
import { ErstgespraecheAbschnitt, useErstgespraeche } from '@/components/recruiter/termin/Erstgespraeche';

// Die Seite ruft ihre Texte als t('recruiterInterviews.…') auf. Der Namespace recruiterInterviews
// führt dieselben Schlüssel in allen vier Sprachen; „translation“ (nur de/en) bleibt als Rückfall.
// „interviews“: Beschriftung der Gesprächsart (meetingTypeLabel).
const NS = ['recruiterInterviews', 'translation', 'interviews', 'recruiterTasks'];

// Anzeige immer in deutscher Zeit, Format in der Sprache der Oberfläche (wie auf der Kunden-Seite)
const timeShort = (iso: string, language: string) =>
  new Date(iso).toLocaleTimeString(intlLocale(language), { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
const dateShort = (iso: string, language: string) =>
  new Date(iso).toLocaleDateString(intlLocale(language), { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit' });
const dayLabel = (iso: string, language: string, today: string, tomorrow: string) => {
  const key = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });
  const that = new Date(iso);
  if (key(that) === key(new Date())) return today;
  if (key(that) === key(new Date(Date.now() + 86_400_000))) return tomorrow;
  return that.toLocaleDateString(intlLocale(language), { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' });
};

/** Leitet die Sheet-Variante aus der Gruppierung des Hooks ab — damit Deeplinks
 *  (?interview=…) dieselbe Einordnung bekommen wie ein Klick in der Liste. */
function variantOf(
  iv: RecruiterInterview,
  agenda: RecruiterInterviewAgenda,
): RecruiterTerminVariant {
  if (agenda.counterProposals.some((x) => x.id === iv.id)) return 'counter';
  if (agenda.debriefDue.some((x) => x.id === iv.id)) return 'debrief';
  if (agenda.awaitingScheduling.some((x) => x.id === iv.id)) return 'awaiting';
  if (agenda.cancelled.some((x) => x.id === iv.id)) return 'cancelled';
  if (agenda.agendaDays.some((d) => d.items.some((x) => x.id === iv.id))) return 'agenda';
  return 'past';
}

const tagKey = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Europe/Berlin' });

/** Kleiner Monatskalender oben rechts (24.11.2026, Marko): ein Punkt heißt Termin, ein Klick zeigt die Termine des Tages. */
function MiniKalender({ termine, gewaehlt, onWaehle }: { termine: Set<string>; gewaehlt: string | null; onWaehle: (key: string | null) => void }) {
  const { t, i18n } = useTranslation(NS);
  const locale = dateFnsLocale(i18n.language);
  const [monat, setMonat] = useState(() => startOfMonth(new Date()));
  const start = startOfWeek(monat, { weekStartsOn: 1 });
  const tage = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  // Sechste Woche nur zeigen, wenn sie noch zum Monat gehört
  const sichtbar = isSameMonth(tage[35], monat) ? tage : tage.slice(0, 35);
  const heute = tagKey(new Date());
  return (
    <div className="rounded-[20px] border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight">{format(monat, 'LLLL yyyy', { locale })}</h2>
        <div className="flex gap-1">
          <Button variant="secondary" size="icon" className="h-7 w-7" aria-label={t('recruiterInterviews.calendar.prev')} onClick={() => setMonat((m) => addMonths(m, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="icon" className="h-7 w-7" aria-label={t('recruiterInterviews.calendar.next')} onClick={() => setMonat((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {tage.slice(0, 7).map((d) => (
          <span key={`k-${d.getDay()}`} className="pb-1 text-[11px] text-muted-foreground">{format(d, 'EEEEEE', { locale })}</span>
        ))}
        {sichtbar.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const hat = termine.has(key);
          const imMonat = isSameMonth(d, monat);
          return (
            <button
              key={key}
              type="button"
              disabled={!hat}
              aria-pressed={gewaehlt === key}
              aria-label={`${format(d, 'PPPP', { locale })}${hat ? `, ${t('recruiterInterviews.calendar.has')}` : ''}`}
              onClick={() => onWaehle(gewaehlt === key ? null : key)}
              className={cn(
                'relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs tabular-nums transition-colors',
                !imMonat && 'text-muted-foreground/40',
                imMonat && !hat && 'text-muted-foreground',
                hat && 'font-semibold hover:bg-accent/60',
                key === heute && 'bg-secondary text-foreground',
                gewaehlt === key && 'bg-foreground text-background hover:bg-foreground',
              )}
            >
              {format(d, 'd')}
              {hat && <span className={cn('absolute bottom-0.5 h-1 w-1 rounded-full', gewaehlt === key ? 'bg-background' : 'bg-foreground')} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Reiter = 'upcoming' | 'awaiting' | 'past' | 'cancelled';

/**
 * Ein Interview als Karte (24.11.2026, Marko: hier stehen nur Termine): wer, bei wem, wann und wie.
 * Überall dieselbe Handlung „Ansehen“; was zu tun ist, steht unter „Aufgaben“.
 */
function InterviewCard({
  iv,
  variant,
  aufgaben,
  ohneTag,
  onOpen,
}: {
  iv: RecruiterInterview;
  variant: RecruiterTerminVariant;
  aufgaben: number;
  /** In „Kommende“ steht der Tag schon als Überschrift */
  ohneTag?: boolean;
  onOpen: (iv: RecruiterInterview, variant: RecruiterTerminVariant) => void;
}) {
  const { t, i18n } = useTranslation(NS);
  const locale = dateFnsLocale(i18n.language);
  const wann = iv.scheduledAt
    ? ohneTag ? timeShort(iv.scheduledAt, i18n.language) : `${dateShort(iv.scheduledAt, i18n.language)}, ${timeShort(iv.scheduledAt, i18n.language)}`
    : null;
  const runde = t('recruiterInterviews.window.round', { n: iv.round || 1 });
  const meta = (variant === 'awaiting' || variant === 'counter'
    ? [t('recruiterInterviews.card.asked', { time: formatDistanceToNow(new Date(iv.createdAt), { locale, addSuffix: true }) }), variant === 'counter' ? t('recruiterInterviews.row.counter') : null]
    : variant === 'cancelled'
      ? [wann, t(iv.status === 'no_show' ? 'recruiterInterviews.row.no_show' : 'recruiterInterviews.row.cancelled')]
      : [wann, meetingTypeLabel(iv.meetingType), runde,
          variant === 'agenda' ? (iv.confirmed ? t('recruiterInterviews.window.confirmed') : t('recruiterInterviews.row.unconfirmed')) : null]
  ).filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={() => onOpen(iv, variant)}
      className="flex flex-col rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent/30"
    >
      <p className="w-full truncate text-sm font-medium">{iv.candidateName}</p>
      <p className="w-full truncate text-xs text-muted-foreground">{[iv.jobTitle, firmaOderBranche(iv)].filter(Boolean).join(' · ')}</p>
      <span className="mt-4 flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {meta}
          {variant === 'awaiting' && iv.slotsExpired && <span className="text-destructive"> · {t('recruiterInterviews.row.slots_expired')}</span>}
          {aufgaben > 0 && <span className="text-foreground"> · {t('recruiterInterviews.card.tasks', { count: aufgaben })}</span>}
        </span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-xs font-medium text-klick">{t('recruiterInterviews.card.view')} ›</span>
      </span>
    </button>
  );
}

export default function RecruiterInterviews() {
  const { t, i18n } = useTranslation(NS);
  const locale = dateFnsLocale(i18n.language);
  const erstgespraeche = useErstgespraeche({ kommende: true });
  const { data: agenda, isLoading } = useRecruiterInterviewAgenda();
  const pipeline = useRecruiterPipeline();
  const { allItems } = useUnifiedTaskInbox('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Reiter | null>(null);
  const [query, setQuery] = useState('');
  // Tag aus dem kleinen Kalender; null = Reiter wie gewohnt
  const [tag, setTag] = useState<string | null>(null);
  const [fenster, setFenster] = useState<{ iv: RecruiterInterview | null; variant: RecruiterTerminVariant }>({ iv: null, variant: 'agenda' });

  const openTermin = useCallback((iv: RecruiterInterview, variant: RecruiterTerminVariant) => setFenster({ iv, variant }), []);
  const closeTermin = useCallback(() => {
    setFenster((s) => ({ ...s, iv: null }));
    // Deeplink-Parameter entfernen, sonst öffnet sich das Fenster beim nächsten Render sofort wieder.
    if (searchParams.has('interview')) {
      const next = new URLSearchParams(searchParams);
      next.delete('interview');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Deeplink aus Benachrichtigungen: /recruiter/interviews?interview=<id>
  const deepLinkId = searchParams.get('interview');
  useEffect(() => {
    if (!deepLinkId || !agenda) return;
    if (fenster.iv?.id === deepLinkId) return;
    const target = agenda.all.find((x) => x.id === deepLinkId);
    if (target) setFenster({ iv: target, variant: variantOf(target, agenda) });
  }, [deepLinkId, agenda, fenster.iv?.id]);

  // Offene Aufgaben je Vorstellung: hier nur als Hinweis, abgearbeitet wird unter „Aufgaben“
  const aufgabenJe = useMemo(() => {
    const m = new Map<string, TerminAufgabe[]>();
    for (const i of allItems) {
      if (!i.submissionId) continue;
      const liste = m.get(i.submissionId) ?? [];
      liste.push({ id: i.itemId, label: buildGuide(i).pill });
      m.set(i.submissionId, liste);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, i18n.language]);
  const anzahl = (iv: RecruiterInterview) => aufgabenJe.get(iv.submissionId)?.length ?? 0;

  const nextUp = agenda?.nextUp ?? null;

  const cancelShare = useMemo(() => {
    const total = agenda?.all.length ?? 0;
    const dead = agenda?.cancelled.length ?? 0;
    if (total < 5 || dead === 0) return null;
    return Math.round((dead / total) * 100);
  }, [agenda?.all.length, agenda?.cancelled.length]);

  // Reiter: nur Termine. Ein Reiter erscheint nur, wenn es dafür etwas gibt.
  const listen = useMemo(() => {
    const q = query.trim().toLowerCase();
    const passt = (iv: RecruiterInterview) => !q || `${iv.candidateName} ${iv.jobTitle} ${iv.companyLabel ?? ''}`.toLowerCase().includes(q);
    const abgesagt = new Set((agenda?.cancelled ?? []).map((x) => x.id));
    const war = [...(agenda?.debriefDue ?? []), ...(agenda?.past ?? []).filter((x) => !abgesagt.has(x.id))]
      .sort((a, b) => (b.scheduledAt ?? '').localeCompare(a.scheduledAt ?? ''));
    return {
      upcoming: (agenda?.agendaDays ?? []).flatMap((d) => d.items).filter(passt),
      awaiting: [...(agenda?.counterProposals ?? []), ...(agenda?.awaitingScheduling ?? [])].filter(passt),
      past: war.filter(passt).slice(0, 30),
      cancelled: (agenda?.cancelled ?? []).filter(passt).slice(0, 20),
    } satisfies Record<Reiter, RecruiterInterview[]>;
  }, [agenda, query]);
  const REIHE: Reiter[] = ['upcoming', 'awaiting', 'past', 'cancelled'];
  const reiterListe = REIHE.filter((k) => listen[k].length > 0);
  const aktiv: Reiter | null = tab && reiterListe.includes(tab) ? tab : reiterListe[0] ?? null;
  const kommendeTage = (agenda?.agendaDays ?? [])
    .map((d) => ({ ...d, items: d.items.filter((iv) => listen.upcoming.includes(iv)) }))
    .filter((d) => d.items.length > 0);

  // Kalender: alle Termine mit Uhrzeit, außer abgesagten
  const aktive = useMemo(() => (agenda?.all ?? []).filter((iv) => iv.scheduledAt && iv.status !== 'cancelled'), [agenda]);
  const termine = useMemo(() => new Set(aktive.map((iv) => tagKey(iv.scheduledAt!))), [aktive]);
  const amTag = tag ? aktive.filter((iv) => tagKey(iv.scheduledAt!) === tag).sort((a, b) => a.scheduledAt!.localeCompare(b.scheduledAt!)) : [];

  const zahlen = [
    (agenda?.weekCount ?? 0) > 0 ? t('recruiterInterviews.summary.week', { count: agenda!.weekCount }) : null,
    (agenda?.awaitingCount ?? 0) > 0 ? t('recruiterInterviews.summary.noDate', { count: agenda!.awaitingCount }) : null,
  ].filter(Boolean).join(' · ');
  const hasAny = (agenda?.all.length ?? 0) > 0 || (erstgespraeche.data?.length ?? 0) > 0;
  const laeuft = nextUp?.scheduledAt ? Date.now() >= new Date(nextUp.scheduledAt).getTime() : false;
  const karte = (iv: RecruiterInterview, ohneTag = false) => (
    <InterviewCard key={iv.id} iv={iv} variant={variantOf(iv, agenda!)} aufgaben={anzahl(iv)} ohneTag={ohneTag} onOpen={openTermin} />
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Kopf: ein Satz mit den Zahlen */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('recruiterInterviews.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{zahlen || t('recruiterInterviews.subtitle')}</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : !hasAny ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card px-6 py-16 text-center" data-tour="interviews.stats">
            <CalendarDays className="h-8 w-8 text-muted-foreground/50" />
            <p className="max-w-sm text-sm text-muted-foreground">{t('recruiterInterviews.empty')}</p>
          </div>
        ) : (
          <>
            {/* Links das nächste Interview beim Kunden, rechts der kleine Kalender */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="flex min-w-0 flex-col rounded-[20px] border bg-card p-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold tracking-tight">{t('recruiterInterviews.hero.title')}</h2>
                  {nextUp?.scheduledAt && (
                    <span className="text-xs text-muted-foreground">
                      {laeuft ? t('recruiterInterviews.hero.live') : formatDistanceToNow(new Date(nextUp.scheduledAt), { locale, addSuffix: true })}
                    </span>
                  )}
                </div>
                {nextUp && nextUp.scheduledAt ? (
                  <>
                    <button type="button" onClick={() => openTermin(nextUp, variantOf(nextUp, agenda!))} className="mt-4 block max-w-full text-left">
                      <p className="text-xl font-semibold leading-snug tracking-tight">
                        {dayLabel(nextUp.scheduledAt, i18n.language, t('page.day.today'), t('page.day.tomorrow'))}, {timeShort(nextUp.scheduledAt, i18n.language)} · {nextUp.candidateName}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {[firmaOderBranche(nextUp), nextUp.jobTitle, meetingTypeLabel(nextUp.meetingType), t('recruiterInterviews.row.duration', { min: nextUp.durationMinutes }),
                          t('recruiterInterviews.window.round', { n: nextUp.round || 1 }),
                          nextUp.confirmed ? t('recruiterInterviews.window.confirmed') : t('recruiterInterviews.row.unconfirmed')].filter(Boolean).join(' · ')}
                      </p>
                    </button>
                    <div className="mt-auto pt-5">
                      <Button className="px-5" onClick={() => openTermin(nextUp, variantOf(nextUp, agenda!))}>{t('recruiterInterviews.hero.view')}</Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">{t('recruiterInterviews.hero.none')}</p>
                )}
              </div>
              <MiniKalender termine={termine} gewaehlt={tag} onWaehle={setTag} />
            </div>

            {/* Erstgespräche aus der Terminseite (21.10.2026): eigene Gruppe, getrennt von Kundeninterviews */}
            <ErstgespraecheAbschnitt liste={erstgespraeche.data ?? []} />

            {/* Reiter links, Suche rechts. data-tour: Ziel des Headhunter-Rundgangs (lib/recruiterGuide.ts) */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" data-tour="interviews.stats">
              <div role="tablist" className="flex min-w-0 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {reiterListe.map((k) => (
                  <button key={k} type="button" role="tab" aria-selected={!tag && aktiv === k} onClick={() => { setTab(k); setTag(null); }}
                    className={cn('h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors', !tag && aktiv === k ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground')}>
                    {t(`recruiterInterviews.tabs.${k}`)} <span className="font-normal">{listen[k].length}</span>
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('recruiterInterviews.searchPh')} className="h-9 rounded-full pl-9 text-sm" />
              </div>
            </div>

            {tag ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {new Date(`${tag}T12:00:00`).toLocaleDateString(intlLocale(i18n.language), { weekday: 'long', day: 'numeric', month: 'long' })}
                    <span className="font-normal text-muted-foreground"> · {t('recruiterInterviews.calendar.count', { count: amTag.length })}</span>
                  </p>
                  <button type="button" className="text-sm text-klick hover:underline" onClick={() => setTag(null)}>{t('recruiterInterviews.calendar.showAll')} ›</button>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{amTag.map((iv) => karte(iv, true))}</div>
              </>
            ) : aktiv === 'upcoming' ? (
              <div className="space-y-4">
                {kommendeTage.map((d) => (
                  <div key={d.key}>
                    <p className="mb-2 text-sm font-medium">{d.label}</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{d.items.map((iv) => karte(iv, true))}</div>
                  </div>
                ))}
              </div>
            ) : aktiv ? (
              <>
                {aktiv === 'cancelled' && cancelShare !== null && (
                  <p className="text-xs text-muted-foreground">{t('recruiterInterviews.cancel_hint', { percent: cancelShare })}</p>
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{listen[aktiv].map((iv) => karte(iv))}</div>
              </>
            ) : (
              <p className="rounded-xl border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
                {query.trim() ? t('recruiterInterviews.noMatch') : t('recruiterInterviews.empty')}
              </p>
            )}
          </>
        )}
      </div>

      <TerminFenster
        interview={fenster.iv}
        variant={fenster.variant}
        stage={fenster.iv && pipeline ? pipeline.stageOf[fenster.iv.submissionId] ?? null : null}
        aufgaben={fenster.iv ? aufgabenJe.get(fenster.iv.submissionId) ?? [] : []}
        onClose={closeTermin}
      />
    </DashboardLayout>
  );
}
