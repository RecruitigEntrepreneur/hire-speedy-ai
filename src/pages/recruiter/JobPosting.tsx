import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2, LockKeyhole, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { buildAnsprache, buildJobPosting, postingAsText, type Kontakt } from '@/lib/jobPosting';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';
import { AnzeigeAnsicht } from '@/components/recruiter/AnzeigeAnsicht';
import { AnspracheTeilen, type Kanal } from '@/components/recruiter/AnspracheTeilen';

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
 *
 * Seit 29.09.2026 „Anzeige & Ansprache": rechts (auf dem Handy unten) liegen
 * fertige Texte für LinkedIn, E-Mail und Telefon; die Anzeige nennt den
 * Headhunter als Ansprechperson (aus seinem Profil).
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
  const [kontakt, setKontakt] = useState<Kontakt | null>(null);
  const [vorname, setVorname] = useState('');
  const [kanal, setKanal] = useState<Kanal>('linkedin');
  const [blattOffen, setBlattOffen] = useState(false);
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

  // Die Ansprechperson in der Anzeige ist der Headhunter selbst.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void supabase.from('profiles').select('full_name, email, phone, linkedin_url').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setKontakt({ name: data.full_name, email: data.email, phone: data.phone, linkedin: data.linkedin_url });
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) return <DashboardLayout><div role="status" className="flex min-h-64 items-center justify-center gap-3 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Anzeige wird geladen …</div></DashboardLayout>;

  if (error || !job) return <DashboardLayout><div className="mx-auto max-w-lg space-y-5 py-16 text-center">
    <h1 className="text-xl font-semibold">Anzeige nicht verfügbar</h1>
    <p role="alert" className="text-sm text-muted-foreground">{error || 'Die Stelle ist nicht veröffentlicht oder für deinen Zugang nicht verfügbar.'}</p>
    <div className="flex flex-wrap justify-center gap-3">
      <Button variant="outline" onClick={reload}><RotateCcw />Erneut laden</Button>
      <Button variant="ghost" asChild><Link to="/recruiter/jobs"><ArrowLeft />Zurück zu Jobs</Link></Button>
    </div>
  </div></DashboardLayout>;

  const posting = buildJobPosting(job, kontakt);
  const ansprache = buildAnsprache(job, posting, vorname);
  const neueAnzeige = Boolean((job.formatted_content as { anzeige?: unknown } | null)?.anzeige);

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(postingAsText(posting));
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  };

  const oeffne = (k: Kanal) => { setKanal(k); setBlattOffen(true); };

  return <DashboardLayout>
    <div className="mx-auto max-w-6xl pb-28 lg:pb-16">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link to={`/recruiter/jobs/${job.id}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Zurück zum Briefing
        </Link>
        <Button variant="outline" size="sm" onClick={kopieren}>
          {copied ? <Check /> : <Copy />}{copied ? 'Kopiert' : 'Anzeige kopieren'}
        </Button>
      </div>
      {copyError && <p role="alert" className="mb-4 text-sm text-muted-foreground">Kopieren nicht möglich. Bitte den Text markieren und kopieren.</p>}

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-8">
          <AnzeigeAnsicht posting={posting} />

          {/* Der Satz ist kein Kleingedrucktes: er sagt dem Recruiter, dass er
              diese Fassung weitergeben darf -- und warum der Firmenname fehlt,
              selbst wenn er ihn kennt. */}
          <p className="flex items-start gap-2 border-t border-border pt-5 text-xs leading-6 text-muted-foreground">
            <LockKeyhole className="mt-1 h-3.5 w-3.5 shrink-0" />
            <span>
              {neueAnzeige
                ? 'Ohne Firmennamen, ohne Honorar. Texte von der KI aus den Angaben des Kunden formuliert, Beträge vom System eingesetzt, von Matchunt vor der Freigabe geprüft. '
                : 'Aus den Angaben des Kunden erzeugt. Ohne Honorar, ohne interne Notizen und ohne Firmennamen. '}
              Diese Fassung kannst du einem Kandidaten zeigen. Was du als Recruiter zusätzlich weißt, steht im{' '}
              <Link to={`/recruiter/jobs/${job.id}`} className="underline underline-offset-2 hover:text-foreground">Mandatsbriefing</Link>.
            </span>
          </p>
        </div>

        <aside aria-label="Zum Teilen" className="hidden space-y-3 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-24 lg:block">
          <h2 className="font-medium">Zum Teilen</h2>
          <AnspracheTeilen ansprache={ansprache} vorname={vorname} onVorname={setVorname} kanal={kanal} onKanal={setKanal} />
        </aside>
      </div>
    </div>

    {/* Handy: für die Seitenspalte ist kein Platz -- die drei Kanäle bleiben unten stehen. */}
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={() => oeffne('linkedin')}>LinkedIn</Button>
        <Button variant="outline" size="sm" onClick={() => oeffne('email')}>E-Mail</Button>
        <Button variant="outline" size="sm" onClick={() => oeffne('telefon')}>Telefon</Button>
      </div>
    </div>
    <Sheet open={blattOffen} onOpenChange={setBlattOffen}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader><SheetTitle>Zum Teilen</SheetTitle></SheetHeader>
        <div className="mt-4">
          <AnspracheTeilen ansprache={ansprache} vorname={vorname} onVorname={setVorname} kanal={kanal} onKanal={setKanal} />
        </div>
      </SheetContent>
    </Sheet>
  </DashboardLayout>;
}
