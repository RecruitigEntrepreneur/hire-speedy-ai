import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2, LockKeyhole, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { buildJobPosting, postingAsText } from '@/lib/jobPosting';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';

/**
 * Die Stellenanzeige zum Mandat — eine eigene Seite, kein Reiter.
 *
 * Sie hat einen anderen Leser als das Briefing: dort liest der Headhunter für
 * sich, hier zeigt er etwas her. Deshalb steht hier kein Honorar, keine
 * Konkurrenzlage, kein Absprunggrund und kein Firmenname — auch dann nicht,
 * wenn er ihn kennt. Die Freigabe gilt ihm, nicht dem Kandidaten.
 *
 * Der vertraute Aufbau einer Stellenanzeige ist Absicht: Über die Position,
 * Aufgaben, Profil, Angebot, Unternehmen. Diese Form muss niemandem erklärt
 * werden.
 */
export default function JobPosting() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<WorkspaceJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const reload = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      if (!id || !user?.id) { if (!cancelled) setLoading(false); return; }
      const { data, error: cause } = await supabase
        .from('recruiter_jobs_view').select('*').eq('id', id).single();
      if (cancelled) return;
      if (cause) {
        console.error('Stellenanzeige konnte nicht geladen werden:', cause);
        setError('Die Anzeige konnte nicht geladen werden. Bitte versuche es erneut.');
      } else {
        setJob(data as unknown as WorkspaceJob);
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [id, user?.id, revision]);

  if (loading) return <DashboardLayout><div role="status" className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Anzeige wird geladen …</div></DashboardLayout>;

  if (error || !job) return <DashboardLayout><div className="mx-auto max-w-lg space-y-5 py-16 text-center">
    <h1 className="text-xl font-semibold">Anzeige nicht verfügbar</h1>
    <p role="alert" className="text-sm text-muted-foreground">{error || 'Die Stelle ist nicht veröffentlicht oder für deinen Zugang nicht verfügbar.'}</p>
    <div className="flex flex-wrap justify-center gap-3">
      <Button variant="outline" onClick={reload}><RotateCcw />Erneut laden</Button>
      <Button variant="ghost" asChild><Link to="/recruiter/jobs"><ArrowLeft />Zurück zu Jobs</Link></Button>
    </div>
  </div></DashboardLayout>;

  const posting = buildJobPosting(job);

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(postingAsText(posting));
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  return <DashboardLayout>
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/recruiter/jobs/${job.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Zurück zum Briefing
        </Link>
        <Button variant="outline" size="sm" onClick={kopieren}>
          {copied ? <Check /> : <Copy />}{copied ? 'Kopiert' : 'Anzeige kopieren'}
        </Button>
      </div>
      {copyError && <p role="alert" className="text-sm text-muted-foreground">Kopieren nicht möglich. Bitte den Text markieren und kopieren.</p>}

      <header className="space-y-3">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">{posting.title}</h1>
        {posting.subtitle && <p className="text-sm text-muted-foreground">{posting.subtitle}</p>}
      </header>

      {posting.facts.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-5 py-4 text-sm tabular-nums">
          {posting.facts.map(fact => <span key={fact}>{fact}</span>)}
        </div>
      )}

      {posting.blocks.map(block => (
        <section key={block.id} className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{block.title}</h2>
          {block.lead && <p className="whitespace-pre-line text-sm leading-7">{block.lead}</p>}
          {block.bullets.length > 0 && (
            <ul className="space-y-2 text-sm leading-7">
              {block.bullets.map(bullet => (
                <li key={bullet} className="flex gap-3">
                  <span aria-hidden className="mt-[0.6rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                  <span className="min-w-0 whitespace-pre-line">{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {/* Der Satz ist kein Kleingedrucktes: er sagt dem Recruiter, dass er
          diese Fassung weitergeben darf -- und warum der Firmenname fehlt,
          selbst wenn er ihn kennt. */}
      <p className="flex items-start gap-2 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
        <LockKeyhole className="mt-1 h-3.5 w-3.5 shrink-0" />
        <span>
          Aus den Angaben des Kunden erzeugt. Ohne Honorar, ohne interne Notizen und ohne
          Firmennamen — diese Fassung kannst du einem Kandidaten zeigen. Was du als Recruiter
          zusätzlich weißt, steht im <Link to={`/recruiter/jobs/${job.id}`} className="underline underline-offset-2 hover:text-foreground">Mandatsbriefing</Link>.
        </span>
      </p>
    </div>
  </DashboardLayout>;
}
