import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Trans, useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';
import ClientDashboard from './ClientDashboard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { minutenOhneAnzeige } from '@/components/intake/guest/etappenZeit';
import { CaptureStep } from '@/components/intake/guest/CaptureStep';
import { SubmitStep } from '@/components/dashboard/intake/SubmitStep';
import { contractingUnterRahmen, useClientIntake } from '@/hooks/useClientIntake';
import { useOrganization, useOrganizationMembers } from '@/hooks/useOrganization';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { remoteLabel, levelLabel } from '@/lib/intakeMapping';
import { knownFromForm, completeness as katalogCompleteness } from '@/lib/briefCatalog';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Loader2, Mail, Plus,
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
  const { t, i18n } = useTranslation(['intake', 'intakeCatalog']);
  const locale = intlLocale(i18n.language);
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
   * Beispiel-Rahmenvertrag, ?vorschau=rv1 mit einem der Fassung 1 (regelt kein
   * Contracting), ?vorschau=ohne den Weg ohne. In allen Faellen schreibt
   * "Einreichen" nichts -- Entwuerfe werden weiter normal gespeichert.
   */
  const vorschau = import.meta.env.DEV ? new URLSearchParams(location.search).get('vorschau') : null;
  const corePkg = packages.find((p) => p.package_key === 'core');
  const framework =
    vorschau === 'rv' || vorschau === 'rv1'
      ? {
          id: 'vorschau', agreement_number: vorschau === 'rv1' ? 'RV-VORSCHAU-1' : 'RV-VORSCHAU', package_key: 'core',
          fee_percent: corePkg?.client_fee_pct ?? 20, name: corePkg?.public_name ?? 'Matchunt Core',
          continuity_days: null, agreed_at: null, template_version: vorschau === 'rv1' ? 1 : 2,
        }
      : vorschau === 'ohne' ? null : realFramework;

  const [step, setStep] = useState<Step>('capture');
  const [done, setDone] = useState<{ titel: string; text: string; vorschau: boolean } | null>(null);
  const [delegateOpen, setDelegateOpen] = useState(false);

  const isOwner = vorschau ? true : target?.myRole === 'owner';
  const needsInternalApproval = target?.status === 'pending_client_approval';
  const hasFramework = !!framework || (!isOwner && !frameworkLoading);
  // Contracting hat keinen Paketschritt. Ohne Unterschrift laeuft es nur unter
  // einem Rahmenvertrag ab Fassung 2, sonst wird angefragt.
  const isContracting = capture?.type === 'freelance';
  const contractingDirekt = contractingUnterRahmen(framework) || (!isOwner && !frameworkLoading);
  const submitLabel = needsInternalApproval
    ? t('clientIntake.stepApproval')
    : isContracting
      ? contractingDirekt ? t('clientIntake.stepSubmit') : t('clientIntake.stepRequest')
      : hasFramework ? t('clientIntake.stepSubmit') : t('clientIntake.stepPackageRequest');
  const steps = [{ key: 'capture', label: t('clientIntake.stepPosition') }, { key: 'submit', label: submitLabel }];

  const rows = useMemo(() => {
    const b = capture?.built;
    if (!b || !capture) return [];
    const isFreelance = capture.type === 'freelance';
    const money = (min: number | null | undefined, max: number | null | undefined, key: 'clientIntake.moneyAllIn' | 'clientIntake.moneyPerYear') => {
      if (min == null && max == null) return '—';
      if (min != null && max != null) return t(key, { amount: `${min.toLocaleString(locale)}–${max.toLocaleString(locale)}` });
      return t(key, { amount: (min ?? max)!.toLocaleString(locale) });
    };
    const known = capture.dyn.catalog?.known ?? {};
    const beantwortet = Object.values(known).filter((k: any) => k?.from === 'answer').length;
    // Muss/Kann nach der Einstufung des Kunden, nicht nach der ersten Liste der KI
    // (built.must_haves): herabgestufte Kriterien standen sonst weiter unter Muss.
    const flex = (capture.flexibility ?? {}) as Record<string, string>;
    const alle = [...new Set([...b.must_haves, ...b.nice_to_haves].map((k) => String(k).trim()).filter(Boolean))];
    const eingestuft = alle.some((k) => flex[k]);
    const muss = eingestuft ? alle.filter((k) => flex[k] === 'fix') : b.must_haves;
    const kann = eingestuft ? alle.filter((k) => flex[k] !== 'fix') : b.nice_to_haves;
    return [
      ...(intake.firmaFest?.name
        ? [{
            label: t('clientIntake.rowCompany'),
            value: intake.firmaFest.inPruefung ? t('clientIntake.companyInReview', { name: intake.firmaFest.name }) : intake.firmaFest.name,
          }]
        : []),
      { label: t('clientIntake.rowPosition'), value: b.title || '—' },
      { label: t('shared.location'), value: [b.location, remoteLabel(b.remote_type)].filter(Boolean).join(' · ') || '—' },
      { label: t('shared.experience'), value: levelLabel(b.experience_level) },
      {
        // Wie auf /start: das Budget des Kunden, alles inklusive -- kein Satz des Spezialisten.
        label: isFreelance ? t('clientIntake.rowBudgetPerDay') : t('clientIntake.rowSalaryBand'),
        value: isFreelance
          ? money(capture.freelance.dayRateMin, capture.freelance.dayRateMax, 'clientIntake.moneyAllIn')
          : money(b.salary_min, b.salary_max, 'clientIntake.moneyPerYear'),
      },
      { label: t('clientIntake.rowMust'), value: muss.length ? muss.join(' · ') : '—' },
      { label: t('clientIntake.rowNice'), value: kann.length ? kann.join(' · ') : '—' },
      { label: t('clientIntake.rowBriefing'), value: beantwortet ? t('clientIntake.briefingAnswered', { count: beantwortet }) : t('clientIntake.briefingNone') },
      { label: t('clientIntake.rowContractType'), value: isFreelance ? t('shared.contracting') : t('shared.permanent') },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture, intake.firmaFest?.name, intake.firmaFest?.inPruefung, t, locale]);

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
      toast.success(t('clientIntake.draftSaved'));
      navigate(zurueck);
    } else {
      toast.error(t('clientIntake.saveFailedDontClose'));
    }
  };

  /**
   * Das Abschlussfenster nach dem Einreichen (Entscheidung 24.09.2026):
   * "Ihre Stelle wurde eingereicht" mit drei Wegen -- Meine Jobs, weitere
   * Stelle, Dashboard. Ohne die fruehere Liste mit vier Schritten: der Stand
   * steht jetzt an der Stelle selbst (Jobliste, Detail, Dashboard), und die
   * "Auftragsbestaetigung per Mail" darin gab es gar nicht.
   */
  const abschluss = (status: string, choice: Parameters<typeof submit>[0], nurVorschau: boolean) => {
    const pkg = choice ? packages.find((p) => p.package_key === choice.package_key) : null;
    const internal = status === 'pending_client_approval';
    // Contracting laeuft erst ab Fassung 2 ohne Unterschrift unter dem Rahmenvertrag.
    const unterRv = framework && (!isContracting || contractingUnterRahmen(framework));
    const text = internal
      ? t('clientIntake.doneInternal')
      : unterRv
        ? choice?.upgraded && pkg?.public_name
          ? t('clientIntake.doneUpgrade', { name: pkg.public_name, number: framework.agreement_number })
          : t('clientIntake.doneFramework', { number: framework.agreement_number })
        : t('clientIntake.doneReview');
    setDone({
      titel: internal ? t('clientIntake.doneTitleInternal') : t('clientIntake.doneTitle'),
      // Ganze Sätze hintereinander, keine Bruchstücke.
      text: `${text} ${internal ? t('clientIntake.doneTrackInternal') : t('clientIntake.doneTrack')}`,
      vorschau: nurVorschau,
    });
    setStep('done');
    window.scrollTo({ top: 0 });
  };

  const doSubmit = async (choice: Parameters<typeof submit>[0]) => {
    if (vorschau) {
      await saveDraft();
      toast.info('Vorschau: nichts eingereicht, der Entwurf bleibt gespeichert.');
      abschluss(needsInternalApproval ? 'pending_client_approval' : 'pending_approval', choice, true);
      return;
    }
    const res = await submit(choice);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    abschluss(res.status, choice, false);
  };

  // Personio und Mail sind sichtbar, aber noch nicht angeschlossen -- und
  // sagen das auch. Keine zweite Attrappe wie die alte Integrationsseite.
  const entryExtras = (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => toast.info(t('clientIntake.personioToast'))}
        className="flex w-full items-start gap-3 rounded-xl border border-dashed p-4 text-left text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <Building2 className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            {t('clientIntake.personioTitle')} <span className="rounded-full border px-2 py-0.5 text-[10px]">{t('clientIntake.previewBadge')}</span>
          </span>
          <span className="mt-0.5 block text-sm">{t('clientIntake.personioText')}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => toast.info(t('clientIntake.mailToast'))}
        className="flex w-full items-start gap-3 rounded-xl border border-dashed p-4 text-left text-muted-foreground transition-colors hover:bg-muted/40"
      >
        <Mail className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          <span className="flex items-center gap-2 font-medium text-foreground">
            {t('clientIntake.mailTitle')} <span className="rounded-full border px-2 py-0.5 text-[10px]">{t('clientIntake.previewBadge')}</span>
          </span>
          <span className="mt-0.5 block text-sm">{t('clientIntake.mailText')}</span>
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
        toast.error(t('clientIntake.saveFailedDontClose'));
        return;
      }
      if (intake.jobId && intake.status === 'draft') toast.success(t('clientIntake.draftSaved'));
      else if (intake.jobId) toast.success(t('clientIntake.changesSaved'));
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
          className={cn(
            'flex flex-col gap-0 overflow-hidden p-0',
            // Der Abschluss ist eine kurze Nachricht -- im grossen Aufnahme-
            // Fenster stand sie verloren in 92 % der Hoehe (24.09.2026).
            step === 'done' ? 'w-[92vw] max-w-xl' : 'h-[92vh] w-[96vw] max-w-6xl',
          )}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {/* Kopf: Titel, Schrittleiste, Speicherstand */}
          <div className={cn(
            'flex flex-wrap items-center gap-3 border-b px-4 py-3 pr-12 md:px-6 md:pr-14',
            step === 'done' && 'sr-only',
          )}>
            <DialogTitle className="truncate text-base font-semibold">
              {title || t('clientIntake.dialogTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('clientIntake.dialogDescription')}
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
          </div>

          <div className={cn('flex-1 overflow-y-auto', step === 'done' ? 'p-6' : 'px-4 py-5 md:px-6')}>
            {/* Nur lokal (npm run dev) sichtbar, deshalb nicht übersetzt. */}
            {import.meta.env.DEV && step !== 'done' && (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-amber-500/50 px-3 py-2 text-xs">
                <span className="font-medium text-amber-600">Test-Vorschau (nur lokal):</span>
                {[
                  { key: null, label: 'echte Daten' },
                  { key: 'rv', label: 'mit Rahmenvertrag' },
                  { key: 'rv1', label: 'mit altem Rahmenvertrag (Fassung 1)' },
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
          /* Der Hinweis schwebt, statt die Seite beim Tippen nach unten zu
             schieben -- sonst traf der naechste Klick daneben (Durchklick 04.11.2026). */
          <div className="fixed left-1/2 top-3 z-50 flex w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-background px-3 py-2 text-sm shadow-lg">
            <span>
              {t('clientIntake.duplicate', { title, date: new Date(intake.doppelt.updated_at).toLocaleDateString(locale) })}
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
                {t('clientIntake.continueThere')}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={intake.verwerfeDoppelt}>
                {t('clientIntake.newAnyway')}
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
                <Loader2 className="h-4 w-4 animate-spin" /> {t('clientIntake.draftLoading')}
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
                nextLabel={hasFramework || needsInternalApproval || isContracting ? t('clientIntake.nextToSubmit') : t('clientIntake.nextToPackage')}
                entrySub={t('clientIntake.entrySub', { minutes: minutenOhneAnzeige('full-time') })}
                entryExtras={entryExtras}
                autoBuildText={seed.seedText ?? null}
                autoBuildFile={seed.seedFile ?? null}
            fertigesProfil
            firmaFest={intake.firmaFest}
            firmen={intake.firmen}
            firmaId={intake.firmaId}
            onFirma={intake.waehleFirma}
            speicherStand={saving ? t('clientIntake.saving') : saveError ? <span className="text-destructive">{saveError}</span> : lastSavedAt ? t('clientIntake.saved') : null}
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
                contracting={capture.type === 'freelance'
                  ? { dayRateMin: capture.freelance.dayRateMin ?? null, dayRateMax: capture.freelance.dayRateMax ?? null }
                  : null}
                needsInternalApproval={needsInternalApproval}
                exampleSalary={exampleSalary}
                openQuestions={openQuestions}
                signerName={String((user?.user_metadata as any)?.full_name ?? user?.email ?? '')}
                onBack={() => setStep('capture')}
                onDelegate={() => setDelegateOpen(true)}
                onSubmit={doSubmit}
                sperre={vorschau ? null : intake.firmaSperre}
              />
            )}

            {step === 'done' && done && (
              <Abschluss
                done={done}
                jobTitel={title || t('clientIntake.thePosition')}
                onJobs={() => navigate('/dashboard/jobs?tab=review')}
                onWeitere={() => window.location.assign('/dashboard/aufnahme')}
                onDashboard={() => navigate('/dashboard')}
              />
            )}

          </div>
        </DialogContent>
      </Dialog>

      <DelegateDialog
        open={delegateOpen}
        onOpenChange={setDelegateOpen}
        title={title || t('clientIntake.positionFallback')}
        onBeforeSend={saveDraft}
        jobId={intake.jobId}
      />
    </>
  );
}

// ---- Abschluss -------------------------------------------------------------

function Abschluss({
  done, jobTitel, onJobs, onWeitere, onDashboard,
}: {
  done: { titel: string; text: string; vorschau: boolean };
  jobTitel: string;
  onJobs: () => void;
  onWeitere: () => void;
  onDashboard: () => void;
}) {
  const { t } = useTranslation(['intake', 'intakeCatalog']);
  return (
    <div>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      </div>
      <h2 className="text-xl font-bold tracking-tight">{done.titel}</h2>
      <p className="mt-1 text-sm font-medium">{jobTitel}</p>
      <p className="mt-2 text-sm text-muted-foreground">{done.text}</p>
      {done.vorschau && (
        <p className="mt-2 text-xs text-amber-600">Vorschau: nichts eingereicht, die Stelle ist weiter ein Entwurf.</p>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="gap-1.5" onClick={onJobs}>
          {t('clientIntake.toMyJobs')} <ArrowRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={onWeitere}>
          <Plus className="h-4 w-4" /> {t('clientIntake.submitAnother')}
        </Button>
        <Button variant="ghost" className="px-3" onClick={onDashboard}>
          {t('clientIntake.toDashboard')}
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
  const { t } = useTranslation(['intake', 'intakeCatalog']);
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
      toast.error(t('clientIntake.delegateNeedTitle'));
      return;
    }
    // Titel und Text der Benachrichtigung werden gespeichert und vom Kollegen gelesen,
    // dessen Sprache hier nicht bekannt ist: sie bleiben deutsch.
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
      toast.error(t('clientIntake.delegateFailed'));
      return;
    }
    toast.success(t('clientIntake.delegated', { name: m.profiles?.full_name || m.profiles?.email || t('clientIntake.colleague') }));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('clientIntake.delegateTitle')}</DialogTitle>
          <DialogDescription>{t('clientIntake.delegateDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Trans t={t} i18nKey="clientIntake.noTeam" components={{ invite: <Link to="/dashboard/team" className="underline" /> }} />
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
                <span className="text-xs text-muted-foreground">{busy === m.user_id ? t('clientIntake.delegating') : m.role}</span>
              </button>
            ))
          )}
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('clientIntake.notePlaceholder')} rows={2} className="text-sm" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
