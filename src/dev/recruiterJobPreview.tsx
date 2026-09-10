import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Briefcase, CheckSquare, FileText, LayoutDashboard, Moon, Sun, Users } from 'lucide-react';
import { RecruiterJobWorkspace, type WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';
import { CandidateSubmissionReview } from '@/components/recruiter/CandidateSubmissionReview';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { getRecruiterCriteria } from '@/lib/recruiterBriefing';
import '@/index.css';

// Separate Vite development entry. It neither signs in nor loads real records.
if (!import.meta.env.DEV) throw new Error('This preview is only available in development.');

const fixture: WorkspaceJob = {
  id: 'preview-finance', title: 'Finance Manager Rechnungswesen & Controlling (m/w/d)',
  company_name: null, industry: 'Personalberatung', company_size_band: 'bis 50 Mitarbeitende',
  location: 'München-Isarvorstadt', remote_type: 'hybrid', employment_type: 'full-time', experience_level: 'senior',
  salary_min: 70000, salary_max: 85000, recruiter_fee_percentage: 15, onsite_days_required: 2,
  must_have_criteria: ['HGB', 'Monats- / Jahresabschluss', 'Excel'], trainable_skills: ['DATEV Unternehmen online', 'Provisionslogik', 'Power BI'], nice_to_have_criteria: ['IFRS', 'Bilanzbuchhalter IHK'],
  required_languages: [{ code: 'de', minLevel: 'C1' }, { code: 'en', minLevel: 'B2' }],
  required_certifications: ['Bilanzbuchhalter IHK'], vacancy_reason: 'Nachbesetzung',
  success_profile: 'Erklärt die Zahlen hinter dem Ergebnis und übernimmt Verantwortung für den gesamten Abschluss. Arbeitet selbstständig in einem kleinen Team.',
  failure_profile: 'Die Rolle erfordert eigenständige Arbeit auch ohne vorbereitete Zuarbeit. Erfahrungen aus früheren Besetzungen sollten im Gespräch vertieft werden.',
  task_breakdown: { 'Abschluss und Buchhaltung': 40, 'Controlling und Reporting': 35, 'Prozessarbeit und Digitalisierung': 25 },
  daily_routine: 'Monatsabschlüsse vorbereiten, Rückstellungen prüfen und Provisionsabrechnungen freigeben. Im Anschluss Forecast und Controlling; daneben die ERP-Umstellung mitgestalten.',
  task_focus: 'Steuernd / koordinierend', negative_impact_if_unfilled: 'Die rechtzeitige Durchführung der Abschlüsse und die kontinuierliche Provisionsabrechnung stehen im Vordergrund.',
  team_size: 3, reports_to: 'Geschäftsführung', decision_makers: ['Geschäftsführung'],
  company_culture: 'Direkte Zusammenarbeit und offener Austausch über Ergebnisse. Kurze Wege zwischen Finance, Beratung und Geschäftsführung.',
  salary_months: 13, bonus_structure: 'bis 10 %', contract_limitation: 'unbefristet',
  benefits: ['30 Tage Urlaub', 'Weiterbildungsbudget', 'Jobrad', 'Deutschlandticket', 'Sportangebot', 'Kita-Zuschuss'],
  career_path: '3.000 € Weiterbildungsbudget pro Jahr. Die Bilanzbuchhalter-Weiterbildung wird übernommen. Perspektivisch Entwicklung zur kaufmännischen Leitung.',
  career_example: 'Beispiel: Entwicklung aus der Finanzbuchhaltung in eine Teamleitungsrolle mit erweiterten Verantwortlichkeiten.',
  unique_selling_points: ['Inhabergeführt und unabhängig von Investoren', 'Kurze Entscheidungswege'],
  position_advantages: ['ERP-Umstellung aktiv mitgestalten', 'Direkter Einfluss auf Prozesse und Reporting'],
  core_hours: 'Gleitzeit mit Kernzeit', core_hours_detail: '09:30 bis 15:30 Uhr', overtime_policy: 'Ausgezahlt', time_tracking_method: 'Digital', contract_creation_days: 2, contract_sent_digitally: true,
  contract_sensitive_topics: 'Verschwiegenheit / NDA; Rückzahlungsklausel für Weiterbildung',
  industry_opportunities: 'Nachfrage nach spezialisierten Fachkräften im Mittelstand.', industry_challenges: 'Wettbewerb durch interne Recruitingteams und neue Direktansprache-Tools.', candidates_in_pipeline: 0,
};

export function Preview() {
  const [theme, setTheme] = useState('dark');
  const [scenario, setScenario] = useState('finance');
  const [dialog, setDialog] = useState<'submit' | 'expose' | null>(null);
  const [review, setReview] = useState(false);
  const [notice, setNotice] = useState('');
  const job: WorkspaceJob = scenario === 'legacy'
    ? { id: 'preview-legacy', title: 'Softwareentwickler Backend (m/w/d)', industry: 'Software', location: 'Berlin', remote_type: 'remote', employment_type: 'full-time', salary_min: null, salary_max: null, recruiter_fee_percentage: null, must_haves: ['TypeScript', 'PostgreSQL'], nice_to_haves: ['Cloud-Erfahrung'], formatted_content: { role_summary: 'Weiterentwicklung einer Softwareplattform mit Schwerpunkt Backend und Schnittstellen.' } }
    : scenario === 'freelance'
      ? { id: 'preview-freelance', title: 'Interim Finance Lead (m/w/d)', industry: 'Dienstleistung', location: 'München', remote_type: 'hybrid', employment_type: 'freelance', day_rate_min: 750, day_rate_max: 1200, contract_duration_months: 6, utilization_days_per_week: 4, extension_possible: false, onsite_days_required: 0, remote_days_flexible: true, must_have_criteria: ['HGB', 'Abschlusserstellung'], task_focus: 'Einführung eines neuen Abschlussprozesses', contract_creation_days: 0, contract_sent_digitally: false, team_size: 3 }
      : fixture;
  return <div className="min-h-screen bg-background text-foreground">
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b border-border bg-card px-4 md:px-6"><MatchuntWordmark size="md" /><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">Vorschau<span className="hidden sm:inline"> · Beispieldaten</span></span><Button variant="ghost" size="icon" aria-label="Farbschema wechseln" onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); document.documentElement.classList.toggle('light', next === 'light'); }}>{theme === 'dark' ? <Sun /> : <Moon />}</Button></div></header>
    <aside className="fixed bottom-0 left-0 top-16 hidden w-64 border-r border-border bg-card p-4 md:block"><div className="space-y-1">{[{ text: 'Übersicht', icon: LayoutDashboard }, { text: 'Aufgaben', icon: CheckSquare }, { text: 'Offene Jobs', icon: Briefcase }, { text: 'Meine Kandidaten', icon: Users }, { text: 'Pipeline', icon: FileText }].map(({ text, icon: Icon }) => <div key={text} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${text === 'Offene Jobs' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}><Icon className="h-4 w-4" />{text}</div>)}</div><div className="mt-8 space-y-3 border-t border-border pt-5"><label htmlFor="preview-scenario" className="block text-xs font-medium text-muted-foreground">Ansicht prüfen</label><select id="preview-scenario" className="w-full rounded-md border border-input bg-background p-2 text-sm" value={scenario} onChange={e => setScenario(e.target.value)}><option value="finance">Mit Kundenaufnahme</option><option value="freelance">Freelance-Mandat</option><option value="legacy">Ohne Aufnahme</option></select><p className="text-xs leading-6 text-muted-foreground">Beispieldaten zur Prüfung des Designs. Es werden keine Live-Daten geladen oder gespeichert.</p></div></aside>
    <main className="min-w-0 px-4 py-6 md:ml-64 md:px-6 xl:px-8"><RecruiterJobWorkspace key={job.id} job={job} companyRevealed={false} fullAccess={false} submissionCount={0} candidates={null} onSubmit={() => { setDialog('submit'); setReview(false); setNotice(''); }} onExpose={() => setDialog('expose')} /></main>
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{dialog === 'expose' ? 'Anonymes Exposé · Vorschau' : 'Vorstellung vorbereiten · Vorschau'}</DialogTitle><DialogDescription>Dieser Entwurf verwendet ausschließlich Beispieldaten. Es findet keine Einreichung statt.</DialogDescription></DialogHeader>{dialog === 'expose' ? <p className="py-6 text-sm leading-7 text-muted-foreground">In der Anwendung öffnet sich hier die Exposé-Erstellung mit einer ausdrücklichen Generieren-Aktion und anschließender Textvorschau. Die KI-Erstellung ist in dieser lokalen Designvorschau nicht angebunden.</p> : review ? <form onSubmit={e => { e.preventDefault(); setNotice('Vorschau geprüft. Es wurden keine Daten übertragen.'); }}><CandidateSubmissionReview data={{ name: 'Beispielprofil', email: 'kandidat@example.test', expectedSalary: 80000, availability: '2026-12-01', notes: 'Mehrjährige Verantwortung für HGB-Abschlüsse. Erfahrung im Aufbau eines monatlichen Reportings. Den Umfang der Führungserfahrung vor einer realen Vorstellung vertiefen.', criteria: getRecruiterCriteria(job).required, createsCandidate: false }} busy={false} onBack={() => setReview(false)} /><p className="mt-4 text-sm text-muted-foreground" role="status">{notice}</p></form> : <div className="space-y-5 py-4"><p className="text-sm leading-7 text-muted-foreground">In der Anwendung wählst du hier dein Kandidatenprofil, ergänzt deine Begründung und bestätigst die Einwilligung. Die nächste Ansicht zeigt die gemeinsame Prüfansicht.</p><Button onClick={() => setReview(true)}>Beispielvorstellung prüfen</Button></div>}</DialogContent></Dialog>
  </div>;
}

createRoot(document.getElementById('root')!).render(<BrowserRouter><TooltipProvider><Preview /></TooltipProvider></BrowserRouter>);
