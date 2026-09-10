import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Building2, Check, CheckCheck, ChevronDown, ClipboardList, Copy, FileText, HelpCircle, ListChecks, LockKeyhole, MapPin, MessageSquareText, Plus, Target, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { JobFactsBar } from './JobFactsBar';
import { FeeCalculatorCard } from './FeeCalculatorCard';
import { CompanyRevealBadge } from './CompanyRevealBadge';
import { buildBriefingSections, getRecruiterCriteria, narrativeAnswer, type BriefingJob, type BriefingRow } from '@/lib/recruiterBriefing';

export interface WorkspaceJob extends BriefingJob {
  id: string;
  title: string;
  company_name?: string | null;
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
}

const SECTION_LABELS: Record<string, string> = {
  profil: 'Suchprofil', aufgabe: 'Aufgabe', angebot: 'Angebot', unternehmen: 'Unternehmen', prozess: 'Prozess',
};
const CRITERIA_KEYS = new Set(['must_have_criteria', 'trainable_skills', 'nice_to_have_criteria', 'must_haves', 'nice_to_haves']);
const EMPLOYMENT: Record<string, string> = { 'full-time': 'Vollzeit', full_time: 'Vollzeit', 'part-time': 'Teilzeit', part_time: 'Teilzeit', freelance: 'Freelance', contract: 'Projektvertrag', temporary: 'Befristet', internship: 'Praktikum' };
const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function Source({ source }: { source: BriefingRow['source'] }) {
  return <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground"><FileText className="h-3 w-3" aria-hidden="true" />{source === 'intake' ? 'Aufnahmefeld' : 'Stellendaten'}</span>;
}

function Answer({ row }: { row: BriefingRow }) {
  return <div className="grid gap-2 border-b border-border/50 py-4 last:border-0 sm:grid-cols-[minmax(120px,0.8fr)_minmax(0,2fr)] sm:gap-6">
    <dt className="space-y-1"><span className="block text-sm text-muted-foreground">{row.label}</span><Source source={row.source} /></dt>
    <dd className="min-w-0 whitespace-pre-line break-words text-sm leading-7">{row.value}</dd>
  </div>;
}

function EmptyAnswer({ children }: { children: ReactNode }) {
  return <p className="flex items-start gap-2 py-4 text-sm leading-6 text-muted-foreground"><HelpCircle className="mt-1 h-4 w-4 shrink-0" />{children}</p>;
}

export function RecruiterJobWorkspace({ job, companyRevealed, fullAccess, submissionCount, candidates, onSubmit, onExpose }: Props) {
  const [tab, setTab] = useState('briefing');
  const [showGuide, setShowGuide] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const sections = buildBriefingSections(job);
  const criteria = getRecruiterCriteria(job);
  const answers = sections.flatMap(section => section.rows);
  const intakeCount = answers.filter(row => row.source === 'intake').length;
  const hasCriteria = criteria.required.length + criteria.trainable.length + criteria.negotiable.length > 0;
  const [questionDraft, setQuestionDraft] = useState(() => [
    `Rückfragen zur Position: ${job.title}`,
    '',
    ...getRecruiterCriteria(job).required.map(value => `• ${value}: Welche konkrete Erfahrung und Verantwortung wird erwartet?`),
    ...(!narrativeAnswer(job, 'deliverable_90d') ? ['• Welche Ergebnisse werden in den ersten 90 Tagen erwartet?'] : []),
    ...(!narrativeAnswer(job, 'interview_process') ? ['• Welche Gesprächsstufen und Feedbackfristen sind vereinbart?'] : []),
    ...(job.salary_months || job.bonus_structure ? ['• Was umfasst das angegebene Gehaltsband: Fixgehalt, zusätzliche Monatsgehälter und Bonus?'] : []),
    '',
    'Vor dem Versenden mit den bereits vorliegenden Antworten abgleichen.',
  ].join('\n'));

  const copyQuestions = async () => {
    try {
      await navigator.clipboard.writeText(questionDraft);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  const goToSources = () => setTab('quellen');
  const screening = Array.isArray(job.screening_questions)
    ? job.screening_questions.filter((item): item is string => typeof item === 'string')
    : job.screening_questions && typeof job.screening_questions === 'object'
      ? Object.values(job.screening_questions).filter((item): item is string => typeof item === 'string')
      : [];

  return <div className="mx-auto max-w-[1440px] space-y-7 pb-24 min-[1180px]:pb-8">
    <Link to="/recruiter/jobs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Alle offenen Jobs</Link>

    <header className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Dein Mandatsbriefing</span>
        {intakeCount > 0 && <button className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs hover:bg-accent" onClick={goToSources}><ClipboardList className="h-3.5 w-3.5" />{intakeCount} Angaben aus Aufnahmefeldern<ArrowUpRight className="h-3 w-3" /></button>}
      </div>
      <h1 className="max-w-4xl text-2xl font-semibold leading-tight tracking-tight sm:text-3xl xl:text-4xl">{job.title}</h1>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4" />{companyRevealed ? job.company_name || 'Unternehmen freigegeben' : job.industry || 'Vertrauliches Unternehmen'}{job.company_size_band && ` · ${job.company_size_band}`}</span>
        <button onClick={() => setShowAccess(true)} className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" aria-label="Informationen zur Unternehmensfreigabe"><CompanyRevealBadge companyRevealed={companyRevealed} fullAccess={fullAccess} /></button>
        {job.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{job.location}</span>}
        {job.employment_type && <span>{EMPLOYMENT[job.employment_type] || job.employment_type}</span>}
      </div>
      <JobFactsBar facts={{ salaryMin: job.salary_min ?? null, salaryMax: job.salary_max ?? null, dayRateMin: job.employment_type === 'freelance' ? job.day_rate_min : null, dayRateMax: job.employment_type === 'freelance' ? job.day_rate_max : null, onsiteRequired: job.onsite_required, onsiteDaysRequired: job.onsite_days_required, remoteDaysFlexible: job.remote_days_flexible, remotePolicy: job.remote_policy, remoteType: job.remote_type, requiredLanguages: job.required_languages, experienceLevel: job.experience_level, deadline: job.deadline }} />
    </header>

    <Tabs value={tab} onValueChange={setTab} className="space-y-0">
      <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-none border-b bg-transparent p-0 pb-3">
        <TabsTrigger value="briefing" className="gap-2 rounded-md px-4 py-2.5 data-[state=active]:bg-secondary"><ClipboardList className="h-4 w-4" />Briefing</TabsTrigger>
        <TabsTrigger value="kandidaten" className="gap-2 rounded-md px-4 py-2.5 data-[state=active]:bg-secondary"><Users className="h-4 w-4" />Meine Kandidaten <span className="rounded bg-muted px-1.5 text-xs tabular-nums">{submissionCount}</span></TabsTrigger>
        <TabsTrigger value="quellen" className="gap-2 rounded-md px-4 py-2.5 data-[state=active]:bg-secondary"><FileText className="h-4 w-4" />Quellen & Rückfragen</TabsTrigger>
      </TabsList>

      <div className="grid items-start gap-8 pt-6 min-[1180px]:grid-cols-[minmax(0,1fr)_270px]">
        <div className="min-w-0">
          <TabsContent value="briefing" className="m-0 space-y-7">
            <nav aria-label="Abschnitte im Briefing" className="sticky top-16 z-20 -mx-1 flex flex-wrap gap-x-1 gap-y-1 border-b bg-background/95 px-1 py-3 backdrop-blur-sm">
              {sections.map((section, index) => <a key={section.id} href={`#briefing-${section.id}`} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"><span className="opacity-60">0{index + 1}</span>{SECTION_LABELS[section.id]}</a>)}
            </nav>
            {!intakeCount && <div className="rounded-lg border border-border bg-card p-4 text-sm leading-6 text-muted-foreground">Für diese Stelle sind derzeit keine ausgefüllten Aufnahmefelder verfügbar. Vorhandene Stellendaten bleiben sichtbar; ihre Bestätigung durch den Kunden ist hier nicht dokumentiert.</div>}

            {sections.map((section, index) => {
              const rows = section.rows.filter(row => section.id !== 'profil' || !CRITERIA_KEYS.has(row.id));
              const primary = rows.slice(0, section.id === 'profil' ? 2 : section.id === 'angebot' ? 6 : 3);
              const remaining = rows.slice(primary.length);
              return <section key={section.id} id={`briefing-${section.id}`} aria-labelledby={`heading-${section.id}`} className="scroll-mt-40 border-b border-border pb-8 last:border-0">
                <div className="mb-5 flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-xs tabular-nums text-muted-foreground">0{index + 1}</span>
                  <div><h2 id={`heading-${section.id}`} className="text-lg font-semibold tracking-tight">{section.title}</h2><p className="mt-1 text-sm text-muted-foreground">{section.description}</p></div>
                </div>
                {section.id === 'profil' && <>
                  {hasCriteria ? <div className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
                    {[{ label: 'Unverzichtbar', values: criteria.required, source: criteria.sources.required, icon: Target }, { label: 'Erlernbar', values: criteria.trainable, source: criteria.sources.trainable, icon: Plus }, { label: 'Verhandelbar', values: criteria.negotiable, source: criteria.sources.negotiable, icon: CheckCheck }].map(({ label, values, source, icon: Icon }) => <div key={label} className="min-w-0 space-y-3">
                      <h3 className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" />{label}</h3>
                      {values.length ? <><ul className="space-y-2">{values.map(value => <li key={value} className="flex gap-2 break-words text-sm leading-6"><span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />{value}</li>)}</ul><Source source={source} /></> : <p className="text-xs leading-5 text-muted-foreground">Keine Angabe verfügbar</p>}
                    </div>)}
                  </div> : <EmptyAnswer>Konkrete Auswahlkriterien sind in den verfügbaren Angaben noch nicht hinterlegt.</EmptyAnswer>}
                  <Button variant="ghost" size="sm" className="my-3" onClick={() => setShowGuide(true)}><ListChecks />Screening-Leitfaden öffnen<ArrowUpRight /></Button>
                </>}
                <dl>{primary.map(row => <Answer key={row.id} row={row} />)}</dl>
                {remaining.length > 0 && <details className="group mt-3 rounded-lg border border-border/60 bg-card/30 px-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium">{remaining.length === 1 ? 'Eine weitere Angabe' : `Weitere ${remaining.length} Angaben`}<ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
                  <dl>{remaining.map(row => <Answer key={row.id} row={row} />)}</dl>
                </details>}
                {!rows.length && section.id !== 'profil' && <EmptyAnswer>Zu diesem Bereich sind in der Recruiter-Ansicht keine strukturierten Antworten verfügbar.</EmptyAnswer>}
                {section.id === 'aufgabe' && !rows.length && job.formatted_content?.role_summary && <div className="mt-3 border-l-2 border-border pl-4"><p className="mb-2 text-xs text-muted-foreground">KI-Zusammenfassung der Anzeige · nicht als Kundenbestätigung belegt</p><p className="text-sm leading-7">{job.formatted_content.role_summary}</p></div>}
                {section.id === 'prozess' && <div className="mt-5 rounded-lg border border-border p-4">
                  <h3 className="text-sm font-medium">Für eine gute Kandidatenvorstellung</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Profil auswählen, Pflichtkriterien anhand konkreter Erfahrung prüfen, Gehalt und Verfügbarkeit abgleichen und die Einwilligung zur Weitergabe bestätigen.</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={onSubmit}>Vorstellung vorbereiten<ArrowUpRight /></Button>
                </div>}
              </section>;
            })}
          </TabsContent>

          <TabsContent value="kandidaten" className="m-0 space-y-6">
            <div><h2 className="text-xl font-semibold">Deine Kandidaten für dieses Mandat</h2><p className="mt-2 text-sm text-muted-foreground">Einreichungen, aktueller Stand und die nächsten Schritte.</p></div>
            {submissionCount > 0 ? candidates : <div className="rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center"><Users className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h3 className="font-medium">Deine erste Vorstellung beginnt hier</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Wähle ein vorhandenes Profil oder lege einen Kandidaten an. Vor dem Einreichen prüfst du die Angaben.</p><Button className="mt-6" onClick={onSubmit}><Plus />Vorstellung vorbereiten</Button></div>}
          </TabsContent>

          <TabsContent value="quellen" className="m-0 space-y-8">
            <section className="space-y-4"><h2 className="text-xl font-semibold">Quellen & Rückfragen</h2><p className="text-sm leading-7 text-muted-foreground">Das Briefing bündelt die verfügbaren Angaben nach Thema. Die Bezeichnung „Aufnahmefeld“ beschreibt den Speicherort: Auch aus einer Anzeige übernommene Werte können dort stehen. Eine Bestätigung und ein Änderungsdatum je Antwort werden dieser Ansicht derzeit nicht mitgeliefert.</p>
              <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-xl border border-border p-5"><ClipboardList className="mb-3 h-5 w-5 text-muted-foreground" /><h3 className="font-medium">Strukturierte Aufnahme</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{intakeCount} verfügbare Angaben, thematisch im Briefing zugeordnet. Vollständige Formulierungen bleiben aufklappbar.</p></div><div className="rounded-xl border border-border p-5"><LockKeyhole className="mb-3 h-5 w-5 text-muted-foreground" /><h3 className="font-medium">Freigabe & fehlende Angaben</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Nicht verfügbare Werte können fehlen oder zugriffsbeschränkt sein. Daraus folgt keine Aussage darüber, ob der Kunde sie beantwortet hat.</p></div></div>
            </section>
            <section className="space-y-4"><h3 className="text-lg font-medium">Rückfragen vorbereiten</h3><p className="text-sm leading-6 text-muted-foreground">Der Entwurf ergänzt die für diesen Zugang verfügbaren Antworten. 90-Tage-Ziele und Interviewablauf erscheinen im Briefing, sobald sie vorliegen und freigegeben sind. Bitte gleiche offene Fragen vor dem Versenden mit den vorhandenen Unterlagen ab. Änderungen bleiben nur während dieser Seitenansicht erhalten.</p><label htmlFor="briefing-questions" className="sr-only">Entwurf der Rückfragen</label><Textarea id="briefing-questions" rows={12} value={questionDraft} onChange={e => { setQuestionDraft(e.target.value); setCopied(false); }} className="text-sm leading-7" /><Button variant="outline" onClick={copyQuestions}>{copied ? <Check /> : <Copy />}{copied ? 'Entwurf kopiert' : 'Rückfragen kopieren'}</Button><p className="text-sm text-muted-foreground" role="status">{copyError ? 'Kopieren nicht möglich. Bitte den Text im Feld markieren und kopieren.' : copied ? 'Der Entwurf wurde kopiert. Es wurde keine Nachricht versendet.' : ''}</p></section>
            <details className="group rounded-xl border border-border p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">Stellenbeschreibung & ursprüngliche Anforderungen<ChevronDown className="h-4 w-4 group-open:rotate-180" /></summary><div className="mt-5 space-y-5 whitespace-pre-wrap text-sm leading-7">{job.description ? <p>{job.description}</p> : <p className="text-muted-foreground">Die Originalbeschreibung ist nicht verfügbar oder noch nicht freigegeben.</p>}{job.requirements && <div><h4 className="mb-2 font-medium">Anforderungen aus den Stellendaten</h4><p>{job.requirements}</p></div>}{job.tech_environment?.length > 0 && <p>Technisches Umfeld: {job.tech_environment.join(' · ')}</p>}</div></details>
            {job.formatted_content && <details className="group rounded-xl border border-border p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">KI-Aufbereitung der Anzeige<ChevronDown className="h-4 w-4 group-open:rotate-180" /></summary><p className="mt-4 text-xs leading-6 text-muted-foreground">Diese Texte wurden aus der Anzeige generiert. Sie ersetzen weder die strukturierten Anforderungen noch eine Bestätigung durch den Kunden. Interne Provisionen gehören nicht in die Kandidatenansprache.</p><div className="mt-5 space-y-5 text-sm leading-7">{Object.entries(job.formatted_content).filter(([key, value]) => ['role_summary', 'ideal_candidate', 'anonymous_company_pitch', 'selling_points', 'highlights', 'urgency_note'].includes(key) && value).map(([key, value]) => <div key={key}><h4 className="mb-2 font-medium">{{ role_summary: 'Die Rolle', ideal_candidate: 'Profilentwurf', anonymous_company_pitch: 'Unternehmensentwurf', selling_points: 'Argumente aus der Anzeige', highlights: 'Highlights', urgency_note: 'Einschätzung zur Dringlichkeit' }[key]}</h4>{Array.isArray(value) ? <ul className="list-disc space-y-1 pl-5">{value.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>{value}</p>}</div>)}</div></details>}
          </TabsContent>
        </div>

        <aside aria-label="Aktionen zum Mandat" className="space-y-5 min-[1180px]:sticky min-[1180px]:top-24">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground">Dein nächster Schritt</p>
            <h2 className="text-lg font-semibold">Die passende Person vorstellen</h2>
            <p className="mb-5 mt-2 text-sm leading-6 text-muted-foreground">Profil wählen, Passung begründen und Angaben vor dem Einreichen prüfen.</p>
            <Button className="h-auto min-h-11 w-full whitespace-normal py-3" onClick={onSubmit}><Plus />Vorstellung vorbereiten</Button>
            <div className="mt-4 space-y-1 border-t border-border pt-3"><Button variant="ghost" className="w-full justify-start" onClick={onExpose}><FileText />Anonymes Exposé</Button><Button variant="ghost" className="w-full justify-start" onClick={() => setShowGuide(true)}><ListChecks />Screening-Leitfaden</Button><Button variant="ghost" className="w-full justify-start" onClick={goToSources}><MessageSquareText />Rückfragen vorbereiten</Button></div>
          </div>
          {job.employment_type === 'freelance' ? <div className="rounded-xl border border-border p-5"><h3 className="font-medium">Projektkonditionen</h3><p className="mt-3 text-lg font-semibold">{job.day_rate_min != null || job.day_rate_max != null ? [job.day_rate_min, job.day_rate_max].filter(value => value != null).map(value => EURO.format(value!)).join(' – ') + ' / Tag' : 'Tagessatz nicht verfügbar'}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">Eine Gesamtprovision lässt sich aus dem Tagessatz allein nicht berechnen. Vergütungsbasis und Abrechnungsbedingungen im Mandat prüfen.</p></div> : <FeeCalculatorCard feePercentage={job.recruiter_fee_percentage ?? null} salaryMin={job.salary_min ?? null} salaryMax={job.salary_max ?? null} />}
          <button className="flex items-start gap-2 text-left text-xs leading-6 text-muted-foreground hover:text-foreground" onClick={() => setShowAccess(true)}><LockKeyhole className="mt-1 h-4 w-4 shrink-0" /><span>{companyRevealed ? 'Unternehmensdaten sind für dich freigegeben.' : 'Unternehmensidentität geschützt. So funktioniert die Freigabe.'}</span></button>
        </aside>
      </div>
    </Tabs>

    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-border bg-background p-3 pb-[max(12px,env(safe-area-inset-bottom))] md:left-64 min-[1180px]:hidden"><Button className="min-w-0 flex-1" onClick={onSubmit}><Plus />Vorstellung vorbereiten</Button><Button variant="outline" aria-label="Anonymes Exposé öffnen" onClick={onExpose}><FileText /></Button></div>

    <Dialog open={showGuide} onOpenChange={setShowGuide}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Dein Screening-Leitfaden</DialogTitle><DialogDescription>{job.title} · Fragen für dein Gespräch, keine automatische Eignungsentscheidung.</DialogDescription></DialogHeader><div className="space-y-5">{criteria.required.map(value => <div key={value} className="border-b border-border pb-4"><h3 className="text-sm font-medium">{value}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">In welcher Situation haben Sie das angewendet? Was haben Sie selbst verantwortet und welches Ergebnis erreicht?</p></div>)}{screening.length > 0 && <div><h3 className="font-medium">Hinterlegte Screening-Fragen</h3><ul className="mt-3 list-disc space-y-3 pl-5 text-sm leading-6">{screening.map((question, index) => <li key={index}>{question}</li>)}</ul></div>}<div><h3 className="font-medium">Rahmenbedingungen abgleichen</h3><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground"><li>Welche Aufgabe und welches Umfeld suchen Sie als Nächstes?</li><li>Welche Gehaltsvorstellung und Verfügbarkeit haben Sie?</li><li>Passt das angegebene Arbeits- und Präsenzmodell?</li><li>Welche Punkte möchten Sie vor einer Vorstellung klären?</li></ul></div></div></DialogContent></Dialog>
    <Dialog open={showAccess} onOpenChange={setShowAccess}><DialogContent><DialogHeader><DialogTitle>Unternehmensfreigabe</DialogTitle><DialogDescription>Die vorhandenen Freigabestufen dieses Mandats.</DialogDescription></DialogHeader><ol className="list-decimal space-y-4 pl-5 text-sm leading-7"><li>Anonymes Briefing für die erste Einschätzung.</li><li>Der Firmenname wird nach dem Kandidaten-Opt-in freigegeben.</li><li>Nach Interviewbestätigung werden weitere Firmeninformationen zugänglich.</li></ol><p className="text-sm text-muted-foreground">Aktueller Status: {fullAccess ? 'Voller Zugriff' : companyRevealed ? 'Firma freigegeben' : 'Firma anonym'}. Eine vorgezogene Freigabe ist im aktuellen Ablauf nicht vorgesehen.</p></DialogContent></Dialog>
  </div>;
}
