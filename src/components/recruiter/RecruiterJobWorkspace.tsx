import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Banknote, Building2, Calculator, CalendarRange, Check, ChevronRight, ClipboardList, Clock, Copy, Eye, Factory, FileText, IdCard, Linkedin, ListChecks, LockKeyhole, LockKeyholeOpen, Mail, Megaphone, Phone, Plus, Share2, TrendingUp, Users, type LucideIcon } from 'lucide-react';
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
}

function EmptyAnswer({ children }: { children: ReactNode }) {
  return <p className="py-4 text-sm leading-6 text-muted-foreground">{children}</p>;
}

const KOPF_SYMBOL: Record<KopfSymbol, LucideIcon> = {
  geld: Banknote, ort: Building2, zeit: Clock, level: TrendingUp, vertrag: FileText, leute: Users, branche: Factory, laufzeit: CalendarRange,
};

/** Eintrag in der rechten Leiste: ruhige Zeile ohne Rahmen, Fläche erst beim Darüberfahren (21.10.2026). */
function Kachel({ icon: Icon, titel, hinweis, onClick, leise }: { icon: LucideIcon; titel: string; hinweis?: string; onClick?: () => void; leise?: boolean }) {
  return <button type="button" onClick={onClick} disabled={!onClick}
    className={cn('group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      onClick ? 'hover:bg-muted/60' : 'cursor-default', leise && 'opacity-55')}>
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted"><Icon className="h-4 w-4" aria-hidden="true" /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-5">{titel}</span>{hinweis && <span className="block truncate text-[11px] text-muted-foreground">{hinweis}</span>}</span>
    {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" aria-hidden="true" />}
  </button>;
}

function Gruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return <div className="space-y-0.5"><p className="px-2 pb-1 text-xs text-muted-foreground">{titel}</p>{children}</div>;
}

export function RecruiterJobWorkspace({ job, companyRevealed, fullAccess, submissionCount, candidates, onSubmit, onExpose, heroAction, heroStatus, mobileAction, headerBadge }: Props) {
  // Erst die Anzeige, dann das Briefing: so liest ein Headhunter eine neue Stelle.
  const [tab, setTab] = useState('beschreibung');
  const [showEarning, setShowEarning] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [fragenOffen, setFragenOffen] = useState(false);
  const [firmaOffen, setFirmaOffen] = useState(false);
  const fakten = kopfFakten(job);
  // Die ganze Kandidatenfassung mit „So läuft es ab“ und dem Headhunter als Ansprechperson.
  const kontakt = useRecruiterKontakt();
  const posting = buildJobPosting(job, kontakt);
  const [vorname, setVorname] = useState('');
  const [aufhaenger, setAufhaenger] = useState('');
  const [kanal, setKanal] = useState<Kanal>('linkedin');
  const [teilenOffen, setTeilenOffen] = useState(false);
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

  const werkzeuge = <Gruppe titel="Werkzeuge">
    {tab === 'kandidaten' && hatAnzeige && <Kachel icon={Megaphone} titel="Anzeige & Ansprache" onClick={() => setTab('beschreibung')} />}
    {tab !== 'beschreibung' && <Kachel icon={ListChecks} titel="Gesprächsleitfaden" onClick={() => setShowGuide(true)} />}
    <Kachel icon={IdCard} titel="Anonymes Exposé" onClick={onExpose} />
    <Kachel icon={Calculator} titel="Verdienst berechnen" onClick={() => setShowEarning(true)} />
  </Gruppe>;

  return <div className="mx-auto max-w-[1440px] space-y-7 pb-24 min-[1180px]:pb-8">
    <Link to="/recruiter/jobs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Alle offenen Jobs</Link>

    {/* Kopf: links die Stelle mit den Reitern, rechts Verdienst und nächster Schritt. Die
        Dreier-Leiste darunter ist seit 21.10.2026 weg: Anzeige und Briefing zeigen alles selbst. */}
    <Tabs value={tab} onValueChange={setTab} className="space-y-7">
    <header>
      <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
        {/* Kopf wie eine klassische Stellenanzeige (Variante A, 21.10.2026): Logo, Titel,
            Firma · Branche · Ort, Fakten als ruhige Textzeile; rechts Verdienst und nächster Schritt. */}
        <div className="min-w-0 flex-1 basis-[26rem]">
          <div className="flex items-start gap-4">
            {companyRevealed && job.company_name
              ? <FirmenLogo url={job.company_logo_url} name={job.company_name} size={56} />
              : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted"><Building2 className="h-6 w-6 text-muted-foreground" /></span>}
            <div className="min-w-0 space-y-1.5">
              <h1 className="max-w-4xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{job.title}</h1>
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
                {companyRevealed && job.company_name
                  ? <button type="button" onClick={() => setFirmaOffen(true)} className="font-medium text-foreground underline decoration-muted-foreground/50 decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{job.company_name}</button>
                  : <span>Vertrauliches Unternehmen</span>}
                {job.industry && <><span aria-hidden="true">·</span><span>{job.industry}</span></>}
                {job.location && <><span aria-hidden="true">·</span><span>{job.location}</span></>}
                <button type="button" onClick={() => setShowAccess(true)} aria-label="Informationen zur Unternehmensfreigabe"
                  className={cn('ml-2 inline-flex items-center gap-1 rounded text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', companyRevealed || fullAccess ? 'text-emerald-600' : 'text-muted-foreground')}>
                  {fullAccess ? <><Eye className="h-3.5 w-3.5" />voller Zugriff</> : companyRevealed ? <><LockKeyholeOpen className="h-3.5 w-3.5" />freigegeben</> : <><LockKeyhole className="h-3.5 w-3.5" />anonym</>}
                </button>
                {headerBadge}
              </p>
            </div>
          </div>
          {fakten.length > 0 && <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm" aria-label="Eckdaten">
            {fakten.filter(f => f.symbol !== 'branche').map(f => { const Icon = KOPF_SYMBOL[f.symbol]; return <li key={f.symbol} className={cn('inline-flex items-center gap-1.5', f.symbol === 'geld' && 'font-medium')}><Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />{f.text}</li>; })}
          </ul>}
        </div>
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[15rem] [&_button]:w-full">
          <HeroEarning job={job} />
          {/* Unter 1180 px steht der Knopf in der Leiste unten, nicht doppelt. */}
          <div className="hidden min-[1180px]:block">{heroAction ?? <Button size="lg" onClick={onSubmit}><Plus />Vorstellung vorbereiten</Button>}</div>
        </div>
      </div>
      {/* Reiter als Unterstreichung, rechts der Stand der Suche. */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-border">
        <TabsList className="-mb-px h-auto flex-nowrap justify-start gap-5 rounded-none bg-transparent p-0 sm:gap-6">
          {([['beschreibung', Megaphone, 'Anzeige & Ansprache', 'Anzeige'], ['briefing', ClipboardList, 'Briefing', 'Briefing'], ['kandidaten', Users, 'Meine Kandidaten', 'Kandidaten']] as const).map(([wert, Icon, label, kurz]) =>
            <TabsTrigger key={wert} value={wert} className="gap-2 rounded-none border-b-2 border-transparent px-0 pb-3 pt-1 text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none">
              <Icon className="h-4 w-4" /><span className="sm:hidden">{kurz}</span><span className="hidden sm:inline">{label}</span>{wert === 'kandidaten' && <span className="rounded bg-muted px-1.5 text-xs tabular-nums">{submissionCount}</span>}
            </TabsTrigger>)}
        </TabsList>
        {/* Am Handy über den Reitern, damit die Unterstreichung auf der Linie sitzt. */}
        {heroStatus && <div className="order-first w-full pb-1 text-xs leading-5 text-muted-foreground sm:order-none sm:w-auto sm:pb-3 sm:text-right">{heroStatus}</div>}
      </div>
    </header>

      <div className="grid items-start gap-8 min-[1180px]:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">
          {/* Die Anzeige allein in der Mitte (21.10.2026); Ansprache und Werkzeuge rechts als Kacheln. */}
          <TabsContent value="beschreibung" className="m-0">
            {hatAnzeige ? <div className="space-y-8">
              <StellenanzeigeAnsicht posting={posting} />
              <p className="flex max-w-[42rem] items-start gap-2 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
                <LockKeyhole className="mt-1 h-3.5 w-3.5 shrink-0" />
                <span>
                  {(job.formatted_content as { anzeige?: unknown } | null)?.anzeige
                    ? 'Texte von der KI aus den Angaben des Kunden formuliert und gegen sie geprüft, Beträge vom System eingesetzt. '
                    : 'Aus den Angaben des Kunden erzeugt, ohne interne Notizen. '}
                  Diese Fassung kannst du einem Kandidaten zeigen. Was du als Recruiter zusätzlich weißt, steht im Reiter Briefing.
                </span>
              </p>
            </div>
              : <EmptyAnswer>Für diese Stelle gibt es noch keine Anzeige. Alle Angaben des Kunden stehen im Briefing.</EmptyAnswer>}
          </TabsContent>

          <TabsContent value="briefing" className="m-0">
            <ArbeitsBriefingView schritte={schritte} werkzeuge={{
              lohnt: { label: 'Verdienst berechnen', icon: WERKZEUG_SYMBOL.verdienst, onClick: () => setShowEarning(true) },
              suche: { label: 'Anonymes Exposé', icon: WERKZEUG_SYMBOL.expose, onClick: onExpose },
              ueberzeugen: hatAnzeige ? { label: 'Ansprache schreiben', icon: WERKZEUG_SYMBOL.ansprache, onClick: () => { setTab('beschreibung'); setTeilenOffen(true); } } : undefined,
              gespraech: { label: 'Gesprächsleitfaden', icon: WERKZEUG_SYMBOL.leitfaden, onClick: () => setShowGuide(true) },
              abschluss: { label: 'Vorstellung vorbereiten', icon: WERKZEUG_SYMBOL.vorstellen, onClick: onSubmit },
            }} />
          </TabsContent>

          <TabsContent value="kandidaten" className="m-0 space-y-6">
            <div><h2 className="text-xl font-semibold">Deine Kandidaten für dieses Mandat</h2><p className="mt-2 text-sm text-muted-foreground">Einreichungen, aktueller Stand und die nächsten Schritte.</p></div>
            {submissionCount > 0 ? candidates : <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"><Users className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h3 className="font-medium">Deine erste Vorstellung beginnt hier</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Wähle ein vorhandenes Profil oder lege einen Kandidaten an. Vor dem Einreichen prüfst du die Angaben.</p><Button className="mt-6" onClick={onSubmit}><Plus />Vorstellung vorbereiten</Button></div>}
          </TabsContent>
        </div>

        <aside aria-label="Werkzeuge zum Mandat" className="space-y-5 min-[1180px]:sticky min-[1180px]:top-24 min-[1180px]:border-l min-[1180px]:border-border min-[1180px]:pl-6">
          {tab === 'beschreibung' && hatAnzeige && <>
            <Gruppe titel="Ansprechen">
              <Kachel icon={Linkedin} titel="LinkedIn" hinweis={`${zeichen} von 300 Zeichen`} onClick={() => ansprechen('linkedin')} />
              <Kachel icon={Mail} titel="E-Mail" hinweis="mit Betreff und Anzeige" onClick={() => ansprechen('email')} />
              <Kachel icon={Phone} titel="Telefon" hinweis="Einstieg, Argumente, Fragen" onClick={() => ansprechen('telefon')} />
            </Gruppe>
            <Gruppe titel="Teilen">
              <button type="button" onClick={() => void anzeigeKopieren()} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">{kopiert === 'ok' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium leading-5">{kopiert === 'ok' ? 'Kopiert' : 'Anzeige kopieren'}</span><span className="block text-[11px] text-muted-foreground">sofort, als Text</span></span>
              </button>
              {kopiert === 'fehler' && <p role="alert" className="text-xs text-muted-foreground">Kopieren nicht möglich. Bitte den Text markieren und kopieren.</p>}
              <Kachel icon={FileText} titel="One-Pager" hinweis="PDF oder Link · kommt bald" leise />
            </Gruppe>
          </>}
          {tab === 'briefing' && <ArbeitsBriefingLeiste offen={offeneFragen} revealed={companyRevealed} onKundenFragen={() => setFragenOffen(true)} />}
          {/* Im Briefing hängen die Werkzeuge am jeweiligen Schritt. */}
          {tab !== 'briefing' && werkzeuge}
          <button className="flex items-start gap-2 text-left text-xs leading-6 text-muted-foreground hover:text-foreground" onClick={() => setShowAccess(true)}><LockKeyhole className="mt-1 h-4 w-4 shrink-0" /><span>{companyRevealed ? 'Unternehmensdaten sind für dich freigegeben.' : 'Der Firmenname erscheint, sobald du „Ich suche“ drückst.'}</span></button>
        </aside>
      </div>
    </Tabs>

    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-background p-3 pb-[max(12px,env(safe-area-inset-bottom))] md:left-64 min-[1180px]:hidden">{mobileAction ?? <Button className="min-w-0 flex-1" onClick={onSubmit}><Plus />Vorstellung vorbereiten</Button>}{hatAnzeige && <Button variant="outline" aria-label="Ansprechen" onClick={() => setTeilenOffen(true)}><Share2 /><span className="hidden min-[420px]:inline">Ansprechen</span></Button>}<Button variant="outline" aria-label="Anonymes Exposé öffnen" onClick={onExpose}><FileText /></Button></div>

    {/* Ansprechen als Fenster von rechts; die Anzeige bleibt daneben lesbar. Am Handy über die ganze Breite. */}
    <Sheet open={teilenOffen} onOpenChange={setTeilenOffen}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>Kandidaten ansprechen</SheetTitle><SheetDescription>Ohne Firmennamen und Honorar. Vorname und Aufhänger gelten für LinkedIn und E-Mail.</SheetDescription></SheetHeader>
        <div className="mt-5"><AnspracheTeilen ansprache={ansprache} vorname={vorname} onVorname={setVorname} aufhaenger={aufhaenger} onAufhaenger={setAufhaenger} kanal={kanal} onKanal={setKanal} /></div>
      </SheetContent>
    </Sheet>
    {companyRevealed && <FirmaSheet open={firmaOffen} onOpenChange={setFirmaOffen} job={job} />}
    <KundenFragenSheet open={fragenOffen} onOpenChange={setFragenOffen} jobId={job.id} jobTitle={job.title} fehlt={briefing.fehlt} />

    <GespraechsleitfadenSheet open={showGuide} onOpenChange={setShowGuide} jobTitle={job.title} anruf={briefing.anruf} muss={criteria.required} hinterlegt={screening} />
    <Dialog open={showAccess} onOpenChange={setShowAccess}><DialogContent><DialogHeader><DialogTitle>Unternehmensfreigabe</DialogTitle><DialogDescription>Die vorhandenen Freigabestufen dieses Mandats.</DialogDescription></DialogHeader><ol className="list-decimal space-y-4 pl-5 text-sm leading-7"><li>Anonyme Stellenbeschreibung und Briefing für die erste Einschätzung.</li><li>Der Firmenname erscheint, sobald du „Ich suche“ drückst. Der Kunde sieht dann auch dich.</li><li>Nach Interviewbestätigung werden weitere Firmeninformationen zugänglich.</li></ol><p className="text-sm text-muted-foreground">Aktueller Status: {fullAccess ? 'Voller Zugriff' : companyRevealed ? 'Firma freigegeben' : 'Firma anonym'}. </p></DialogContent></Dialog>
    <Dialog open={showEarning} onOpenChange={setShowEarning}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Verdienst berechnen</DialogTitle><DialogDescription>{job.title} · so rechnet sich deine Provision.</DialogDescription></DialogHeader>{job.employment_type === 'freelance' ? <ContractingKonditionen job={job} /> : <FeeCalculatorCard feePercentage={job.recruiter_fee_percentage ?? null} salaryMin={job.salary_min ?? null} salaryMax={job.salary_max ?? null} />}</DialogContent></Dialog>
  </div>;
}
