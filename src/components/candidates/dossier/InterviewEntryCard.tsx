import { useEffect, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from '@/lib/candidateDateLocale';
import { intlLocale } from '@/i18n/languages';
import { term } from '@/lib/candidateTerms';
import { Bell, CalendarPlus, Check, CheckCircle2, Circle, CircleDot, Copy, FileUp, Loader2, NotebookPen, Phone, PhoneCall, Play, Video, X, Zap, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EinladungFenster } from '@/components/recruiter/termin/EinladungFenster';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { useErstgespraeche, type Erstgespraech } from '@/components/recruiter/termin/Erstgespraeche';
import { useKandidatEinladung } from '@/components/recruiter/termin/useKandidatEinladung';
import { useLebenslaufAnfrage } from '@/components/recruiter/termin/useLebenslaufAnfrage';
import { cvViewUrl } from '@/hooks/useCandidateCv';
import type { CurrentCv } from '@/lib/candidateCv';
import { einladungApi, einladungsLink } from '@/lib/terminApi';
import { cn } from '@/lib/utils';

interface SourceRow {
  id: string;
  kind: string;
  label: string | null;
  created_at: string;
  raw_text: string | null;
  expires_at: string | null;
}

// So wurde die Bezeichnung der Quelle gespeichert (deutsch): nur zum Vergleich mit s.label.
// Angezeigt wird candidateInterview:card.kind.<art>.
const KIND_LABEL: Record<string, string> = {
  notes: 'Eigene Notizen',
  transcript: 'Transkript',
  photo: 'Foto',
  mail: 'Mail',
  quick: 'Aus dem Kopf',
  live: 'Live-Interview',
};

// Beschriftung: candidateInterview:card.steps.<schritt>
const SCHRITTE = ['invite', 'appointment', 'talk', 'complete'] as const;
const MAX_LUECKEN = 4;

const tage = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));

/** Zeile unter dem Hauptknopf: die anderen Wege, ruhig und klein. */
function Nebenweg({ Icon, children, onClick, disabled }: { Icon: LucideIcon; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
    <Icon className="h-3.5 w-3.5"/>{children}
  </button>;
}

/**
 * Das Kandidateninterview in einer Karte (01.11.2026, Gestaltung „Mit Schritten“): Einladen,
 * Termin, Gespräch, Abschließen. Immer ein klarer nächster Schritt, die anderen Wege darunter.
 * Darunter der Verlauf der Quellen.
 */
export function InterviewEntryCard({
  candidateId,
  vorname,
  email,
  hasInterview,
  completed = false,
  interviewDate,
  gaps = [],
  refreshKey,
  onImport,
  onLive,
  onQuick,
  lebenslauf = null,
  onLebenslaufAnfragen,
  onUploadCv,
}: {
  candidateId: string;
  vorname: string;
  email: string | null;
  hasInterview: boolean;
  /** Mit „Interview abschließen“ beendet und alle Mindestangaben da (interviewCompleted). */
  completed?: boolean;
  interviewDate: string | null;
  /** Was zum Abschließen noch fehlt (abschlussGaps). */
  gaps?: { key: string; label: string }[];
  refreshKey?: number;
  onImport: () => void;
  onLive: () => void;
  onQuick: () => void;
  /** Aktueller Lebenslauf aus der Akte (05.11.2026): Zeile unten in der Karte. */
  lebenslauf?: CurrentCv | null;
  onLebenslaufAnfragen?: () => void;
  onUploadCv?: () => void;
}) {
  const { t, i18n } = useTranslation(['candidateInterview', 'candidateTerms']);
  const locale = intlLocale(i18n.language);
  const wann = (iso: string) => format(new Date(iso), t('card.dateFormat'), { locale: dateFnsLocale(i18n.language) });
  const vorTagen = (iso: string, gross = false) => { const d = tage(iso); return d === 0 ? t(gross ? 'card.todayCap' : 'card.today') : d === 1 ? t(gross ? 'card.yesterdayCap' : 'card.yesterday') : t(gross ? 'card.daysAgoCap' : 'card.daysAgo', { n: d }); };
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [fensterOffen, setFensterOffen] = useState(false);
  const [arbeitet, setArbeitet] = useState<'erinnern' | 'link' | 'zurueck' | null>(null);
  const { einladung, neuLaden, isLoading: einladungLaedt } = useKandidatEinladung(candidateId);
  const { anfrage, neuLaden: anfrageNeu } = useLebenslaufAnfrage(candidateId);
  const [erinnert, setErinnert] = useState(false);

  const lebenslaufErinnern = async () => {
    try {
      await einladungApi.lebenslaufErinnern(candidateId);
      setErinnert(true);
      toast.success(t('card.reminderSent', { name: vorname }));
      void anfrageNeu();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('card.reminderFailed'));
    }
  };
  const lebenslaufAnsehen = async () => {
    const url = lebenslauf ? await cvViewUrl(lebenslauf) : null;
    if (url) window.open(url, '_blank', 'noopener'); else toast.error(t('card.cvOpenFailed'));
  };
  const { data: termine = [], isLoading: termineLaden } = useErstgespraeche({ candidateId });

  // „Anlegen und einladen“ (Kandidaten anlegen, 04.11.2026): ?einladen=1 öffnet gleich die Einladung.
  const [suche, setSuche] = useSearchParams();
  useEffect(() => {
    if (suche.get('einladen') !== '1') return;
    setFensterOffen(true);
    const next = new URLSearchParams(suche);
    next.delete('einladen');
    setSuche(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase
      .from('candidate_capture_sources' as never)
      .select('id, kind, label, created_at, raw_text, expires_at')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => setSources(error ? [] : ((data ?? []) as unknown as SourceRow[])));
  }, [candidateId, refreshKey]);

  const jetzt = Date.now();
  const kommend: Erstgespraech | undefined = termine.find((t) => Date.parse(t.ends_at) > jetzt);
  const vorbei: Erstgespraech | undefined = [...termine].reverse().find((t) => Date.parse(t.ends_at) <= jetzt);
  const laeuft = !!kommend && Date.parse(kommend.starts_at) - 10 * 60_000 <= jetzt;

  const aktion = async (art: 'erinnern' | 'link' | 'zurueck') => {
    setArbeitet(art);
    try {
      if (art === 'erinnern') { await einladungApi.erinnern(candidateId); toast.success(t('card.reminderSent', { name: vorname })); }
      if (art === 'link') {
        const r = await einladungApi.link(candidateId);
        await navigator.clipboard.writeText(einladungsLink(r.token));
        toast.success(t('card.linkCopied'));
      }
      if (art === 'zurueck') { await einladungApi.zurueckziehen(candidateId); toast.success(t('card.withdrawn')); }
      await neuLaden();
      notifyTasksChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('card.failed'));
    } finally { setArbeitet(null); }
  };

  // Stand der Karte: abgeschlossen, Termin steht, Interview offen, eingeladen, noch nichts.
  let schritt: number;
  let etikett: { text: string; ton: string };
  let titel: string;
  let unter: ReactNode;
  let haupt: ReactNode;
  let neben: ReactNode;

  const liveBtn = <Nebenweg Icon={PhoneCall} onClick={onLive}>{t('card.live')}</Nebenweg>;
  const einwerfen = <Nebenweg Icon={FileUp} onClick={onImport}>{t('card.dropNotes')}</Nebenweg>;
  const ausKopf = <Nebenweg Icon={Zap} onClick={onQuick}>{t('card.fromMemory')}</Nebenweg>;

  if (completed) {
    schritt = SCHRITTE.length;
    etikett = { text: t('card.badgeDone'), ton: 'bg-success/10 text-success' };
    titel = t('card.titleDone');
    unter = interviewDate ? t('card.onDate', { date: new Date(interviewDate).toLocaleDateString(locale) }) : t('card.canSubmit');
    haupt = <Button size="sm" variant="outline" onClick={onLive} className="gap-1.5"><NotebookPen className="h-3.5 w-3.5"/>{t('card.open')}</Button>;
    neben = <Nebenweg Icon={FileUp} onClick={onImport}>{t('card.dropAddendum')}</Nebenweg>;
  } else if (kommend) {
    schritt = 2;
    etikett = { text: laeuft ? t('card.badgeNow') : t('card.badgeBooked'), ton: 'bg-primary/10 text-primary' };
    titel = wann(kommend.starts_at);
    unter = t(kommend.mode === 'teams' ? 'card.bookedTeams' : 'card.bookedPhone', { minutes: Math.round((Date.parse(kommend.ends_at) - Date.parse(kommend.starts_at)) / 60000), phone: kommend.phone ? ` ${kommend.phone}` : '', name: vorname });
    haupt = kommend.mode === 'teams' && kommend.join_url
      ? <Button size="sm" asChild className="gap-1.5"><a href={kommend.join_url} target="_blank" rel="noreferrer"><Video className="h-3.5 w-3.5"/>{t('card.join')}</a></Button>
      : kommend.mode === 'phone' && kommend.phone
        ? <Button size="sm" asChild className="gap-1.5"><a href={`tel:${kommend.phone.replace(/[^\d+]/g, '')}`}><Phone className="h-3.5 w-3.5"/>{t('card.call')}</a></Button>
        : <Button size="sm" onClick={onLive} className="gap-1.5"><NotebookPen className="h-3.5 w-3.5"/>{t('card.open')}</Button>;
    neben = <>{(kommend.join_url || kommend.phone) && <Nebenweg Icon={NotebookPen} onClick={onLive}>{t('card.open')}</Nebenweg>}{einwerfen}</>;
  } else if (hasInterview || vorbei) {
    schritt = 3;
    const nochNichts = !hasInterview;
    etikett = { text: nochNichts ? t('card.badgeHappened') : t('card.badgeDraft'), ton: 'bg-warning/10 text-warning' };
    if (nochNichts && vorbei) {
      titel = t('card.happened', { when: vorTagen(vorbei.starts_at) });
      unter = t('card.captureFresh');
    } else if (gaps.length) {
      titel = t('card.draftMissing', { count: gaps.length });
      const liste = gaps.slice(0, MAX_LUECKEN).map((g) => term(g.label)).join(', ');
      unter = gaps.length > MAX_LUECKEN ? t('card.stillOpenMore', { list: liste, more: gaps.length - MAX_LUECKEN }) : t('card.stillOpen', { list: liste });
    } else {
      titel = t('card.allThere');
      unter = t('card.oneStep');
    }
    const fertig = !nochNichts && !gaps.length;
    haupt = <Button size="sm" onClick={onLive} className="gap-1.5">{fertig ? <Check className="h-3.5 w-3.5"/> : <Play className="h-3.5 w-3.5"/>}{fertig ? t('card.complete') : nochNichts ? t('card.capture') : t('card.finish')}</Button>;
    neben = <>{einwerfen}{ausKopf}</>;
  } else if (einladung) {
    schritt = 1;
    etikett = { text: t('card.badgeWaiting', { name: vorname }), ton: 'bg-warning/10 text-warning' };
    titel = t('card.invited', { name: vorname });
    const art = einladung.arten.length > 1 ? t('card.teamsOrPhone') : einladung.arten[0] === 'teams' ? 'Teams' : t('card.phone');
    unter = t(einladung.perMail ? 'card.invitedByMail' : 'card.invitedByLink', { when: vorTagen(einladung.seit, true), mode: art, opened: einladung.geoeffnet ? t('card.linkOpened') : t('card.linkNotOpened') });
    haupt = email
      ? <Button size="sm" onClick={() => void aktion('erinnern')} disabled={!!arbeitet} className="gap-1.5">{arbeitet === 'erinnern' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Bell className="h-3.5 w-3.5"/>}{t('card.remind')}</Button>
      : <Button size="sm" onClick={() => void aktion('link')} disabled={!!arbeitet} className="gap-1.5"><Copy className="h-3.5 w-3.5"/>{t('card.copyLink')}</Button>;
    neben = <>{email && <Nebenweg Icon={Copy} onClick={() => void aktion('link')} disabled={!!arbeitet}>{t('card.copyLink')}</Nebenweg>}{liveBtn}<Nebenweg Icon={X} onClick={() => void aktion('zurueck')} disabled={!!arbeitet}>{t('card.withdraw')}</Nebenweg></>;
  } else {
    schritt = 0;
    etikett = { text: t('card.badgeNone'), ton: 'bg-muted text-muted-foreground' };
    titel = t('card.noTalk', { name: vorname });
    unter = t('card.inviteOrCapture');
    haupt = <Button size="sm" onClick={() => setFensterOffen(true)} className="gap-1.5"><CalendarPlus className="h-3.5 w-3.5"/>{t('card.inviteToTalk')}</Button>;
    neben = <>{liveBtn}{einwerfen}{ausKopf}</>;
  }

  // Beim ersten Laden keinen falschen Stand zeigen, der gleich wechselt.
  const laedt = !completed && !hasInterview && (einladungLaedt || termineLaden);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">{t('card.title')}</h3>
          {!laedt && <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', etikett.ton)}>{etikett.text}</span>}
        </div>

        <div className="flex items-center gap-1.5" aria-label={t('card.stepOf', { step: Math.min(schritt + 1, SCHRITTE.length), total: SCHRITTE.length })}>
          {SCHRITTE.map((s, i) => {
            const fertig = !laedt && i < schritt;
            const aktuell = !laedt && i === schritt;
            const Icon = fertig ? CheckCircle2 : aktuell ? CircleDot : Circle;
            return <div key={s} className={cn('flex items-center gap-1.5', i < SCHRITTE.length - 1 && 'flex-1')}>
              <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-[11px]', fertig ? 'text-success' : aktuell ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                <Icon className="h-3.5 w-3.5"/>{t(`card.steps.${s}`)}
              </span>
              {i < SCHRITTE.length - 1 && <span className={cn('h-px min-w-2 flex-1', fertig ? 'bg-success/50' : 'bg-border')}/>}
            </div>;
          })}
        </div>

        {laedt ? <div className="flex h-[74px] items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/></div> : <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[200px] flex-1">
              <p className="text-[15px] font-medium leading-snug">{titel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{unter}</p>
            </div>
            {haupt}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">{neben}</div>
        </>}

        {/* Lebenslauf (05.11.2026): ruhig in Grau, gelb wird es erst beim Einreichen. */}
        {!laedt && (
          <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
            {lebenslauf ? (
              <><span className="text-success">{t('card.cvThere')}</span> · <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => void lebenslaufAnsehen()}>{t('card.view')}</button></>
            ) : anfrage ? (
              <>
                {anfrage.linkedin_at ? t('card.cvLinkedin') : anfrage.weg === 'einladung' && einladung && !anfrage.reminded_at ? t('card.cvWithInvite') : t('card.cvRequested', { when: vorTagen(anfrage.reminded_at ?? anfrage.sent_at ?? anfrage.created_at) })}
                {email && !erinnert && !(anfrage.weg === 'einladung' && einladung && !anfrage.reminded_at) && <> · <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => void lebenslaufErinnern()}>{t('card.remind')}</button></>}
              </>
            ) : (
              <>
                {t('card.cvMissing')}
                {onLebenslaufAnfragen && <> · <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={onLebenslaufAnfragen}>{t('card.request')}</button></>}
                {onUploadCv && <> · <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={onUploadCv}>{t('card.uploadSelf')}</button></>}
              </>
            )}
          </p>
        )}

        {sources.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border text-xs">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0 truncate">
                  {new Date(s.created_at).toLocaleDateString(locale)} · {KIND_LABEL[s.kind] ? t(`card.kind.${s.kind}`) : s.kind}
                  {s.label && s.label !== KIND_LABEL[s.kind] ? ` · ${term(s.label)}` : ''}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {s.raw_text == null ? t('card.rawDeleted') : s.expires_at ? t('card.rawUntil', { date: new Date(s.expires_at).toLocaleDateString(locale) }) : t('card.rawKept')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <EinladungFenster open={fensterOffen} onOpenChange={setFensterOffen} candidate={{ id: candidateId, vorname, email, hatLebenslauf: !!lebenslauf }} onFertig={() => { void neuLaden(); void anfrageNeu(); notifyTasksChanged(); }}/>
    </Card>
  );
}
