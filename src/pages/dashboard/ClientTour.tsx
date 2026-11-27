import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useClientGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { useTourData } from '@/components/client/tour/tourData';
import { DemoScope, type DemoLocation } from '@/components/client/tour/DemoScope';
import { ANIMATED_FILLS, closeOpenMenus, runAutofill, runMoment, showFill } from '@/components/client/tour/demoAutofill';
import { guideDemo } from '@/components/recruiter/guide/guideDemo';
import { useAuth } from '@/lib/auth';
import { useMyOrganization } from '@/hooks/useOrganization';
import { CLIENT_TOUR_PAGES, CLIENT_TOUR_SCENES, type ClientTourScene } from '@/lib/clientGuide';
import { DEMO_IDS, colleagueAddress, demoRegistry, demoWorld, type DemoJobRow } from '@/lib/clientDemoData';
import { STAGE_STALE_MS, loadStageFee, loadStageJob, stageFeeKey, stageJobKey } from '@/components/client/tour/stageQueries';
import { DEMO } from '@/lib/clientDemo';
import CandidateDetail from '@/pages/dashboard/CandidateDetail';
import ClientInterviews from '@/pages/dashboard/ClientInterviews';
import ClientAufgaben from '@/pages/dashboard/ClientAufgaben';
import ClientBesetzungen from '@/pages/dashboard/ClientBesetzungen';
import JobsList from '@/pages/dashboard/JobsList';
import ClientIntake from '@/pages/dashboard/ClientIntake';
import TeamManagement from '@/pages/organization/TeamManagement';

/**
 * Bühne des Kunden-Rundgangs, Demo-Modus (16.11.2026). Marko: „die ganze Seite ausgefüllt
 * sehen, wie es realistisch aussieht, damit der Kunde später nicht sagt, jetzt sieht es
 * anders aus.“ Darum zeigt die Bühne die ECHTEN Seiten der App (Aufgaben, Bewerberprofil mit
 * seinen Fenstern, Interviews, Besetzungen) in einem eigenen Adressraum (DemoScope) und
 * beantwortet ihre Datenabfragen mit einem Beispielkandidaten an der Stelle des Kunden
 * (lib/clientDemoData.ts). Gespeichert und gesendet wird nichts.
 *
 * Welches Bild, sagt der laufende Schritt (`step.scene`, CLIENT_TOUR_SCENES in lib/clientGuide.ts).
 */

const NS = ['clientGuide', 'offers'] as const;

export default function ClientTour() {
  const guide = useClientGuide();
  const scene = guide.step?.scene ? CLIENT_TOUR_SCENES[guide.step.scene] : undefined;
  const queryClient = useQueryClient();
  // Beim Verlassen der Bühne: alles Echte frisch laden, falls unterwegs etwas Beispiel mitlas.
  useEffect(() => () => { void queryClient.invalidateQueries(); }, [queryClient]);
  return scene && guide.step ? <DemoStage scene={scene} stepId={guide.step.id} index={guide.index} /> : <Idle />;
}

function Idle() {
  const { t } = useTranslation('clientGuide');
  const guide = useClientGuide();
  const navigate = useNavigate();
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-md py-16 text-center">
        <Compass className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t('demo.idle.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('demo.idle.text')}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate('/dashboard')}>{t('demo.idle.back')}</Button>
          <Button onClick={guide.start}>{t('demo.idle.start')}</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

/** Was das Beispiel von der echten Stelle und dem Konto braucht: Stelle, Honorarsatz, Firmenname. */
function useStageSource(jobId: string | null) {
  const { user } = useAuth();
  const { organization, isLoading: orgLoading } = useMyOrganization();
  const job = useQuery({
    queryKey: stageJobKey(jobId),
    enabled: !!jobId,
    staleTime: STAGE_STALE_MS,
    queryFn: () => loadStageJob(jobId!),
  });
  const fee = useQuery({
    queryKey: stageFeeKey(user?.id),
    enabled: !!user,
    staleTime: STAGE_STALE_MS,
    queryFn: loadStageFee,
  });
  const jobFee = Number((job.data as Record<string, unknown> | null | undefined)?.fee_percentage);
  return {
    ready: !!user && !orgLoading && (!jobId || !job.isLoading) && !fee.isLoading,
    job: job.data ?? null,
    feePercent: fee.data?.pct ?? (Number.isFinite(jobFee) && jobFee > 0 ? jobFee : null),
    packageKey: fee.data?.packageKey ?? null,
    companyName: (organization as { name?: string | null } | null)?.name ?? null,
    hasOrg: !!organization,
    user: user ? {
      id: user.id,
      email: user.email ?? '',
      name: String((user.user_metadata as Record<string, unknown> | undefined)?.full_name ?? '').trim() || (user.email ?? ''),
    } : null,
  };
}

function DemoStage({ scene, stepId, index }: { scene: ClientTourScene; stepId: string; index: number }) {
  const { t, i18n } = useTranslation(NS);
  const guide = useClientGuide();
  const outerNavigate = useNavigate();
  const tour = useTourData();
  const { ready, job, feePercent, packageKey, companyName, hasOrg, user } = useStageSource(tour.jobId);
  // Feste Uhr für die ganze Geschichte: Termine und Fristen springen zwischen den Schritten nicht.
  const [now] = useState(() => new Date());

  // Zurück innerhalb desselben Stands: frisch aufbauen, damit kein Fenster des späteren Schritts offen bleibt.
  const back = useRef({ index: -1, phase: '', n: 0 });
  if (index !== back.current.index) {
    const wentBack = index < back.current.index && back.current.phase === scene.phase;
    back.current = { index, phase: scene.phase, n: back.current.n + (wentBack ? 1 : 0) };
  }
  // Die volle Karte (live) hat eigene Daten: beim Wechsel frisch aufbauen.
  const scopeKey = `${scene.phase}${scene.live ? '+live' : ''}:${back.current.n}`;

  const lang = i18n.language;
  const userId = user?.id ?? null;
  const world = useMemo(() => (ready && user ? demoWorld({
    phase: scene.phase, tour, job, user, companyName, feePercent, packageKey, now, lang, liveJob: !!scene.live, hasOrg,
    t: i18n.getFixedT(lang, ['clientGuide', 'offers']) as (key: string, options?: Record<string, unknown>) => string,
  }) : null), [ready, userId, scene.phase, scene.live, tour, job, companyName, hasOrg, feePercent, packageKey, now, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const registry = useMemo(() => (world ? demoRegistry(world) : null), [world]);

  // Startadresse dieses Schritts; ein neues Objekt nur bei neuem Schritt.
  const location = useMemo<DemoLocation>(() => ({
    pathname: CLIENT_TOUR_PAGES[scene.page],
    search: scene.feedbackTask ? `?aufgabe=${encodeURIComponent(`feedback:${DEMO_IDS.interview}`)}` : scene.search ?? '',
    // Aufnahme: „Schließen“ führt auf „Meine Stellen“ der Bühne, nicht aus dem Beispiel heraus.
    state: scene.open ? { open: scene.open } : scene.page === 'intake' ? { from: CLIENT_TOUR_PAGES.jobs } : null,
  }), [stepId, scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Neuer Schritt: ein offenes Menü (Glocke aus „Zugesagt“) zuerst schließen. Als Layout-Effekt,
  // also bevor die Seite das Fenster des Schritts öffnet (state.open, in einem normalen Effekt).
  useLayoutEffect(() => { closeOpenMenus(); }, [stepId]);

  // Fenster so ausfüllen, wie es der Kunde täte.
  // Meldung oben rechts: nach dem Gespräch der Eindruck des Kandidaten, später die Zusage.
  const afterTalk = scene.phase === 'interviewed';
  const fillTexts = useMemo(() => ({
    impression: t('demo.fill.impression'), strengths: t('demo.fill.strengths'), concerns: t('demo.fill.concerns'),
    colleagueName: t('demo.fill.colleagueName'), colleagueEmail: colleagueAddress(t('demo.fill.colleagueEmail'), user?.email),
    colleagueMessage: t('demo.fill.colleagueMessage', { job: tour.title }),
    notifyTitle: afterTalk ? t('demo.data.notifyImpression', { name: DEMO.name }) : t('demo.data.notifyAccepted', { name: DEMO.name }),
    notifyBody: afterTalk ? t('demo.data.notifyImpressionBody', { job: tour.title }) : t('demo.data.notifyAcceptedBody', { job: tour.title }),
  }), [t, tour.title, afterTalk, user?.email]);
  useEffect(() => {
    if (!scene.fill || !registry) return;
    const d = tour.startAt;
    const startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const values = { salary: tour.offer, startDate, kind: tour.contracting ? 'freelance' as const : 'full-time' as const, jobId: tour.jobId ?? DEMO_IDS.job };
    const fill = scene.fill;
    // Beim ersten Besuch füllt sich das Fenster sichtbar (guideDemo: Phase „filling“), sonst sofort.
    if (!ANIMATED_FILLS.has(fill) || !guideDemo.willAnimate(stepId)) return runAutofill(fill, fillTexts, values);
    let started = false;
    let instant: (() => void) | null = null;
    const check = () => {
      const now = guideDemo.get();
      if (now.stepId !== stepId) return;
      if (now.phase === 'filling' && !started) {
        started = true;
        const t = guideDemo.token();
        void showFill(fill, fillTexts, values, {
          alive: () => guideDemo.alive(t),
          sleep: guideDemo.sleep,
          pointerTo: (el) => guideDemo.pointer.to(el, t),
          tap: () => guideDemo.pointer.tap(t),
          hidePointer: guideDemo.pointer.hide,
        }).then((done) => { if (done) guideDemo.filled(stepId); });
      }
      // Fertig oder übersprungen: was noch fehlt, sofort eintragen.
      if (now.phase === 'done' && !instant) instant = runAutofill(fill, fillTexts, values);
    };
    const unsubscribe = guideDemo.subscribe(check);
    check();
    return () => { unsubscribe(); instant?.(); };
  }, [stepId, scopeKey, registry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Besondere Momente: einmal je Rundgang, ruhig eingeblendet.
  useEffect(() => {
    if (!scene.moment || !registry || !guideDemo.willAnimate(stepId)) return;
    guideDemo.markShown(stepId);
    const t = i18n.getFixedT(lang, 'clientGuide');
    return runMoment(scene.moment, { companies: [t('demo.data.company1'), t('demo.data.company2')] });
  }, [stepId, scopeKey, registry]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!registry) return <DashboardLayout><div className="py-16" /></DashboardLayout>;

  const banner = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/[0.04] px-3 py-2 text-xs text-muted-foreground">
      <span><span className="font-medium text-foreground">{t('demo.badge')}</span> · {tour.example ? t('demo.strip.example') : t('demo.strip.real')}</span>
      <button type="button" onClick={guide.stop} className="underline underline-offset-2 hover:text-foreground">{t('demo.strip.end')}</button>
    </div>
  );

  return (
    <DemoScope key={scopeKey} registry={registry} location={location} banner={banner}>
      <Routes>
        <Route path={CLIENT_TOUR_PAGES.jobs} element={<JobsList />} />
        <Route path={CLIENT_TOUR_PAGES.tasks} element={<ClientAufgaben />} />
        <Route path="/dashboard/candidates/:id" element={<CandidateDetail />} />
        <Route path={CLIENT_TOUR_PAGES.interviews} element={<ClientInterviews />} />
        <Route path={CLIENT_TOUR_PAGES.placements} element={<ClientBesetzungen />} />
        <Route path={CLIENT_TOUR_PAGES.intake} element={<ClientIntake />} />
        <Route path={CLIENT_TOUR_PAGES.team} element={<TeamManagement />} />
        <Route path="*" element={<LeaveStage navigate={outerNavigate} />} />
      </Routes>
    </DemoScope>
  );
}

/**
 * Ein Klick auf der Bühne führt aus dem Beispiel heraus (Menü, „Zurück zu Bewerbern“):
 * dann auf die echte Seite; der Rundgang hält an und lässt sich fortsetzen.
 */
function LeaveStage({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const inner = useLocation();
  useEffect(() => { navigate(`${inner.pathname}${inner.search}`); }, [inner, navigate]);
  return null;
}
