import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useRecruiterGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { DemoScope, type DemoLocation } from '@/components/client/tour/DemoScope';
import { closeOpenMenus } from '@/components/client/tour/demoAutofill';
import { HH_ANIMATED_FILLS, runHhAutofill, showHhFill } from '@/components/recruiter/tour/hhAutofill';
import { guideDemo } from '@/components/recruiter/guide/guideDemo';
import { RecruiterPendingOverride } from '@/components/verification/RecruiterAccessGate';
import { useAuth } from '@/lib/auth';
import { HH_DEMO_IDS, RECRUITER_TOUR_PAGES, RECRUITER_TOUR_SCENES, type RecruiterTourScene } from '@/lib/recruiterTour';
import type { HhDemoWorld } from '@/lib/recruiterDemoData';
import { hhDemoRegistry, hhDemoWorld } from '@/lib/recruiterDemoData';
import { ablageBeispiel, ablageBeispielStand } from '@/lib/lebenslaufAblage';
import RecruiterDashboard from '@/pages/recruiter/RecruiterDashboard';
import RecruiterJobs from '@/pages/recruiter/RecruiterJobs';
import JobDetail from '@/pages/recruiter/JobDetail';
import RecruiterCandidates from '@/pages/recruiter/RecruiterCandidates';
import RecruiterCandidateDetail from '@/pages/recruiter/RecruiterCandidateDetail';
import RecruiterHeute from '@/pages/recruiter/RecruiterHeute';
import RecruiterInterviews from '@/pages/recruiter/RecruiterInterviews';
import RecruiterEarnings from '@/pages/recruiter/RecruiterEarnings';

/**
 * Bühne des Headhunter-Rundgangs (17.11.2026, wie beim Kunden): die ECHTEN Seiten und Fenster
 * (Übersicht mit Lebenslauf-Ablage, Offene Jobs, Stellenseite, Akte mit kurzem Interview und
 * Vorstellen, Aufgaben, Interviews, Nachgespräch, Empfehlung, Angebot, Verdienste) in einem
 * eigenen Adressraum (DemoScope), ihre Datenabfragen beantwortet ein Beispiel
 * (lib/recruiterDemoData.ts). Gespeichert, hochgeladen und gesendet wird nichts. Welches Bild,
 * sagt der laufende Schritt (`step.scene`, lib/recruiterTour.ts).
 */
export default function RecruiterTour() {
  const guide = useRecruiterGuide();
  const scene = guide.step?.scene ? RECRUITER_TOUR_SCENES[guide.step.scene] : undefined;
  const queryClient = useQueryClient();
  // Beim Verlassen der Bühne: alles Echte frisch laden, falls unterwegs etwas Beispiel mitlas.
  useEffect(() => () => { void queryClient.invalidateQueries(); }, [queryClient]);
  return scene && guide.step ? <DemoStage scene={scene} stepId={guide.step.id} index={guide.index} /> : <Idle />;
}

function Idle() {
  const { t } = useTranslation('recruiterGuide');
  const guide = useRecruiterGuide();
  const navigate = useNavigate();
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-md py-16 text-center">
        <Compass className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t('demo.idle.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('demo.idle.text')}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate('/recruiter')}>{t('demo.idle.back')}</Button>
          <Button onClick={guide.start}>{t('demo.idle.start')}</Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function DemoStage({ scene, stepId, index }: { scene: RecruiterTourScene; stepId: string; index: number }) {
  const { t, i18n } = useTranslation('recruiterGuide');
  const guide = useRecruiterGuide();
  const outerNavigate = useNavigate();
  const { user } = useAuth();
  // Feste Uhr für die ganze Geschichte: Termine und Fristen springen zwischen den Schritten nicht.
  const [now] = useState(() => new Date());
  const lang = i18n.language;
  const world = useMemo(() => (user ? hhDemoWorld({
    phase: scene.phase, now, lang,
    user: { id: user.id, email: user.email ?? '', name: String((user.user_metadata as Record<string, unknown> | undefined)?.full_name ?? '').trim() || (user.email ?? '') },
    t: i18n.getFixedT(lang, 'recruiterGuide') as (key: string, options?: Record<string, unknown>) => string,
  }) : null), [user?.id, scene.phase, now, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const registry = useMemo(() => (world ? hhDemoRegistry(world) : null), [world]);

  // Startadresse dieses Schritts; ein neues Objekt nur bei neuem Schritt. Zurück im selben Stand
  // baut die Seite frisch auf (Schlüssel mit Schrittnummer), damit kein späteres Fenster offen bleibt.
  const scopeKey = `${scene.phase}:${scene.open ?? ''}:${scene.page}`;
  const location = useMemo<DemoLocation>(() => ({
    pathname: RECRUITER_TOUR_PAGES[scene.page],
    search: scene.search ?? '',
    state: scene.open ? { tour: scene.open, jobId: world?.ids.job } : null,
  }), [stepId, index]); // eslint-disable-line react-hooks/exhaustive-deps
  // Neuer Schritt: ein offenes Menü zuerst schließen, bevor das Fenster des Schritts aufgeht.
  useLayoutEffect(() => { closeOpenMenus(); }, [stepId]);

  // Lebenslauf-Ablage: solange die Bühne offen ist, nur das Beispiel (nichts wird hochgeladen).
  useLayoutEffect(() => {
    ablageBeispiel({ kandidatId: HH_DEMO_IDS.candidate, name: 'Daniel Roth', kurz: t('demo.data.ablageShort'), datei: 'Lebenslauf_Daniel_Roth.pdf' });
    return () => ablageBeispiel(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { ablageBeispielStand(scene.ablage ?? 'leer'); }, [stepId, scene.ablage]);

  // Fenster so durcharbeiten, wie es der Headhunter täte (einmal sichtbar, sonst sofort).
  useEffect(() => {
    if (!scene.fill || !registry || !world) return;
    const fill = scene.fill;
    const values = world.fill;
    if (!HH_ANIMATED_FILLS.has(fill) || !guideDemo.willAnimate(stepId)) return runHhAutofill(fill, values);
    let started = false;
    let instant: (() => void) | null = null;
    const check = () => {
      const state = guideDemo.get();
      if (state.stepId !== stepId) return;
      if (state.phase === 'filling' && !started) {
        started = true;
        const tok = guideDemo.token();
        void showHhFill(fill, values, {
          alive: () => guideDemo.alive(tok),
          sleep: guideDemo.sleep,
          pointerTo: (el) => guideDemo.pointer.to(el, tok),
          place: guideDemo.pointer.place,
          tap: () => guideDemo.pointer.tap(tok),
          hidePointer: guideDemo.pointer.hide,
        }).then((done) => { if (done) guideDemo.filled(stepId); });
      }
      if (state.phase === 'done' && !instant) instant = runHhAutofill(fill, values);
    };
    const unsubscribe = guideDemo.subscribe(check);
    check();
    return () => { unsubscribe(); instant?.(); };
  }, [stepId, scopeKey, registry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Meldungen oben rechts, wie live aus der Glocke: nacheinander, einmal je Rundgang.
  useEffect(() => {
    const key = `toast:${stepId}`;
    if (!scene.notify?.length || !world || !guideDemo.willAnimate(key)) return;
    guideDemo.markShown(key);
    const timers = scene.notify.map((kind, i) => window.setTimeout(() => {
      const { title, body } = notifyText(kind, world, t as unknown as (key: string, options?: Record<string, unknown>) => string);
      toast(title, { description: body, position: 'top-right', duration: 6000 });
    }, 600 + i * 2200));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [stepId, world]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!registry) return <DashboardLayout><div className="py-16" /></DashboardLayout>;

  const banner = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/[0.04] px-3 py-2 text-xs text-muted-foreground">
      <span><span className="font-medium text-foreground">{t('ui.example')}</span> · {t('demo.strip')}</span>
      <button type="button" onClick={guide.stop} className="underline underline-offset-2 hover:text-foreground">{t('ui.close')}</button>
    </div>
  );

  return (
    <RecruiterPendingOverride value={false}>
      <DemoScope key={scopeKey} registry={registry} location={location} banner={banner}>
        <Routes>
          <Route path={RECRUITER_TOUR_PAGES.dashboard} element={<RecruiterDashboard />} />
          <Route path={RECRUITER_TOUR_PAGES.jobs} element={<RecruiterJobs />} />
          <Route path="/recruiter/jobs/:id" element={<JobDetail />} />
          <Route path={RECRUITER_TOUR_PAGES.candidates} element={<RecruiterCandidates />} />
          <Route path="/recruiter/candidates/:id" element={<RecruiterCandidateDetail />} />
          <Route path={RECRUITER_TOUR_PAGES.tasks} element={<RecruiterHeute />} />
          <Route path={RECRUITER_TOUR_PAGES.interviews} element={<RecruiterInterviews />} />
          <Route path={RECRUITER_TOUR_PAGES.earnings} element={<RecruiterEarnings />} />
          <Route path="*" element={<LeaveStage navigate={outerNavigate} />} />
        </Routes>
      </DemoScope>
    </RecruiterPendingOverride>
  );
}

type Notify = NonNullable<RecruiterTourScene['notify']>[number];

/** Die Meldung, wie sie live in der Glocke steht (supabase/functions/_shared: interview-, offer-, buchhaltung-…). */
function notifyText(kind: Notify, world: HhDemoWorld, t: (key: string, options?: Record<string, unknown>) => string) {
  const o = { company: world.companyName, name: world.candidateName, first: world.candidateName.split(' ')[0], job: world.jobTitle,
    date: world.interviewLabel, impression: t('demo.data.clientImpression') };
  const key = { requested: 'notifyRequested', scheduled: 'notifyScheduled', feedback: 'notifyFeedback', offer: 'notifyOffer', paid: 'notifyPaid' }[kind];
  return { title: t(`demo.data.${key}`, o), body: t(`demo.data.${key}Body`, o) };
}

/** Ein Klick auf der Bühne führt aus dem Beispiel heraus (Menü): dann auf die echte Seite; der Rundgang hält an. */
function LeaveStage({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const inner = useLocation();
  useEffect(() => { navigate(`${inner.pathname}${inner.search}`); }, [inner, navigate]);
  return null;
}
