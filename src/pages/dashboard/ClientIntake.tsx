import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import ClientDashboard from './ClientDashboard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CaptureStep } from '@/components/intake/guest/CaptureStep';
import { SubmitStep } from '@/components/dashboard/intake/SubmitStep';
import { useClientIntake } from '@/hooks/useClientIntake';
import { useOrganization, useOrganizationMembers } from '@/hooks/useOrganization';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { remoteLabel, levelLabel } from '@/lib/intakeMapping';
import { knownFromForm, completeness as katalogCompleteness } from '@/lib/briefCatalog';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Circle, Clock, Loader2, Mail, Plus,
} from 'lucide-react';

/**
 * Jobaufnahme im Kunden-Dashboard -- /dashboard/aufnahme[/:jobId], als grosses
 * Fenster ueber dem Dashboard.
 *
 * DIESELBE Aufnahme wie der Link /start: CaptureStep mit Profil, Firma,
 * Rahmendaten und Briefing. Kontakt und E-Mail-Bestaetigung entfallen, weil
 * das Konto beides schon ist. Danach nur noch "Einreichen" -- mit
 * Rahmenvertrag ohne Paketwahl und ohne Unterschrift.
 */

type Step = 'capture' | 'submit' | 'done';

export default function ClientIntake() {
  const { jobId: jobIdParam } = useParams<{ jobId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const seed = (location.state ?? {}) as { seedText?: string; seedFile?: File; from?: string };
  const zurueck = seed.from ?? '/dashboard';

  const intake = useClientIntake(jobIdParam);
  const {
    capture, company, saving, lastSavedAt, saveError, loadError, profile, target, framework: realFramework,
    frameworkLoading, packages, updateCapture, updateCompany, saveDraft, submit, askAi, parseText, parseUrl,
    parsePdf, enrichCompany,
  } = intake;

  /**
   * Vorschau-Schalter, nur lokal (npm run dev): ?vorschau=rv zeigt den Weg mit
   * Beispiel-Rahmenvertrag, ?vorschau=ohne den Weg ohne. In beiden Faellen
   * schreibt "Einreichen" nichts -- Entwuerfe werden weiter normal gespeichert.
   */
  const vorschau = import.meta.env.DEV ? new URLSearchParams(location.search).get('vorschau') : null;
  const corePkg = packages.find((p) => p.package_key === 'core');
  const framework =
    vorschau === 'rv'
      ? {
          id: 'vorschau', agreement_number: 'RV-VORSCHAU', package_key: 'core',
          fee_percent: corePkg?.client_fee_pct ?? 20, name: corePkg?.public_name ?? 'Matchunt Core',
          continuity_days: null, agreed_at: null,
        }
      : vorschau === 'ohne' ? null : realFramework;

  const [step, setStep] = useState<Step>('capture');
  const [done, setDone] = useState<{ jobId: string; status: string; packageName: string | null; upgraded: boolean } | null>(null);
  const [delegateOpen, setDelegateOpen] = useState(false);

  const isOwner = vorschau ? true : target?.myRole === 'owner';
  const needsInternalApproval = target?.status === 'pending_client_approval';
  const hasFramework = !!framework || (!isOwner && !frameworkLoading);
  const steps = hasFramework || needsInternalApproval
    ? [{ key: 'capture', label: 'Position' }, { key: 'submit', label: needsInternalApproval ? 'Freigabe' : 'Einreichen' }]
    : [{ key: 'capture', label: 'Position' }, { key: 'submit', label: 'Paket & Anfragen' }];

  const rows = useMemo(() => {
    const b = capture?.built;
    if (!b || !capture) return [];
    const isFreelance = capture.type === 'freelance';
    const money = (min: number | null | undefined, max: number | null | undefined, suffix: string) => {
      if (min == null && max == null) return '—';
      if (min != null && max != null) return `${min.toLocaleString('de-DE')}–${max.toLocaleString('de-DE')} ${suffix}`;
      return `${(min ?? max)!.toLocaleString('de-DE')} ${suffix}`;
    };
    const known = capture.dyn.catalog?.known ?? {};
    const beantwortet = Object.values(known).filter((k: any) => k?.from === 'answer').length;
    return [
      { label: 'Position', value: b.title || '—' },
      { label: 'Standort', value: [b.location, remoteLabel(b.remote_type)].filter(Boolean).join(' · ') || '—' },
      { label: 'Erfahrung', value: levelLabel(b.experience_level) },
      {
        label: isFreelance ? 'Tagessatz' : 'Gehaltsband',
        value: isFreelance
          ? money(capture.freelance.dayRateMin, capture.freelance.dayRateMax, '€ / Tag')
          : money(b.salary_min, b.salary_max, '€ p. a.'),
      },
      { label: 'Muss', value: b.must_haves.length ? b.must_haves.join(' · ') : '—' },
      { label: 'Kann', value: b.nice_to_haves.length ? b.nice_to_haves.join(' · ') : '—' },
      { label: 'Briefing', value: beantwortet ? `${beantwortet} Angaben beantwortet` : 'noch nicht beantwortet' },
      { label: 'Vertragsart', value: isFreelance ? 'Contracting' : 'Festanstellung' },
    ];
  }, [capture]);

  const openQuestions = useMemo(() => {
    if (!capture?.built) return 0;
    const known = {
      ...knownFromForm({ built: capture.built, freelance: capture.freelance, contract: capture.type, flexibility: capture.flexibility }),
      ...(capture.dyn.catalog?.known ?? {}),
    };
    return katalogCompleteness(known, capture.type).feldOffen;
  }, [capture]);

  const exampleSalary = useMemo(() => {
    const b = capture?.built;
    if (!b) return null;
    if (b.salary_min && b.salary_max) return Math.round((b.salary_min + b.salary_max) / 2);
    return b.salary_max ?? b.salary_min ?? null;
  }, [capture]);

  const goSubmit = async () => {
    await saveDraft();
    setStep('submit');
    window.scrollTo({ top: 0 });
  };

  const later = async () => {
    const ok = await saveDraft();
    if (ok) {
      toast.success('Entwurf gespeichert — auf dem Dashboard unter „Weitermachen“.');
      navigate(zurueck);
    } else {
      toast.error('Speichern fehlgeschlagen. Bitte noch nicht schließen.');
    }
  };

  const doSubmit = async (choice: Parameters<typeof submit>[0]) => {
    if (vorschau) {
      await saveDraft();
      const pkg = choice ? packages.find((p) => p.package_key === choice.package_key) : null;
      toast.info('Vorschau: nichts eingereicht, der Entwurf bleibt gespeichert.');
      setDone({ jobId: intake.jobId ?? '', status: needsInternalApproval ? 'pending_client_approval' : 'pending_approval', packageName: pkg?.public_name ?? null, upgraded: !!choice?.upgraded });
      setStep('done');
      window.scrollTo({ top: 0 });
      return;
    }
    const res = await submit(choice);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    const pkg = choice ? packages.find((p) => p.package_key === choice.package_key) : null;
    setDone({ jobId: res.jobId, status: res.status, packageName: pkg?.public_name ?? null, upgraded: !!choice?.upgraded });
    setStep('done');
    window.scrollTo({ top: 0 });
  };

  // Personio und Mail sind sichtbar, aber noch nicht angeschlossen -- und
  // sagen das auch. Keine zweite Attrappe wie die alte Integrationsseite.
  const entryExtras = (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => toast.info('Personio ist in dieser Vorschau noch nicht angeschlossen.')}
        className="flex w-full items-start gap-3 rounded-xl border border-dashed p-4 text-left text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <Building2 className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            Aus Personio <span className="rounded-full border px-2 py-0.5 text-[10px]">Vorschau</span>
          </span>
          <span className="mt-0.5 block text-sm">Veröffentlichte Stellen von Ihrer Karriereseite übernehmen.</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => toast.info('Stellen per Mail sind in dieser Vorschau noch nicht angeschlossen.')}
        className="flex w-full items-start gap-3 rounded-xl border border-dashed p-4 text-left text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <Mail className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            Per Mail weiterleiten <span className="rounded-full border px-2 py-0.5 text-[10px]">Vorschau</span>
          </span>
          <span className="mt-0.5 block text-sm">An Ihre eigene Matchunt-Adresse, erscheint dann als Entwurf.</span>
        </span>
      </button>
    </div>
  );

  const title = capture?.built?.title?.trim();

  /** Schliessen = speichern. Nichts geht verloren, der Entwurf steht danach
   *  auf dem Dashboard unter "Weitermachen". */
  const close = async () => {
    if (step !== 'done') {
      const ok = await saveDraft();
      if (!ok) {
        toast.error('Speichern fehlgeschlagen. Bitte noch nicht schließen.');
        return;
      }
      if (intake.jobId && intake.status === 'draft') toast.success('Entwurf gespeichert — auf dem Dashboard unter „Weitermachen“.');
      else if (intake.jobId) toast.success('Änderungen gespeichert.');
    }
    navigate(zurueck);
  };

  return (
    <>
      {/* Das Fenster liegt ueber dem Dashboard -- der Kunde bleibt sichtbar in
          seinem Konto, wie beim frueheren Stellen-Fenster. */}
      <ClientDashboard />

      <Dialog open onOpenChange={(o) => { if (!o) void close(); }}>
        <DialogContent
          className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Kopf: Titel, Schrittleiste, Speicherstand */}
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 pr-12 md:px-6 md:pr-14">
            <DialogTitle className="truncate text-base font-semibold">
              {title || 'Neue Position aufnehmen'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Position aufnehmen, Briefing beantworten und bei Matchunt einreichen.
            </DialogDescription>
            {step !== 'done' && (
              <ol className="ml-auto flex items-center gap-1.5 text-xs">
                {steps.map((s, i) => {
                  const active = s.key === step;
                  const past = step === 'submit' && s.key === 'capture';
                  return (
                    <li key={s.key} className="flex items-center gap-1.5">
                      {i > 0 && <span className="h-px w-4 bg-border" />}
                      <button
                        type="button"
                        disabled={!past}
                        onClick={() => past && setStep('capture')}
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2.5 py-1',
                          active ? 'bg-primary text-primary-foreground' : past ? 'text-emerald-600 hover:underline' : 'text-muted-foreground',
                        )}
                      >
                        {past ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>} {s.label}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
            {step === 'capture' && (
              <span className="text-xs text-muted-foreground">
                {saving ? 'Speichert …' : saveError ? <span className="text-destructive">{saveError}</span> : lastSavedAt ? 'Gespeichert' : ''}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
            {import.meta.env.DEV && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-500/50 px-3 py-2 text-xs">
                <span className="font-medium text-amber-600">Test-Vorschau (nur lokal):</span>
                {[
                  { key: null, label: 'echte Daten' },
                  { key: 'rv', label: 'mit Rahmenvertrag' },
                  { key: 'ohne', label: 'ohne Rahmenvertrag' },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => {
                      const u = new URL(window.location.href);
                      if (o.key) u.searchParams.set('vorschau', o.key); else u.searchParams.delete('vorschau');
                      navigate(u.pathname + u.search, { state: location.state, replace: true });
                    }}
                    className={cn('rounded-full border px-2 py-0.5', vorschau === o.key && 'border-amber-500 bg-amber-500/10')}
                  >
                    {o.label}
                  </button>
                ))}
                {vorschau && <span className="text-muted-foreground">· Einreichen schreibt nichts</span>}
              </div>
            )}

            {intake.doppelt && step === 'capture' && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
            <span>
              Sie haben bereits einen Entwurf „{title}“ vom{' '}
              {new Date(intake.doppelt.updated_at).toLocaleDateString('de-DE')}.
            </span>
            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                onClick={async () => {
                  const id = await intake.zumVorhandenen();
                  if (id) window.location.assign(`/dashboard/aufnahme/${id}`);
                }}
              >
                Dort weitermachen
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={intake.verwerfeDoppelt}>
                Trotzdem neu
              </Button>
            </div>
          </div>
        )}

        {loadError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{loadError}</AlertDescription>
              </Alert>
            )}

            {!capture && (
              <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Entwurf wird geladen …
              </div>
            )}

            {capture && step === 'capture' && (
              <CaptureStep
                state={capture}
                onState={updateCapture}
                companyDefaults={{
                  industry: profile?.industry ?? null,
                  size: profile?.team_size_range ?? profile?.company_size ?? (profile?.headcount ? String(profile.headcount) : null),
                  company_name: profile?.company_name ?? null,
                  location: null,
                }}
                company={company}
                onCompany={updateCompany}
                onEnrich={enrichCompany}
                askAi={askAi}
                parseText={parseText}
                parseUrl={parseUrl}
                parsePdf={parsePdf}
                onNext={goSubmit}
                onResumeLater={later}
                nextLabel={hasFramework || needsInternalApproval ? 'Weiter zum Einreichen' : 'Weiter zum Paket'}
                entrySub="Meist in drei bis fünf Minuten. Ihre Angaben werden fortlaufend gespeichert."
                entryExtras={entryExtras}
                autoBuildText={seed.seedText ?? null}
                autoBuildFile={seed.seedFile ?? null}
            fertigesProfil
            firmaFest={intake.firmaFest}
              />
            )}

            {capture && step === 'submit' && (
              <SubmitStep
                rows={rows}
                framework={framework ?? null}
                frameworkLoading={frameworkLoading}
                frameworkReadable={isOwner}
                packages={packages}
                isFreelance={capture.type === 'freelance'}
                needsInternalApproval={needsInternalApproval}
                exampleSalary={exampleSalary}
                openQuestions={openQuestions}
                signerName={String((user?.user_metadata as any)?.full_name ?? user?.email ?? '')}
                onBack={() => setStep('capture')}
                onDelegate={() => setDelegateOpen(true)}
                onSubmit={doSubmit}
              />
            )}

            {step === 'done' && done && (
              <DoneStep
                title={title || 'Die Position'}
                done={done}
                framework={framework ?? null}
                onAnother={() => window.location.assign('/dashboard/aufnahme')}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DelegateDialog
        open={delegateOpen}
        onOpenChange={setDelegateOpen}
        title={title || 'Position'}
        onBeforeSend={saveDraft}
        jobId={intake.jobId}
      />
    </>
  );
}

// ---- Danke -----------------------------------------------------------------

function DoneStep({
  title, done, framework, onAnother,
}: {
  title: string;
  done: { jobId: string; status: string; packageName: string | null; upgraded: boolean };
  framework: { agreement_number: string } | null;
  onAnother: () => void;
}) {
  const internal = done.status === 'pending_client_approval';
  const schritte = internal
    ? ['Freigabe durch Ihre Personalabteilung', 'Prüfung durch Matchunt', 'Stelle geht live']
    : ['Prüfung durch Matchunt', 'Auftragsbestätigung per Mail', 'Stelle geht live', 'Erste anonyme Kandidaten'];
  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15">
        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">
        {internal ? `${title} ist zur Freigabe geschickt` : `${title} ist eingereicht`}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {internal
          ? 'Ihre Personalabteilung wurde benachrichtigt und gibt die Position frei.'
          : framework
            ? done.upgraded && done.packageName
              ? `${done.packageName} für diese Position · sonst gilt Rahmenvertrag ${framework.agreement_number}.`
              : `Läuft unter Rahmenvertrag ${framework.agreement_number}, keine Unterschrift nötig.`
            : 'Wir prüfen Ihre Anfrage und melden uns.'}
      </p>
      <div className="mt-5 space-y-2.5 rounded-xl border bg-card p-4 text-sm">
        {schritte.map((s, i) => (
          <div key={s} className={cn('flex items-center gap-2.5', i > 0 && 'text-muted-foreground')}>
            {/* Kein Lade-Kreisel: hier laedt nichts, der Schritt liegt bei Matchunt. */}
            {i === 0 ? <Clock className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground/40" />}
            {s}
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild className="gap-1.5">
          <Link to={`/dashboard/jobs/${done.jobId}`}>Zur Stelle <ArrowRight className="h-4 w-4" /></Link>
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={onAnother}>
          <Plus className="h-4 w-4" /> Weitere Position aufnehmen
        </Button>
        <Button variant="ghost" asChild>
          <Link to="/dashboard">Zum Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

// ---- An Kollegen weitergeben ----------------------------------------------

function DelegateDialog({
  open, onOpenChange, title, onBeforeSend, jobId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  onBeforeSend: () => Promise<boolean>;
  jobId: string | null;
}) {
  const { user } = useAuth();
  const { organizations } = useOrganization();
  const { members } = useOrganizationMembers(organizations?.[0]?.id);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const active = (members || []).filter((m: any) => m.status === 'active' && m.user_id !== user?.id);

  const send = async (m: any) => {
    setBusy(m.user_id);
    const ok = await onBeforeSend();
    if (!ok || !jobId) {
      setBusy(null);
      toast.error('Bitte zuerst einen Jobtitel angeben, dann weitergeben.');
      return;
    }
    const { error } = await supabase.from('notifications').insert({
      user_id: m.user_id,
      type: 'intake_delegated',
      title: 'Positionsaufnahme an Sie übergeben',
      message: `Bitte ergänzen Sie „${title}“.${note.trim() ? ` Nachricht: ${note.trim()}` : ''}`,
      related_type: 'job',
      related_id: jobId,
    } as any);
    setBusy(null);
    if (error) {
      toast.error('Weitergeben fehlgeschlagen.');
      return;
    }
    toast.success(`An ${m.profiles?.full_name || m.profiles?.email || 'Kollegen'} weitergegeben.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>An Kollegen weitergeben</DialogTitle>
          <DialogDescription>Der Entwurf wird gespeichert, die Person bekommt eine Benachrichtigung.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch niemand in Ihrem Team. <Link to="/dashboard/team" className="underline">Kollegen einladen</Link>
            </p>
          ) : (
            active.map((m: any) => (
              <button
                key={m.id}
                type="button"
                disabled={!!busy}
                onClick={() => send(m)}
                className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/40"
              >
                <span>{m.profiles?.full_name || m.profiles?.email || m.user_id}</span>
                <span className="text-xs text-muted-foreground">{busy === m.user_id ? 'wird übergeben …' : m.role}</span>
              </button>
            ))
          )}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nachricht (optional), z. B. „Bitte Gehalt und Start ergänzen“" rows={2} className="text-sm" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
