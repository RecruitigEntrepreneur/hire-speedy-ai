import { describe, expect, it } from 'vitest';
import { buildTourData, DEMO, type TourJobSource } from './clientDemo';
import { DEMO_IDS, DEMO_PHASES, demoRegistry, demoWorld, type DemoInput, type DemoPhase } from './clientDemoData';
import type { DemoQuery } from './demoBackend';
import { candidateAnonCode } from './anonymization';
import { feedbackWayOf } from './interviewScheduling';
import { CLIENT_TOUR_SCENES, clientGuideSteps } from './clientGuide';

const JOB: TourJobSource = {
  id: 'job-1', title: 'Servicetechniker Medizintechnik (m/w/d)', status: 'pending_approval', location: 'Tuttlingen',
  salary_min: 48_000, salary_max: 56_000, employment_type: 'full_time', experience_level: 'mid',
  remote_type: 'onsite', must_haves: ['Medizingeräte', 'Elektrotechnische Ausbildung'],
};
const NOW = new Date(2026, 10, 16, 9, 0);
const tour = buildTourData(JOB, { title: 'x', location: 'x', band: { min: 1, max: 2 }, level: 'mid', remote: 'onsite', criteria: [] }, { now: NOW });
/** Übersetzer, der Schlüssel und Werte zeigt: So prüfen die Tests, welcher Text wohin kommt. */
const t = (key: string, options?: Record<string, unknown>) => (options ? `${key}${JSON.stringify(options)}` : key);
const input = (phase: DemoPhase, over: Partial<DemoInput> = {}): DemoInput => ({
  phase, tour, job: { ...JOB, benefits: ['Firmenwagen', '30 Tage Urlaub', 'Herstellerschulungen'] }, now: NOW, lang: 'de', t,
  user: { id: 'u1', name: 'Klara Kunde', email: 'klara@example.com' }, companyName: 'Muster Medizintechnik', feePercent: 20, ...over,
});
const query = (table: string, over: Partial<DemoQuery> = {}): DemoQuery => ({
  table, kind: 'select', columns: '*', filters: [], order: [], limit: null, single: null, count: false, head: false, values: null, ...over,
});

describe('Demo-Modus: Beispielkandidat an der eigenen Stelle', () => {
  it('trägt überall dasselbe Kürzel PR-3F8A21', () => {
    expect(candidateAnonCode(DEMO_IDS.candidate)).toBe(DEMO.code);
  });

  it('bleibt anonym, bis der Kandidat einen Termin zusagt', () => {
    const review = demoWorld(input('review')).tables.client_candidate_view[0];
    expect(review.identity_unlocked).toBe(false);
    expect(review.full_name).toBeNull();
    expect(review.email).toBeNull();
    expect(demoWorld(input('review')).tables.client_candidate_experiences_view.every((e) => e.company_name === null)).toBe(true);
    // Die Notiz des Headhunters ist schon vor der Freigabe sichtbar: kein Name darin.
    expect(String(review.recruiter_notes)).not.toContain('Daniel');
    const scheduled = demoWorld(input('scheduled')).tables.client_candidate_view[0];
    expect(scheduled.identity_unlocked).toBe(true);
    expect(scheduled.full_name).toBe(DEMO.name);
  });

  it('baut das Profil aus der Stelle: Rolle, Gehaltsband, Muss-Kriterien', () => {
    const w = demoWorld(input('review'));
    const view = w.tables.client_candidate_view[0];
    expect(view.job_id).toBe('job-1');
    expect(view.candidate_role).toBe('Servicetechniker Medizintechnik');
    expect(view.experience_band).toBe('3-5 Jahre');
    expect(view.salary_band).toContain('"from":50');
    const fit = w.tables.client_fit_assessment_view[0] as { requirement_assessments: { requirement: string }[] };
    expect(fit.requirement_assessments.map((r) => r.requirement)).toEqual(['Medizingeräte', 'Elektrotechnische Ausbildung']);
  });

  it('zeigt bei Contracting nie ein Gehalt', () => {
    const contracting = buildTourData({ ...JOB, employment_type: 'freelance' }, { title: 'x', location: 'x', band: { min: 1, max: 2 }, level: 'mid', remote: 'onsite', criteria: [] }, { now: NOW });
    const w = demoWorld(input('recommended', { tour: contracting }));
    expect(w.tables.client_candidate_view[0].salary_band).toBeNull();
    expect(w.tables.client_candidate_interview_view[0].salary_wish).toBeNull();
    expect(w.offerContext.contracting).not.toBeNull();
    expect(w.offerContext.recommendation?.items.some((i) => i.key === 'fix')).toBe(false);
  });

  it('erzählt die Geschichte in Ständen: Aufgabe, Termin, Feedback, Empfehlung, Vertrag, Besetzung', () => {
    const kinds = DEMO_PHASES.map((p) => demoWorld(input(p)).taskList.tasks.map((x) => x.kind).join(','));
    expect(kinds).toEqual(['', 'review', '', 'feedback', 'make_offer', 'send_contract', '']);
    // Nur die Stelle: noch kein Kandidat
    expect(demoWorld(input('job')).tables.client_candidate_view).toEqual([]);
    expect(demoWorld(input('scheduled')).taskList.waiting).toHaveLength(1);
    expect(demoWorld(input('scheduled')).tables.interviews[0].status).toBe('scheduled');
    // Bis zur Zusage steht der Termin bevor; ab dem Feedback liegt er zurück (das echte Fenster will „nach dem Gespräch“)
    expect(Date.parse(String(demoWorld(input('scheduled')).tables.interviews[0].scheduled_at))).toBeGreaterThan(NOW.getTime());
    const after = demoWorld(input('interviewed')).tables.interviews[0];
    expect(after.status).toBe('completed');
    expect(Date.parse(String(after.scheduled_at))).toBeLessThan(NOW.getTime());
    expect(feedbackWayOf(demoWorld(input('recommended')).tables.interviews[0].feedback as string)).toBe('offer');
    expect(demoWorld(input('recommended')).offerContext.recommendation?.items.find((i) => i.key === 'fix')?.value).toMatch(/52\.000/);
    expect(demoWorld(input('accepted')).offerContext.currentOffer?.status).toBe('accepted');
    expect(demoWorld(input('signed')).besetzung.counts.start).toBe(1);
  });

  it('nimmt das Honorar aus dem Rahmenvertrag, ohne Vertrag keins', () => {
    expect(demoWorld(input('recommended')).offerContext.feePercent).toBe(20);
    expect(demoWorld(input('recommended', { feePercent: null })).offerContext.feePercent).toBeNull();
  });
});

describe('Demo-Modus: Register', () => {
  const registry = demoRegistry(demoWorld(input('review')));

  it('beantwortet die Tabellen der Bewerbung aus dem Beispiel, auch ohne Filter', () => {
    expect(registry.table!(query('client_candidate_view'))).toHaveLength(1);
    expect(registry.table!(query('interviews'))).toEqual([]);
  });

  it('lässt Konto, Team und Nachrichten echt lesen, Fragen zum Beispiel aber nicht', () => {
    expect(registry.table!(query('organizations'))).toBeNull();
    expect(registry.table!(query('messages'))).toBeNull();
    expect(registry.table!(query('messages', { filters: [{ op: 'eq', col: 'candidate_id', val: DEMO_IDS.candidate }] }))).toEqual([]);
    expect(registry.fn!('team-data', { action: 'list' })).toBeNull();
    expect(registry.fn!('placement', { action: 'client_invoices' })).toBeNull();
  });

  it('speichert nichts und sendet nichts', () => {
    for (const kind of ['insert', 'update', 'upsert', 'delete'] as const) {
      expect(registry.table!(query('organizations', { kind }))).toEqual([]);
    }
    expect(registry.rpc!('log_candidate_access', {})).toBeNull();
    expect(registry.fn!('interview-request', { action: 'send' })).toMatchObject({ interviewId: DEMO_IDS.interview });
    expect(registry.fn!('offer', { action: 'create' })).toMatchObject({ offerId: DEMO_IDS.offer });
    expect(registry.fn!('track-event', {})).toEqual({ ok: true });
    expect(registry.fn!('irgendwas-neues', { action: 'delete_all' })).toEqual({ ok: true });
  });

  it('legt keinen Schritt der Geschichte in die Zukunft, außer dem anstehenden Termin', () => {
    const w = demoWorld(input('signed'));
    const times = [w.tables.offers[0].created_at, w.offerContext.currentOffer?.respondedAt, w.contractContext.contract?.reportedAt, w.tables.interviews[0].created_at];
    for (const at of times) expect(Date.parse(String(at))).toBeLessThanOrEqual(NOW.getTime());
  });

  it('bietet Termine erst ab dem nächsten Tag an', () => {
    const grid = registry.fn!('interview-request', { action: 'availability', weekStart: '2026-11-16' }) as { days: { slots: { start: string }[] }[] };
    const starts = grid.days.flatMap((d) => d.slots.map((s) => Date.parse(s.start)));
    expect(starts.length).toBeGreaterThan(10);
    expect(Math.min(...starts)).toBeGreaterThanOrEqual(NOW.getTime() + 24 * 3_600_000);
  });

  it('zeigt nur die Stelle des Rundgangs, keine weiteren Stellen des Kontos', () => {
    const only = (rows: unknown) => (rows as { id: string }[] | null)?.map((r) => r.id);
    expect(only(registry.table!(query('jobs')))).toEqual(['job-1']);
    expect(only(registry.table!(query('jobs', { columns: 'id, title, status', filters: [{ op: 'eq', col: 'organization_id', val: 'org-1' }] })))).toEqual(['job-1']);
    // Echter Stand der eigenen Stelle, auf der vollen Karte live
    expect((registry.table!(query('jobs')) as { status: string }[])[0].status).toBe('pending_approval');
    const live = demoRegistry(demoWorld(input('review', { liveJob: true })));
    expect((live.table!(query('jobs')) as { status: string }[])[0].status).toBe('published');
    // Lebhaftes Beispiel: die eigene Stelle und zwei weitere laufende, alle mit Kandidaten und Suchenden
    expect(only(live.table!(query('jobs')))).toEqual(['job-1', DEMO_IDS.exampleJob1, DEMO_IDS.exampleJob2]);
    expect(live.rpc!('get_jobs_searcher_counts', {})).toEqual([
      { job_id: 'job-1', searching: 2 }, { job_id: DEMO_IDS.exampleJob1, searching: 1 }, { job_id: DEMO_IDS.exampleJob2, searching: 2 },
    ]);
    const views = live.table!(query('client_candidate_view')) as { job_id: string; candidate_id: string }[];
    expect(views.filter((v) => v.job_id === 'job-1')).toHaveLength(3);
    expect(new Set(views.map((v) => v.candidate_id)).size).toBe(views.length);
    // Ohne volle Karte nur der Beispielkandidat
    expect((registry.table!(query('client_candidate_view')) as unknown[]).length).toBe(1);
  });

  it('legt ohne eigene Stelle eine Beispielstelle an', () => {
    const example = buildTourData(null, { title: 'Senior Controller (m/w/d)', location: 'München', band: { min: 75_000, max: 90_000 }, level: 'senior', remote: 'hybrid', criteria: ['SAP'] }, { now: NOW });
    const r = demoRegistry(demoWorld(input('review', { tour: example, job: null })));
    expect(r.table!(query('jobs', { filters: [{ op: 'eq', col: 'id', val: DEMO_IDS.job }] }))).toHaveLength(1);
  });
});

describe('Demo-Modus: jedes Bühnenbild gibt es', () => {
  it('kennt jede Szene der Schritte', () => {
    for (const ctx of [
      { jobId: 'job-1', state: 'review' as const, contracting: false },
      { jobId: 'job-1', state: 'live' as const, contracting: true },
      { jobId: null, state: 'none' as const, contracting: false },
    ]) {
      for (const step of clientGuideSteps(ctx).filter((s) => s.scene)) expect(CLIENT_TOUR_SCENES[step.scene!], step.id).toBeTruthy();
    }
  });
});
