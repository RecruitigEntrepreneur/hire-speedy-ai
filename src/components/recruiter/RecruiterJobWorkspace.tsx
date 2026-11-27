import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Banknote, Building2, Calculator, CalendarRange, Clock, Factory, FileText, Flag, IdCard, Linkedin, ListChecks, Mail, Phone, Plus, Share2, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { HeroEarning } from './JobDecisionStrip';
import { StellenanzeigeAnsicht } from './StellenanzeigeAnsicht';
import { FirmaSheet } from './FirmaSheet';
import { kopfFakten, type KopfSymbol } from '@/lib/stellenKopf';
import { FeeCalculatorCard } from './FeeCalculatorCard';
import { getRecruiterCriteria, type BriefingJob } from '@/lib/recruiterBriefing';
import { buildMandatsBriefing, fragenAnKunden } from '@/lib/mandatsBriefing';
import { buildArbeitsBriefing } from '@/lib/arbeitsBriefing';
import { ContractingKonditionen } from './ContractingKonditionen';
import { buildAnsprache, buildJobPosting, mitAufhaenger, postingAsText } from '@/lib/jobPosting';
import { AnspracheTeilen, type Kanal } from './AnspracheTeilen';
import { ArbeitsBriefingLeiste, ArbeitsBriefingView, WERKZEUG_SYMBOL } from './briefing/ArbeitsBriefingView';
import { GespraechsleitfadenSheet } from './briefing/GespraechsleitfadenSheet';
import { KundenFragenSheet } from './briefing/KundenFragenSheet';
import { FirmenLogo } from '@/components/company/FirmenLogo';
import { useRecruiterKontakt } from '@/hooks/useRecruiterKontakt';
import { useQuery } from '@tanstack/react-query';
import { BeitragsFenster } from './linkedin/BeitragsFenster';
import { ErstgespraecheAbschnitt, useErstgespraeche } from './termin/Erstgespraeche';
import { beitragsStand } from '@/lib/terminApi';
import { useJobTerms } from '@/lib/abrechnungApi';
import { KundeMeldenDialog } from './verdienste/KundeMeldenDialog';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';
import { useToast } from '@/hooks/use-toast';
import { pendingText } from './RecruiterWaiting';
import { useRecruiterPending } from '@/components/verification/RecruiterAccessGate';

export interface WorkspaceJob extends BriefingJob {
  id: string;
  title: string;
  company_name?: string | null;
  /** Wie company_name erst nach dem Reveal befüllt (client_companies.logo_url). */
  company_logo_url?: string | null;
  industry?: string | null;
  location?: string | null;
  remote_type?: string | null;
  experience_level?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  recruiter_fee_percentage?: number | null;
  onsite_required?: boolean | null;
  remote_days_flexible?: boolean | null;
  tech_environment?: string[] | null;
  formatted_content?: {
    role_summary?: string;
    ideal_candidate?: string;
    anonymous_company_pitch?: string;
    highlights?: string[];
    selling_points?: string[];
    urgency_note?: string | null;
  } | null;
}

interface Props {
  job: WorkspaceJob;
  companyRevealed: boolean;
  fullAccess: boolean;
  submissionCount: number;
  candidates: ReactNode;
  onSubmit: () => void;
  onExpose: () => void;
  /** Hauptknopf neben dem Verdienst im Kopf (Ich suche / Vorstellung vorbereiten / Pausiert). */
  heroAction?: ReactNode;
  /** Eine Zeile unter dem Kopf: Stand der Suche, offene Kundenfrage, Pause. */
  heroStatus?: ReactNode;
  /** Ersetzt den Hauptknopf der unteren Leiste am Handy. */
  mobileAction?: ReactNode;
  /** Zusätzlicher Hinweis in der Kopfzeile, etwa „Pausiert bis …“. */
  headerBadge?: ReactNode;
  /** Darf die Stelle gerade auf LinkedIn gepostet werden? (Headhunter sucht, Stelle nicht pausiert) */
  kannPosten?: boolean;
}

function EmptyAnswer({ children }: { children: ReactNode }) {
  return <p className="py-4 text-sm leading-6 text-muted-foreground">{children}</p>;
}

const KOPF_SYMBOL: Record<KopfSymbol, LucideIcon> = {
  geld: Banknote, ort: Building2, zeit: Clock, level: TrendingUp, vertrag: FileText, leute: Users, branche: Factory, laufzeit: CalendarRange,
};

/** Eintrag in der rechten Leiste: blauer Link mit „›“ (24.11.2026); „leise“ = noch nicht verfügbar, „grau“ = seltene Handlung. */
function Kachel({ titel, hinweis, onClick, leise, grau }: { icon?: LucideIcon; titel: string; hinweis?: string; onClick?: () => void; leise?: boolean; grau?: boolean }) {
  return <button type="button" onClick={onClick} disabled={!onClick}
    className={cn('block w-full rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      onClick ? 'hover:bg-muted/60' : 'cursor-default')}>
    <span className={cn('block text-sm leading-5', leise ? 'text-muted-foreground' : grau ? 'text-foreground' : 'font-medium text-klick')}>{titel}{onClick && !grau && ' ›'}</span>
    {hinweis && <span className="block truncate text-[11px] text-muted-foreground">{hinweis}</span>}
  </button>;
}

function Gruppe({ titel, children, tour }: { titel: string; children: ReactNode; tour?: string }) {
  return <div className="space-y-0.5" data-tour={tour}><p className="px-2 pb-1 text-xs text-muted-foreground">{titel}</p>{children}</div>;
}

/** Handy (17.11.2026): Symbol-Knöpfe der unteren Leiste mit kurzem Wort darunter. */
const HANDY_SYMBOL = 'max-sm:h-12 max-sm:min-w-[3.75rem] max-sm:flex-col max-sm:gap-0.5 max-sm:px-2 max-sm:text-[10.5px] max-sm:font-normal';

export function RecruiterJobWorkspace({ job, companyRevealed, fullAccess, submissionCount, candidates, onSubmit, onExpose, heroAction, heroStatus, mobileAction, headerBadge, kannPosten = false }: Props) {
  // Erst die Anzeige, dann das Briefing: so liest ein Headhunter eine neue Stelle.
  const [tab, setTab] = useState('beschreibung');
  // recruiterJobDetail trägt auch die Texte aus lib/arbeitsBriefing (brief.*) und lib/linkedinBeitrag (post.*).
  const { t, i18n } = useTranslation('recruiterJobDetail');
  const locale = intlLocale(i18n.language);
  const [showEarning, setShowEarning] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [fragenOffen, setFragenOffen] = useState(false);
  const [firmaOffen, setFirmaOffen] = useState(false);
  // F2 „Kunde melden“ (Umbau 11.11.2026): anonym gegenüber dem Kunden, danach „Gemeldet am …“
  const [meldenOffen, setMeldenOffen] = useState(false);
  const gemeldetAm = useJobTerms(job.id).data?.reportedAt ?? null;
  const fakten = kopfFakten(job);
  // Die ganze Kandidatenfassung mit „So läuft es ab“ und dem Headhunter als Ansprechperson.
  const kontakt = useRecruiterKontakt();
  const posting = buildJobPosting(job, kontakt);
  const [vorname, setVorname] = useState('');
  const [aufhaenger, setAufhaenger] = useState('');
  const [kanal, setKanal] = useState<Kanal>('linkedin');
  const [teilenOffen, setTeilenOffen] = useState(false);
  // Vertrag noch nicht gegengezeichnet: lesen ja, Kandidaten ansprechen nein. Eine Stelle für alle Wege in dieses Fenster.
  const pending = useRecruiterPending();
  const { toast } = useToast();
  useEffect(() => {
    if (!pending || !teilenOffen) return;
    setTeilenOffen(false);
    toast({ title: pendingText('notYet'), description: pendingText('hint') });
  }, [pending, teilenOffen, toast]);
  const [kopiert, setKopiert] = useState<'ok' | 'fehler' | null>(null);
  const roh = buildAnsprache(job, posting, vorname);
  // Der Aufhänger gilt für LinkedIn und E-Mail; Telefon bleibt Spickzettel.
  const ansprache = { ...roh, linkedin: mitAufhaenger(roh.linkedin, aufhaenger), email: { ...roh.email, text: mitAufhaenger(roh.email.text, aufhaenger) } };
  const hatAnzeige = posting.blocks.length > 0;
  const briefing = useMemo(() => buildMandatsBriefing(job as never, companyRevealed), [job, companyRevealed]);
  // Das Briefing nach den fünf Arbeitsschritten, nur Angaben des Kunden (21.10.2026).
  const schritte = useMemo(() => buildArbeitsBriefing(job as never, companyRevealed), [job, companyRevealed]);
  const offeneFragen = fragenAnKunden(briefing.fehlt).length;
  const [searchParams, setSearchParams] = useSearchParams();
  // LinkedIn-Beitrag (21.10.2026): Fenster, Stand im Kopf, Rückkehr aus der LinkedIn-Anmeldung (?beitrag=1).
  const [beitragOffen, setBeitragOffen] = useState(false);
  const erstgespraeche = useErstgespraeche({ jobId: job.id, kommende: true });
  const beitrag = useQuery({ queryKey: ['beitrag-stand', job.id], staleTime: 60_000, queryFn: () => beitragsStand(job.id) });
  useEffect(() => {
    if (searchParams.get('beitrag') !== '1') return;
    if (kannPosten) setBeitragOffen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('beitrag');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, kannPosten]);

  const ansprechen = (k: Kanal) => { setKanal(k); setTeilenOffen(true); };

  // Aus der Jobliste („Anzeige & Ansprache") oder dem alten Link …/anzeige: ?teilen=1
  useEffect(() => {
    if (searchParams.get('teilen') !== '1') return;
    setTab('beschreibung');
    if (hatAnzeige) setTeilenOffen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('teilen');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anzeigeKopieren = async () => {
    try {
      await navigator.clipboard.writeText(postingAsText(posting));
      setKopiert('ok');
      setTimeout(() => setKopiert(k => (k === 'ok' ? null : k)), 2000);
    } catch {
      setKopiert('fehler');
    }
  };
  const criteria = getRecruiterCriteria(job);
  const screening = Array.isArray(job.screening_questions)
    ? job.screening_questions.filter((item): item is string => typeof item === 'string')
    : job.screening_questions && typeof job.screening_questions === 'object'
      ? Object.values(job.screening_questions).filter((item): item is string => typeof item === 'string')
      : [];
  const zeichen = ansprache.linkedin.length;

  const werkzeuge = <Gruppe titel={t('ws.tools')}>
    {tab !== 'beschreibung' && <Kachel icon={ListChecks} titel={t('ws.guide')} onClick={() => setShowGuide(true)} />}
    <Kachel icon={IdCard} titel={t('ws.expose')} onClick={onExpose} />
    <Kachel icon={Calculator} titel={t('ws.calcEarning')} onClick={() => setShowEarning(true)} />
    {(kannPosten || submissionCount > 0 || gemeldetAm) && <Kachel icon={Flag} grau titel={t('ws.reportClient')}
      hinweis={gemeldetAm ? t('ws.reportedOn', { date: new Date(gemeldetAm).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }) }) : t('ws.reportHint')}
      onClick={() => setMeldenOffen(true)} />}
  </Gruppe>;

  /** Stand der Suche und LinkedIn-Beitrag; unter 1180 px rechts neben den Reitern, darüber oben in der rechten Leiste. */
  const suchStand = (inLeiste: boolean) => (heroStatus || beitrag.data) ? <div className={cn('space-y-0.5 text-xs leading-5 text-muted-foreground', !inLeiste && 'sm:text-right')}>
    {heroStatus && <div>{heroStatus}</div>}
    {beitrag.data && <div className="text-[#0A66C2]">
      <Linkedin className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />{t('ws.postedOn', { date: new Date(beitrag.data.posted_at).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }) })}
      {' · '}{t('ws.bookings', { count: beitrag.data.bookings })}
      {beitrag.data.post_urn && <> · <a className="underline underline-offset-2" href={`https://www.linkedin.com/feed/update/${beitrag.data.post_urn}/`} target="_blank" rel="noreferrer">{t('ws.view')}</a></>}
    </div>}
  </div> : null;

  return <div className="mx-auto max-w-[1440px] space-y-7 pb-24 min-[1180px]:pb-8">
    <Link to="/recruiter/jobs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{t('ws.allJobs')}</Link>

    {/* Kopf: links die Stelle mit den Reitern, rechts Verdienst und nächster Schritt. Die
        Dreier-Leiste darunter ist seit 21.10.2026 weg: Anzeige und Briefing zeigen alles selbst. */}
    <Tabs value={tab} onValueChange={setTab} className="space-y-7">
    <header data-tour="job.head">
      {/* Kopf als graue Karte wie beim Kunden (Entwurf A, 24.11.2026), Reiter unten bündig in der Karte.
          Ab 1180 px ein Raster: links Stelle und darunter gleich die Reiter, rechts über beide Zeilen
          Verdienst und Knöpfe. So entsteht keine Lücke über den Reitern. */}
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5 rounded-xl border bg-card px-5 pt-5 sm:px-6 sm:pt-6 min-[1180px]:grid min-[1180px]:grid-cols-[minmax(0,1fr)_auto] min-[1180px]:grid-rows-[auto_1fr] min-[1180px]:gap-y-4">
        {/* Kopf wie eine klassische Stellenanzeige (Variante A, 21.10.2026): Logo, Titel,
            Firma · Branche · Ort, Fakten als ruhige Textzeile; rechts Verdienst und nächster Schritt. */}
        <div className="min-w-0 flex-1 basis-[26rem] min-[1180px]:col-start-1 min-[1180px]:row-start-1">
          <div className="flex items-start gap-4">
            {/* Bild nur mit echtem Logo einer offengelegten Firma, kein Platzhalter (24.11.2026) */}
            {companyRevealed && job.company_name && job.company_logo_url && <FirmenLogo url={job.company_logo_url} name={job.company_name} size={56} />}
            <div className="min-w-0 space-y-1.5">
              <h1 className="max-w-4xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{job.title}</h1>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                {/* Ohne Offenlegung nur Branche und Ort, kein „Vertrauliches Unternehmen“ (24.11.2026) */}
                {[
                  companyRevealed && job.company_name ? <span key="firma"><button type="button" onClick={() => setFirmaOffen(true)} className="font-medium text-foreground underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{job.company_name}</button></span> : null,
                  job.industry ? <span key="branche">{job.industry}</span> : null,
                  job.location ? <span key="ort">{job.location}</span> : null,
                ].filter(Boolean).flatMap((el, i) => (i ? [<span key={`p${i}`} aria-hidden="true">·</span>, el] : [el]))}
                <span aria-hidden="true">·</span>
                <button type="button" onClick={() => setShowAccess(true)} aria-label={t('ws.accessAria')}
                  className="rounded text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {fullAccess ? t('ws.badge.full') : companyRevealed ? t('ws.badge.revealed') : t('ws.badge.anonymous')}
                </button>
                {headerBadge}
              </p>
            </div>
          </div>
          {fakten.length > 0 && <ul className="mt-4 flex flex-wrap gap-x-1.5 gap-y-1.5 text-sm [&>li+li]:before:mr-1.5 [&>li+li]:before:text-muted-foreground [&>li+li]:before:content-['·']" aria-label={t('ws.keyFacts')}>
            {fakten.filter(f => f.symbol !== 'branche').map(f => { const Icon = KOPF_SYMBOL[f.symbol]; return <li key={f.symbol} className={cn('inline-flex items-center gap-1.5', f.symbol === 'geld' && 'font-medium', !Icon && 'hidden')}>{f.text}</li>; })}
          </ul>}
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[15rem] min-[1180px]:col-start-2 min-[1180px]:row-span-2 min-[1180px]:row-start-1 min-[1180px]:pb-6">
          <div data-tour="job.earning"><HeroEarning job={job} onDetails={() => setShowEarning(true)} /></div>
          {/* Unter 1180 px steht der Knopf in der Leiste unten, nicht doppelt. */}
          <div className="hidden gap-2 min-[1180px]:flex">
            <div className="min-w-0 flex-1 [&_button]:w-full">{heroAction ?? <Button size="lg" onClick={onSubmit}>{t('ws.prepare')}</Button>}</div>
            {kannPosten && <Button size="lg" aria-label={t('ws.postAnonymousAria')} className="w-auto shrink-0 bg-[#0A66C2] px-3.5 text-white hover:bg-[#004182]" onClick={() => setBeitragOffen(true)}><Linkedin />{t('ws.post')}</Button>}
          </div>
        </div>
      {/* Reiter mit Unterstrich auf der Unterkante der Karte (wie beim Kunden); unter 1180 px rechts daneben der Stand der Suche. */}
      <div className="flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-2 min-[1180px]:col-start-1 min-[1180px]:row-start-2 min-[1180px]:w-auto min-[1180px]:self-end">
        <TabsList className="-mb-px h-auto flex-nowrap justify-start gap-5 rounded-none bg-transparent p-0 sm:gap-6">
          {([['beschreibung', t('ws.tabs.ad'), t('ws.tabs.adShort')], ['briefing', t('ws.tabs.briefing'), t('ws.tabs.briefing')], ['kandidaten', t('ws.tabs.candidates'), t('ws.tabs.candidatesShort')]] as const).map(([wert, label, kurz]) =>
            <TabsTrigger key={wert} value={wert} data-tour={wert === 'beschreibung' ? 'job.tab.ad' : wert === 'briefing' ? 'job.tab.briefing' : undefined} className="gap-1.5 rounded-none border-b-2 border-transparent px-0 pb-3 pt-1 text-sm text-muted-foreground shadow-none hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:font-medium data-[state=active]:text-foreground data-[state=active]:shadow-none">
              <span className="sm:hidden">{kurz}</span><span className="hidden sm:inline">{label}</span>{wert === 'kandidaten' && <span className="font-normal tabular-nums text-muted-foreground">{submissionCount}</span>}
            </TabsTrigger>)}
        </TabsList>
        {/* Am Handy über den Reitern; ab 1180 px steht er oben in der rechten Leiste. */}
        {suchStand(false) && <div className="order-first w-full pb-1 sm:order-none sm:w-auto sm:pb-3 min-[1180px]:hidden">{suchStand(false)}</div>}
      </div>
      </div>
    </header>

      <div className="grid items-start gap-8 min-[1180px]:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          {/* Die Anzeige allein in der Mitte (21.10.2026), seit 23.11.2026 in einer Karte; Ansprache und Werkzeuge rechts. */}
          <TabsContent value="beschreibung" className="m-0 rounded-[20px] border bg-card p-5 sm:p-7">
            {hatAnzeige ? <div className="space-y-8">
              <StellenanzeigeAnsicht posting={posting} />
              <p className="max-w-[42rem] border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
                <span>
                  {(job.formatted_content as { anzeige?: unknown } | null)?.anzeige
                    ? t('ws.adNoteAi')
                    : t('ws.adNoteGenerated')}
                  {' '}{t('ws.adNoteShow')}
                </span>
              </p>
            </div>
              : <EmptyAnswer>{t('ws.noAd')}</EmptyAnswer>}
            {/* Contracting: Projektkonditionen offen auf der Stelle, nicht nur hinter „Verdienst berechnen“ (Etappe 1, 04.11.2026) */}
            {job.employment_type === 'freelance' && <div className="mt-8 max-w-[42rem]"><ContractingKonditionen job={job} /></div>}
          </TabsContent>

          <TabsContent value="briefing" className="m-0 rounded-[20px] border bg-card p-5 sm:p-7">
            <ArbeitsBriefingView schritte={schritte} werkzeuge={{
              lohnt: { label: t('ws.calcEarning'), icon: WERKZEUG_SYMBOL.verdienst, onClick: () => setShowEarning(true) },
              suche: { label: t('ws.expose'), icon: WERKZEUG_SYMBOL.expose, onClick: onExpose },
              ueberzeugen: hatAnzeige ? { label: t('ws.writeOutreach'), icon: WERKZEUG_SYMBOL.ansprache, onClick: () => { setTab('beschreibung'); setTeilenOffen(true); } } : undefined,
              gespraech: { label: t('ws.guide'), icon: WERKZEUG_SYMBOL.leitfaden, onClick: () => setShowGuide(true) },
              abschluss: { label: t('ws.prepare'), icon: WERKZEUG_SYMBOL.vorstellen, onClick: onSubmit },
            }} />
          </TabsContent>

          <TabsContent value="kandidaten" className="m-0 space-y-6">
            <div><h2 className="text-[17px] font-semibold tracking-tight">{t('ws.candidatesTitle')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('ws.candidatesText')}</p></div>
            {/* Erstgespräche über die Terminseite, bevor eingereicht wird (21.10.2026) */}
            <ErstgespraecheAbschnitt liste={erstgespraeche.data ?? []} ohneStelle />
            {submissionCount > 0 ? candidates : <div className="rounded-xl border bg-card px-6 py-14 text-center"><h3 className="text-[15px] font-semibold tracking-tight">{t('ws.firstTitle')}</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t('ws.firstText')}</p><Button className="mt-6 rounded-full px-5" onClick={onSubmit}>{t('ws.prepare')}</Button></div>}
          </TabsContent>
        </div>

        <aside aria-label={t('ws.toolsAria')} className="space-y-5 rounded-[20px] border bg-card p-3 pb-4 min-[1180px]:sticky min-[1180px]:top-24">
          {/* Stand der Suche oben in der Leiste, damit er den Kopf nicht verlängert (23.11.2026). */}
          {suchStand(true) && <div className="hidden px-2 min-[1180px]:block [&_span]:!justify-start">{suchStand(true)}</div>}
          {tab === 'beschreibung' && hatAnzeige && <>
            <Gruppe titel={t('ws.approach')} tour="job.approach">
              <Kachel icon={Linkedin} titel="LinkedIn" hinweis={t('ws.charsOf300', { count: zeichen })} onClick={() => ansprechen('linkedin')} />
              <Kachel icon={Mail} titel={t('ws.email')} hinweis={t('ws.emailHint')} onClick={() => ansprechen('email')} />
              <Kachel icon={Phone} titel={t('ws.phone')} hinweis={t('ws.phoneHint')} onClick={() => ansprechen('telefon')} />
            </Gruppe>
            <Gruppe titel={t('ws.share')}>
              <button type="button" onClick={() => void anzeigeKopieren()} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-5 text-klick">{kopiert === 'ok' ? t('ws.copied') : `${t('ws.copyAd')} ›`}</span><span className="block text-[11px] text-muted-foreground">{t('ws.copyHint')}</span></span>
              </button>
              {kopiert === 'fehler' && <p role="alert" className="text-xs text-muted-foreground">{t('ws.copyFailed')}</p>}
              <Kachel icon={FileText} titel="One-Pager" hinweis={t('ws.onePagerHint')} leise />
            </Gruppe>
          </>}
          {tab === 'briefing' && <ArbeitsBriefingLeiste offen={offeneFragen} revealed={companyRevealed} onKundenFragen={() => setFragenOffen(true)} />}
          {/* Im Briefing hängen die Werkzeuge am jeweiligen Schritt. */}
          {tab !== 'briefing' && werkzeuge}
          <button className="px-2 text-left text-xs leading-5 text-muted-foreground hover:text-foreground" onClick={() => setShowAccess(true)}><span>{companyRevealed ? t('ws.companyReleased') : t('ws.companyOnSearch')}</span></button>
        </aside>
      </div>
    </Tabs>

    <div className="fixed inset-x-0 bottom-[var(--handy-leiste,0px)] z-40 flex gap-2 border-t border-border bg-background p-3 max-sm:[&>*]:h-12 md:left-64 md:pb-[max(12px,env(safe-area-inset-bottom))] min-[1180px]:hidden">{mobileAction ?? <Button className="min-w-0 flex-1 max-sm:h-12" onClick={onSubmit}><Plus />{t('ws.prepare')}</Button>}{kannPosten && <Button aria-label={t('ws.postAria')} className={cn('bg-[#0A66C2] px-3 text-white hover:bg-[#004182]', HANDY_SYMBOL)} onClick={() => setBeitragOffen(true)}><Linkedin /><span className="sm:hidden">LinkedIn</span></Button>}{hatAnzeige && <Button variant="outline" aria-label={t('ws.approach')} className={HANDY_SYMBOL} onClick={() => setTeilenOffen(true)}><Share2 /><span>{t('ws.approach')}</span></Button>}<Button variant="outline" aria-label={t('ws.openExpose')} className={HANDY_SYMBOL} onClick={onExpose}><FileText /><span className="sm:hidden">{t('ws.exposeShort')}</span></Button></div>

    {/* Ansprechen als Fenster von rechts; die Anzeige bleibt daneben lesbar. Am Handy über die ganze Breite. */}
    <Sheet open={teilenOffen} onOpenChange={setTeilenOffen}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>{t('ws.approachTitle')}</SheetTitle><SheetDescription>{t('ws.approachText')}</SheetDescription></SheetHeader>
        <div className="mt-5"><AnspracheTeilen ansprache={ansprache} vorname={vorname} onVorname={setVorname} aufhaenger={aufhaenger} onAufhaenger={setAufhaenger} kanal={kanal} onKanal={setKanal} /></div>
      </SheetContent>
    </Sheet>
    {companyRevealed && <FirmaSheet open={firmaOffen} onOpenChange={setFirmaOffen} job={job} />}
    <KundenFragenSheet open={fragenOffen} onOpenChange={setFragenOffen} jobId={job.id} jobTitle={job.title} fehlt={briefing.fehlt} />

    <GespraechsleitfadenSheet open={showGuide} onOpenChange={setShowGuide} jobTitle={job.title} anruf={briefing.anruf} muss={criteria.required} hinterlegt={screening} />
    {kannPosten && <BeitragsFenster open={beitragOffen} onOpenChange={setBeitragOffen} job={job} />}
    <KundeMeldenDialog open={meldenOffen} onOpenChange={setMeldenOffen} jobId={job.id} jobTitle={job.title} />
    <Dialog open={showAccess} onOpenChange={setShowAccess}><DialogContent><DialogHeader><DialogTitle>{t('ws.access.title')}</DialogTitle><DialogDescription>{t('ws.access.text')}</DialogDescription></DialogHeader><ol className="list-decimal space-y-4 pl-5 text-sm leading-7"><li>{t('ws.access.step1')}</li><li>{t('ws.access.step2')}</li><li>{t('ws.access.step3')}</li></ol><p className="text-sm text-muted-foreground">{t('ws.access.status', { status: fullAccess ? t('ws.access.full') : companyRevealed ? t('ws.access.revealed') : t('ws.access.anonymous') })} </p></DialogContent></Dialog>
    <Dialog open={showEarning} onOpenChange={setShowEarning}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{t('ws.calcEarning')}</DialogTitle><DialogDescription>{t('ws.calcText', { title: job.title })}</DialogDescription></DialogHeader>{job.employment_type === 'freelance' ? <ContractingKonditionen job={job} /> : <FeeCalculatorCard jobId={job.id} feePercentage={job.recruiter_fee_percentage ?? null} salaryMin={job.salary_min ?? null} salaryMax={job.salary_max ?? null} />}</DialogContent></Dialog>
  </div>;
}
