import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Circle, CircleDot, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { documentLabels, stateLabels, type AuditEntry, type StoredContract, type StoredOnboarding } from '@/lib/recruiterOnboardingApi';
import { CHECK_SHORT, counterDeadlineDay, nextAction, processSteps, reviewGroups, reviewHints, type CheckKey } from '@/lib/recruiterCaseReview';
import type { TimelineEntry } from '@/lib/recruiterNetwork';
import { ProfileReview } from '@/components/onboarding/RecruiterProfileForm';
import '@/components/onboarding/onboarding.css';
import { CONTRACT_FIELD_LABELS, cleanContractDetails } from '../../../../supabase/functions/_shared/recruiter-contract-data';
import { requiredReviewChecks, REVIEW_CHECK_LABELS } from '../../../../supabase/functions/_shared/recruiter-contract-policy';
import { cleanExpertise } from '../../../../supabase/functions/_shared/recruiter-expertise';

/**
 * Vorgangsseite eines Headhunters: Prozessleiste, Angaben in Gruppen mit dem
 * passenden Prüfpunkt und Hinweisen links, rechts fest der Vertrag mit genau
 * einem nächsten Schritt. Reine Darstellung; Laden und Aktionen macht die Seite.
 */
const when = (at: string | null | undefined) => at ? new Date(at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const day = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const card = 'rounded-xl border bg-card p-4';

export interface CaseReviewProps {
  c: StoredOnboarding;
  contract: StoredContract | null;
  history: AuditEntry[];
  timeline: TimelineEntry[];
  isCountersigner: boolean;
  docusignEnabled: boolean;
  busy: boolean;
  error: string;
  message: string;
  onAction: (action: string, extra?: Record<string, unknown>) => void;
  backHref: string;
  akteHref: string;
}

export function CaseReview({ c, contract, history, timeline, isCountersigner, docusignEnabled, busy, error, message, onAction, backHref, akteHref }: CaseReviewProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [checkError, setCheckError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');
  const groups = useMemo(() => reviewGroups(c), [c]);
  const hints = useMemo(() => reviewHints(c), [c]);
  const steps = useMemo(() => processSteps(c, contract, history), [c, contract, history]);
  const next = nextAction(c, contract);
  const reviewing = c.state === 'review' && !c.revoked_at;
  const required = requiredReviewChecks(c.kind);
  const saved = (c.checks ?? {}) as Record<string, unknown>;
  const x = cleanExpertise(c.profile.expertise);
  const details = cleanContractDetails(c.profile.contractDetails);
  const open = contract && !['declined', 'voided', 'completed', 'manual_review'].includes(contract.state);
  const name = c.profile.name || c.email;

  const approve = () => {
    if (required.some(key => !checks[key])) { setCheckError('Hake zuerst links alle Prüfpunkte ab.'); return; }
    setCheckError('');
    onAction('approve', { checks });
  };

  const primary = (() => {
    switch (next.kind) {
      case 'review': return <Button className="w-full" disabled={busy} onClick={approve}>Prüfung abschließen</Button>;
      case 'counter': return isCountersigner
        ? <Button className="w-full" disabled={busy} onClick={() => onAction('counter')}>In DocuSign gegenzeichnen</Button>
        : <p className="text-sm text-muted-foreground">Gegenzeichnen kann nur {contract?.counter_name || 'der hinterlegte Unterzeichner'}{contract?.counter_email ? ` (${contract.counter_email})` : ''}.</p>;
      case 'activate': return <Button className="w-full" disabled={busy} onClick={() => onAction('activate')}>Freischalten und Zugang senden</Button>;
      case 'done': return <p className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 text-success"/>Freigeschaltet</p>;
      default: return <p className="text-sm text-muted-foreground">{next.label}{next.hint ? `. ${next.hint}` : ''}</p>;
    }
  })();

  return <div className="space-y-6">
    <Link to={backHref} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4"/>Recruiterverwaltung</Link>

    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight">{name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[c.profile.company, c.kind === 'agency' ? 'Agentur' : 'Einzelrecruiter', c.entry_source === 'website' ? 'Website-Registrierung' : 'persönliche Einladung'].filter(Boolean).join(' · ')}
        </p>
      </div>
      <span className={cn('rounded-md px-3 py-1.5 text-sm', ['review', 'counter', 'activate'].includes(next.kind) ? 'bg-primary/10 font-medium text-primary' : 'bg-muted text-muted-foreground')}>
        {['review', 'counter', 'activate'].includes(next.kind) ? `Jetzt dran: ${next.label}` : next.label}
      </span>
    </header>

    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Ablauf des Vorgangs">
      {steps.map(s => <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined}
        className={cn('rounded-lg border p-3', s.state === 'current' && 'border-primary bg-primary/5')}>
        {s.state === 'done' ? <CheckCircle2 className="h-4 w-4 text-success"/> : s.state === 'current' ? <CircleDot className="h-4 w-4 text-primary"/> : <Circle className="h-4 w-4 text-muted-foreground"/>}
        <p className={cn('mt-1.5 text-sm leading-snug', s.state === 'open' && 'text-muted-foreground', s.state === 'current' && 'font-medium')}>{s.label}</p>
        <p className="text-xs text-muted-foreground">{when(s.at) || s.note || (s.state === 'done' ? 'erledigt' : '')}{s.at && s.note ? ` · ${s.note}` : ''}</p>
      </li>)}
    </ol>

    {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</p>}
    {message && <p role="status" className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">{message}</p>}
    {c.feedback && c.state === 'draft' && <p className="rounded-md border bg-muted/40 p-3 text-sm">Offene Rückfrage an den Headhunter: {c.feedback}</p>}

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)] lg:items-start">
      <div className="space-y-4">
        {groups.map(g => {
          const groupHints = hints.filter(h => h.group === g.id);
          return <section key={g.id} className={card} aria-labelledby={`group-${g.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`group-${g.id}`} className="text-sm font-semibold">{g.title}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1">{g.checks.map((key: CheckKey) => reviewing
                ? <label key={key} className="flex cursor-pointer items-center gap-2 text-sm" title={REVIEW_CHECK_LABELS[key]}>
                  <Checkbox checked={!!checks[key]} onCheckedChange={v => { setChecks({ ...checks, [key]: v === true }); setCheckError(''); }} aria-label={REVIEW_CHECK_LABELS[key]}/>
                  {CHECK_SHORT[key]} geprüft
                </label>
                : saved[key] === true
                  ? <span key={key} className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={REVIEW_CHECK_LABELS[key]}><Check className="h-3.5 w-3.5 text-success"/>{CHECK_SHORT[key]} geprüft</span>
                  : <span key={key} className="text-xs text-muted-foreground" title={REVIEW_CHECK_LABELS[key]}>{CHECK_SHORT[key]}: offen</span>)}</div>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {g.fields.map(f => <div key={f.label} className="min-w-0"><dt className="text-xs text-muted-foreground">{f.label}</dt><dd className="break-words text-sm">{f.value}</dd></div>)}
            </dl>
            {groupHints.map(h => <p key={h.text} className="mt-3 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning"/>{h.text}</p>)}
          </section>;
        })}

        <section className={card} aria-labelledby="group-profile">
          <h2 id="group-profile" className="text-sm font-semibold">Profil</h2>
          <div className="mt-3 flex flex-wrap gap-1.5">{[...x.areas, ...x.extras].map(area => <span key={area} className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">{area}</span>)}</div>
          <p className="mt-3 text-sm text-muted-foreground">{[x.levels.join(', '), x.regions.join(', '), x.languages.join(', '), x.experience && `Erfahrung ${x.experience}`, x.placements && `${x.placements} Besetzungen im Jahr`, x.parallel && `${x.parallel} parallel`].filter(Boolean).join(' · ') || 'Keine Profilangaben.'}</p>
        </section>

        <details className={cn(card, 'text-sm')}>
          <summary className="cursor-pointer font-medium">Alle Angaben im Wortlaut</summary>
          <div className="mh-ui mt-3 space-y-4">
            <ProfileReview profile={c.profile}/>
            <dl className="mh-review">{Object.entries(CONTRACT_FIELD_LABELS).map(([key, label]) => <div key={key}><dt>{label}</dt><dd className="whitespace-pre-wrap">{details[key as keyof typeof CONTRACT_FIELD_LABELS] || 'Nicht angegeben'}</dd></div>)}</dl>
          </div>
        </details>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20" aria-label="Vertrag und nächster Schritt">
        <section className={cn(card, 'space-y-3')}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">{contract ? `Vertrag ${contract.package_version}` : 'Vertrag'}</h2>
            {contract && <span className="text-xs text-muted-foreground">{stateLabels[contract.state] ?? contract.state}</span>}
          </div>
          {contract ? <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">{contract.recruiter_signed_at ? <CheckCircle2 className="h-4 w-4 text-success"/> : <Circle className="h-4 w-4 text-muted-foreground"/>}Headhunter · {contract.recruiter_signed_at ? when(contract.recruiter_signed_at) : 'offen'}</li>
            <li className="flex items-center gap-2">{contract.countersigned_at ? <CheckCircle2 className="h-4 w-4 text-success"/> : <Circle className="h-4 w-4 text-muted-foreground"/>}Matchunt · {contract.countersigned_at ? when(contract.countersigned_at) : 'offen'}</li>
          </ul> : <p className="text-sm text-muted-foreground">Das Vertragspaket entsteht, sobald der Headhunter den Vertrag startet.</p>}
          {contract?.recruiter_signed_at && !contract.countersigned_at && contract.state === 'sent' && <p className="text-xs text-muted-foreground">Gegenzeichnen bis einschließlich {day(counterDeadlineDay(contract.recruiter_signed_at))}</p>}
          {primary}
          {checkError && <p role="alert" className="text-sm text-destructive">{checkError}</p>}
          {next.kind === 'review' && next.hint && <p className="text-xs text-muted-foreground">{next.hint} Danach erscheint hier „In DocuSign gegenzeichnen“.</p>}
          <div className="flex flex-wrap gap-2">
            {contract?.state === 'sent' && <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('sync')}><RefreshCw className="mr-1.5 h-3.5 w-3.5"/>Signaturstatus prüfen</Button>}
            {c.state === 'approved' && contract && ['prepared', 'creating'].includes(contract.state) && docusignEnabled && <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('send')}>{contract.state === 'creating' ? 'DocuSign-Erstellung wiederaufnehmen' : 'Vertrag an DocuSign senden'}</Button>}
            {next.kind === 'done' && <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('activate')}>Zugangsmail erneut senden</Button>}
          </div>
        </section>

        {contract && <section className={card} aria-labelledby="documents">
          <h2 id="documents" className="text-sm font-semibold">Dokumente</h2>
          <ul className="mt-2 space-y-0.5">
            {contract.documents.map(d => <li key={d.role}><button type="button" disabled={busy} onClick={() => onAction('document', { document: d.role })}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><FileText className="h-4 w-4 shrink-0"/>{documentLabels[d.role] ?? d.name}</button></li>)}
            {contract.signed_document_path && <li><button type="button" disabled={busy} onClick={() => onAction('document', { document: 'signed' })} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-muted"><FileText className="h-4 w-4 shrink-0"/>Unterzeichnetes Vertragspaket</button></li>}
            {contract.certificate_path && <li><button type="button" disabled={busy} onClick={() => onAction('document', { document: 'certificate' })} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"><FileText className="h-4 w-4 shrink-0"/>Abschlusszertifikat</button></li>}
          </ul>
        </section>}

        <section className={card} aria-labelledby="timeline">
          <h2 id="timeline" className="text-sm font-semibold">Verlauf</h2>
          {timeline.length ? <ol className="mt-2 space-y-1.5">{timeline.map((t, i) => <li key={`${t.at}-${i}`} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-sm">
            <span className="text-xs tabular-nums text-muted-foreground">{when(t.at)}</span>
            <span className={cn(t.tone === 'good' && 'font-medium', t.tone === 'warn' && 'text-destructive', t.tone === 'muted' && 'text-muted-foreground')}>{t.text}</span>
          </li>)}</ol> : <p className="mt-2 text-sm text-muted-foreground">Noch keine Einträge.</p>}
          <Link to={akteHref} className="mt-3 inline-block text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">E-Mails, Leistung und Notizen in der Akte</Link>
        </section>

        <details className={cn(card, 'space-y-3 text-sm')}>
          <summary className="cursor-pointer font-medium">Weitere Aktionen</summary>
          {['review', 'approved'].includes(c.state) && c.claimed_at && !open && <div className="space-y-2 pt-2">
            <p className="text-muted-foreground">Rückfrage an den Headhunter. Der Vorgang geht zurück in „Angaben ergänzen“.</p>
            <Textarea placeholder="Was fehlt oder muss korrigiert werden? Mindestens 10 Zeichen." value={feedback} onChange={e => setFeedback(e.target.value)}/>
            <Button size="sm" variant="outline" disabled={busy || feedback.trim().length < 10} onClick={() => onAction('changes', { feedback })}>Zur Ergänzung öffnen</Button>
          </div>}
          {contract && ['prepared', 'sent'].includes(contract.state) && <div className="space-y-2 pt-2">
            <p className="text-muted-foreground">Vertrag zurücknehmen, etwa für eine Korrektur. Der DocuSign-Umschlag wird ungültig.</p>
            <Textarea placeholder="Begründung, mindestens 10 Zeichen" value={reason} onChange={e => setReason(e.target.value)}/>
            <Button size="sm" variant="destructive" disabled={busy || reason.trim().length < 10}
              onClick={() => { if (window.confirm('Vertragsvorgang wirklich zurücknehmen? Der DocuSign-Umschlag wird ungültig.')) onAction('void', { reason }); }}>Vertrag zurücknehmen</Button>
          </div>}
          {!c.claimed_at && !c.revoked_at && <div className="pt-2">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => { if (window.confirm('Einladung widerrufen? Der Link funktioniert danach nicht mehr.')) onAction('revoke'); }}>Einladung widerrufen</Button>
          </div>}
        </details>
      </aside>
    </div>
  </div>;
}
