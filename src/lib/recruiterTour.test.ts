import { describe, expect, it } from 'vitest';
import { RECRUITER_GUIDE_CHAPTERS, RECRUITER_TOUR_PAGES, RECRUITER_TOUR_SCENES, RECRUITER_TOUR_STAGE, recruiterGuideSteps } from './recruiterTour';
import { hhDemoRegistry, hhDemoWorld } from './recruiterDemoData';
import type { DemoQuery } from './demoBackend';
import { atStep } from './recruiterGuide';

const steps = recruiterGuideSteps();

describe('Headhunter-Rundgang: Ablauf', () => {
  it('führt in sechs Kapiteln von der Übersicht bis „Geschafft“, 19 Schritte, Kapitel für Kapitel', () => {
    expect(steps).toHaveLength(19);
    expect(steps[0].id).toBe('h-welcome');
    expect(steps.at(-1)?.id).toBe('h-done');
    expect(RECRUITER_GUIDE_CHAPTERS).toHaveLength(6);
    const chapters = steps.map((s) => s.chapter);
    expect(new Set(chapters)).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
  });

  it('Kapitel 1 und 6 echt, dazwischen die Beispiel-Bühne mit eigener Adresse je Schritt', () => {
    for (const s of steps) {
      if (s.chapter === 1 || s.chapter === 6) {
        expect(s.scene, s.id).toBeUndefined();
        expect(s.route.startsWith('/recruiter')).toBe(true);
      } else {
        expect(s.route, s.id).toBe(RECRUITER_TOUR_STAGE);
        expect(s.path, s.id).toBe(`${RECRUITER_TOUR_STAGE}?schritt=${s.id}`);
        expect(RECRUITER_TOUR_SCENES[s.scene!], s.id).toBeDefined();
        expect(atStep(s, RECRUITER_TOUR_STAGE, `?schritt=${s.id}`)).toBe(true);
      }
    }
  });

  it('Mitmach-Schritte: der Headhunter klickt selbst, vorher zeigt es der Zeiger (oder er fährt die Stellenseite ab)', () => {
    const clicks = steps.filter((s) => s.click).map((s) => s.id);
    expect(clicks).toEqual(['h-jobs', 'h-jobPage', 'h-activateWindow', 'h-cvUpload', 'h-cvCreated', 'h-quick', 'h-submit', 'h-chooseJob',
      'h-present', 'h-tasks', 'h-debrief', 'h-recommend', 'h-offer']);
    for (const s of steps.filter((x) => x.click)) expect(s.show || !!s.points?.length, s.id).toBe(true);
  });

  it('Schilder nur in der Übersicht (vier Bereiche, nichts leuchtet) und auf der Stellenseite', () => {
    expect(steps.filter((s) => s.points?.length).map((s) => s.id)).toEqual(['h-welcome', 'h-jobPage']);
    const welcome = steps[0];
    expect(welcome.bare).toBe(true);
    expect(welcome.points).toHaveLength(4);
    expect(welcome.nextLabel).toBeTruthy();
    expect(steps.find((s) => s.id === 'h-jobPage')?.pointArea).toBe('[data-tour="job.head"]');
  });

  it('Kandidat: Lebenslauf in die Kopfzeile, drei Häkchen, Ablage legt an, kurzes Interview, dann Einreichen', () => {
    const ids = steps.filter((s) => s.chapter === 3).map((s) => s.id);
    expect(ids).toEqual(['h-cvDrag', 'h-cvUpload', 'h-cvCreated', 'h-quick', 'h-submit', 'h-chooseJob', 'h-present']);
    const scene = (id: string) => RECRUITER_TOUR_SCENES[steps.find((s) => s.id === id)!.scene!];
    expect(scene('h-cvDrag')).toMatchObject({ page: 'dashboard', fill: 'cvDrag' });
    expect(scene('h-cvUpload')).toMatchObject({ page: 'dashboard', ablage: 'fenster' });
    expect(scene('h-quick')).toMatchObject({ page: 'dossier', search: '?interview=quick', ablage: 'angelegt' });
    expect(scene('h-chooseJob').search).toBe('?einreichen=alle');
  });

  it('Meldungen oben rechts an den Stationen, wie live aus der Glocke', () => {
    const notes = Object.fromEntries(Object.entries(RECRUITER_TOUR_SCENES).filter(([, sc]) => sc.notify).map(([k, sc]) => [k, sc.notify]));
    expect(notes).toEqual({ termin: ['requested', 'scheduled'], nachgespraech: ['feedback'], angebot: ['offer'], geld: ['paid'] });
  });

  it('jedes Bühnenbild zeigt eine Seite, die die Bühne kennt', () => {
    for (const scene of Object.values(RECRUITER_TOUR_SCENES)) expect(RECRUITER_TOUR_PAGES[scene.page]).toBeTruthy();
  });
});

const t = (key: string, options?: Record<string, unknown>) => (options ? `${key} ${JSON.stringify(options)}` : key);
const user = { id: 'u1', email: 'hh@example.com', name: 'Tobias Klein' };
const now = new Date('2026-11-17T09:00:00');
const q = (table: string, kind: DemoQuery['kind'] = 'select', filters: DemoQuery['filters'] = []): DemoQuery =>
  ({ table, kind, columns: '*', filters, order: [], limit: null, single: null, count: false, head: false, values: null });

describe('Headhunter-Rundgang: Beispieldaten', () => {
  it('auf der Bühne geht nichts an die echte Datenbank: Schreiben, Functions und RPCs werden abgefangen', () => {
    const reg = hhDemoRegistry(hhDemoWorld({ phase: 'ready', user, now, lang: 'de', t }));
    for (const kind of ['insert', 'update', 'upsert', 'delete'] as const) expect(reg.table!(q('submissions', kind))).toEqual([]);
    expect(reg.table!(q('gibt_es_nicht'))).toEqual([]);
    expect(reg.fn!('submission-notify', {})).toEqual({ ok: true });
    expect(reg.fn!('irgendwas', {})).toEqual({ ok: true });
    expect(reg.rpc!('irgendwas', {})).toBeNull();
  });

  it('liest echt nur Profil, Rollen, Liga und die Zugangsprüfung', () => {
    const reg = hhDemoRegistry(hhDemoWorld({ phase: 'market', user, now, lang: 'de', t }));
    expect(reg.table!(q('profiles'))).toBeNull();
    expect(reg.table!(q('user_roles'))).toBeNull();
    expect(reg.rpc!('liga_me', {})).toBeUndefined();
    expect(reg.fn!('recruiter-onboarding', { action: 'access' })).toBeNull();
    expect(reg.fn!('recruiter-onboarding', { action: 'submit' })).toEqual({ ok: true });
  });

  it('erzählt die Geschichte Schritt für Schritt: Suche, Kandidat, Vorstellung, Angebot', () => {
    const at = (phase: Parameters<typeof hhDemoWorld>[0]['phase']) => hhDemoWorld({ phase, user, now, lang: 'de', t });
    const rows = (w: ReturnType<typeof at>, table: string) => w.tables[table] as Record<string, unknown>[];
    expect(rows(at('market'), 'recruiter_job_activations')).toEqual([]);
    expect(rows(at('market'), 'recruiter_jobs_view')[0].company_name).toBeNull();
    expect(rows(at('searching'), 'recruiter_jobs_view')[0].company_name).toBe('demo.data.company');
    expect(rows(at('searching'), 'candidates')).toEqual([]);
    expect(rows(at('candidate'), 'candidate_interview_notes')[0].status).toBe('draft');
    expect(rows(at('ready'), 'candidate_interview_notes')[0].status).toBe('completed');
    expect(rows(at('ready'), 'submissions')).toEqual([]);
    expect(rows(at('requested'), 'submissions')[0].stage).toBe('interview_requested');
    expect(rows(at('scheduled'), 'interviews')[0].status).toBe('scheduled');
    expect(rows(at('interviewed'), 'interviews')[0].status).toBe('completed');
    expect(rows(at('offer'), 'offers')).toHaveLength(1);
    expect(rows(at('placed'), 'recruiter_placements_view')).toHaveLength(1);
  });

  it('„Ich suche“ ohne Kundenfrage: die Antwort sagt needs_client_answer false', () => {
    const reg = hhDemoRegistry(hhDemoWorld({ phase: 'market', user, now, lang: 'de', t }));
    expect(reg.rpc!('start_job_search', {})).toMatchObject({ status: 'active', needs_client_answer: false });
  });

  it('Filter auf verknüpfte Spalten und like/contains verfälschen nichts', () => {
    const reg = hhDemoRegistry(hhDemoWorld({ phase: 'scheduled', user, now, lang: 'de', t }));
    const linked = q('interviews', 'select', [{ op: 'eq', col: 'submissions.recruiter_id', val: 'u1' }]);
    expect((reg.table!(linked) ?? []).length).toBeGreaterThan(0);
    expect(linked.filters).toEqual([]);
    expect(reg.table!(q('interviews', 'select', [{ op: 'like', col: 'feedback', val: '%offer%' }]))).toEqual([]);
  });

  it('Angebot: nach „Gespräch geführt“ ist die Mail an den Kandidaten raus', () => {
    const reg = hhDemoRegistry(hhDemoWorld({ phase: 'offer', user, now, lang: 'de', t }));
    const before = reg.fn!('offer', { action: 'recruiter_context' }) as { currentOffer: { candidate: { mailSent: boolean } } };
    expect(before.currentOffer.candidate.mailSent).toBe(false);
    reg.fn!('offer', { action: 'talked' });
    const after = reg.fn!('offer', { action: 'recruiter_context' }) as { currentOffer: { candidate: { mailSent: boolean } } };
    expect(after.currentOffer.candidate.mailSent).toBe(true);
  });
});

/** Mitmach-Schritt → echter Knopf (Namespace, Schlüssel): Karte und Seite sagen dasselbe. */
const files = import.meta.glob<{ default: Record<string, unknown> }>('../i18n/locales/*/*.ts', { eager: true });
const lookup = (ns: string, lang: string, path: string) =>
  path.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined),
    files[`../i18n/locales/${ns}/${lang}.ts`]?.default);
const BUTTONS: Record<string, [string, string]> = {
  'h-jobs': ['recruiterGuide', 'demo.data.job1Short'],
  'h-jobPage': ['recruiterSearch', 'hero.iSearch'],
  'h-activateWindow': ['recruiterJobs', 'activation.confirmButton'],
  'h-cvUpload': ['candidateAblage', 'upload.submit'],
  'h-quick': ['candidateCapture', 'gaps.completeInterview'],
  'h-chooseJob': ['recruiterGuide', 'demo.data.job1Short'],
  'h-tasks': ['recruiterTasks', 'heute.openTask'],
  'h-submit': ['candidateDetail', 'actionBar.submitToJob'],
  'h-present': ['recruiterVorstellen', 'send.button'],
  'h-debrief': ['recruiterTasks', 'nach.save'],
  'h-recommend': ['offers', 'rec.send'],
  'h-offer': ['offers', 'answer.ways.accepted'],
};

describe('Headhunter-Rundgang: Karte und echte Seite sagen dasselbe', () => {
  for (const lang of ['de', 'en', 'sv', 'nb']) {
    it(`Mitmach-Knöpfe heißen wie die echten Knöpfe (${lang})`, () => {
      for (const [id, [ns, key]] of Object.entries(BUTTONS)) {
        const real = lookup(ns, lang, key);
        expect(typeof real, `${ns}:${key}`).toBe('string');
        const card = String(lookup('recruiterGuide', lang, `steps.${id}.action`)).replace('{{first}}', 'Daniel');
        expect(card, `${id} (${lang})`).toBe(String(real).replace('{{name}}', 'Daniel'));
      }
    });
  }
});
