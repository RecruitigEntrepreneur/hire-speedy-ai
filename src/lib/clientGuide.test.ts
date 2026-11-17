import { describe, expect, it } from 'vitest';
import {
  CLIENT_GUIDE_CHAPTERS, CLIENT_GUIDE_STATE_KEY, CLIENT_TOUR_POSTPONED_KEY, CLIENT_TOUR_SCENES, CLIENT_TOUR_SEEN_KEY, CLIENT_TOUR_STAGE,
  clientGuideSteps, clientTourPostponedStorageKey, clientTourSeen, clientTourSettled, clientTourStorageKey, type ClientGuideContext,
} from './clientGuide';
import { atStep, matchRoute, nearestStepAt, readGuideState } from './recruiterGuide';
import { DEMO_PHASES } from './clientDemoData';
import de from '@/i18n/locales/clientGuide/de';
import en from '@/i18n/locales/clientGuide/en';
import sv from '@/i18n/locales/clientGuide/sv';
import nb from '@/i18n/locales/clientGuide/nb';

const REVIEW: ClientGuideContext = { jobId: 'job-1', state: 'review', contracting: false };
const LIVE: ClientGuideContext = { jobId: 'job-1', state: 'live', contracting: false };
const NONE: ClientGuideContext = { jobId: null, state: 'none', contracting: false };
const CONTRACTING: ClientGuideContext = { jobId: 'job-2', state: 'review', contracting: true };
const ALL = [REVIEW, LIVE, NONE, CONTRACTING];
const byId = (ctx: ClientGuideContext, id: string) => clientGuideSteps(ctx).find(s => s.id === id)!;

describe('Kunden-Rundgang Fassung 3: ein Weg, einmal und fertig, auf echten Seiten', () => {
  it('führt in fünf Kapiteln von der Begrüßung zum Abschluss, Kapitel für Kapitel', () => {
    for (const ctx of ALL) {
      const steps = clientGuideSteps(ctx);
      expect(steps[0].id).toBe('c-welcome');
      expect(steps.at(-1)?.id).toBe('c-done');
      expect(new Set(steps.map(s => s.chapter))).toEqual(new Set([1, 2, 3, 4, 5]));
      const chapters = steps.map(s => s.chapter);
      expect(chapters).toEqual([...chapters].sort((a, b) => a - b));
      expect(new Set(steps.map(s => s.id)).size).toBe(steps.length);
    }
    expect(CLIENT_GUIDE_CHAPTERS).toHaveLength(5);
  });

  it('führt nie in die Aufnahme: Die erste Stelle steckt schon aus dem Onboarding im Konto', () => {
    for (const ctx of ALL) {
      for (const step of clientGuideSteps(ctx)) {
        expect(matchRoute('/dashboard/aufnahme*', step.route)).toBe(false);
        expect(step.wait).toBeUndefined();
        expect(step.hold).toBeUndefined();
      }
    }
  });

  it('zeigt die eigene Stelle in Prüfung auf „Meine Stellen“ im richtigen Reiter, dann die echte Prüf-Ansicht', () => {
    const myJob = byId(REVIEW, 'c-myJob');
    expect(myJob.route).toBe('/dashboard/jobs');
    expect(myJob.path).toBe('/dashboard/jobs?tab=review');
    expect(myJob.target).toBe('[data-tour-job="job-1"]');
    const page = byId(REVIEW, 'c-jobReview');
    expect(page.route).toBe('/dashboard/jobs/job-1');
    expect(page.target).toBe('[data-tour="job.review"]');
    expect(clientGuideSteps(REVIEW).some(s => s.id === 'c-jobPage')).toBe(false);
  });

  it('öffnet bei einer Stelle, die live ist, die echte Stellenseite', () => {
    expect(byId(LIVE, 'c-myJob').path).toBe('/dashboard/jobs');
    const page = byId(LIVE, 'c-jobPage');
    expect(page.route).toBe('/dashboard/jobs/job-1');
    expect(page.target).toBe('[data-tour="job.tabs"]');
  });

  it('zeigt ohne eigene Stelle, wo Stellen angelegt werden, und spielt den Rest am Beispiel', () => {
    const ids = clientGuideSteps(NONE).map(s => s.id);
    // Eigener Schritt: kein „Hier steht Ihre Stelle“ ohne Stelle, und „Neue Stelle“ bleibt unmarkiert (Wartezustand: gesperrt)
    expect(ids).not.toContain('c-myJob');
    // Erst wie man Positionen abgibt (echtes Aufnahme-Fenster), dann die Stelle, wie sie läuft (Marko 17.11.)
    expect(ids.slice(1, 5)).toEqual(['c-jobsNew', 'c-intakeKind', 'c-intakeWays', 'c-jobsExample']);
    expect(byId(NONE, 'c-jobsExample').route).toBe(CLIENT_TOUR_STAGE);
    expect(CLIENT_TOUR_SCENES[byId(NONE, 'c-jobsExample').scene!]).toMatchObject({ phase: 'review', page: 'jobs', live: true });
    // Im Hintergrund von „Neue Stelle“ laufen die Stellen schon (lebhaftes Beispiel)
    expect(CLIENT_TOUR_SCENES[byId(NONE, 'c-jobsNew').scene!]).toMatchObject({ page: 'jobs', live: true });
    expect(byId(NONE, 'c-jobsNew').target).toBe('[data-tour="jobs.newBlank"]');
    expect(byId({ ...NONE, waiting: true }, 'c-jobsNew').body).not.toBe(byId(NONE, 'c-jobsNew').body);
    expect(ids).not.toContain('c-jobPage');
    expect(ids).not.toContain('c-jobReview');
    expect(ids).not.toContain('c-myJob');
    expect(ids).not.toContain('c-jobLive');
  });

  it('spielt Kandidat, Interview und Angebot auf der Bühne mit den echten Seiten', () => {
    for (const ctx of ALL) {
      for (const step of clientGuideSteps(ctx).filter(s => s.chapter >= 2 && s.chapter <= 4)) {
        expect(step.route).toBe(CLIENT_TOUR_STAGE);
        expect(CLIENT_TOUR_SCENES[step.scene!], step.id).toBeTruthy();
        expect(step.target).toMatch(/^\[data-(tour|tour-task-row|way)="/);
      }
    }
  });

  it('beginnt das Beispiel auf der echten Aufgaben-Seite und zeigt das ganze Profil Stück für Stück', () => {
    const steps = clientGuideSteps(REVIEW);
    expect(CLIENT_TOUR_SCENES[byId(REVIEW, 'c-candidate').scene!].page).toBe('tasks');
    expect(steps.filter(s => s.scene === 'profil').map(s => s.id)).toEqual(['c-profile', 'c-talk', 'c-career', 'c-request']);
    expect(CLIENT_TOUR_SCENES[byId(REVIEW, 'c-invite').scene!].open).toBe('interview');
    expect(CLIENT_TOUR_SCENES[byId(REVIEW, 'c-reveal').scene!].phase).toBe('scheduled');
  });

  it('lässt nur auf der Bühne mitklicken und wechselt dabei nie die echte Adresse', () => {
    for (const ctx of ALL) {
      for (const step of clientGuideSteps(ctx).filter(s => s.click)) {
        expect(step.route).toBe(CLIENT_TOUR_STAGE);
        expect(step.click?.to).toBeUndefined();
      }
    }
    expect(clientGuideSteps(REVIEW).filter(s => s.click).map(s => s.id))
      .toEqual(['c-jobsNew', 'c-intakeKind', 'c-candidate', 'c-request', 'c-invite', 'c-feedback', 'c-offer', 'c-offerSend', 'c-contract']);
  });

  it('erzählt die Stände der Geschichte nur vorwärts', () => {
    for (const ctx of ALL) {
      const phases = clientGuideSteps(ctx).filter(s => s.scene).map(s => DEMO_PHASES.indexOf(CLIENT_TOUR_SCENES[s.scene!].phase));
      expect(phases).toEqual([...phases].sort((x, y) => x - y));
    }
  });

  it('zeigt bei Contracting den Einsatz statt Empfehlung, Angebot, Vertrag und Besetzung', () => {
    const ids = clientGuideSteps(CONTRACTING).map(s => s.id);
    expect(ids).toContain('c-einsatz');
    for (const id of ['c-recommendation', 'c-offer', 'c-offerSend', 'c-accepted', 'c-contract', 'c-hired']) expect(ids).not.toContain(id);
    expect(byId(CONTRACTING, 'c-feedback').click).toBeUndefined();
    expect(clientGuideSteps(REVIEW).map(s => s.id)).toEqual(expect.arrayContaining(['c-recommendation', 'c-offer', 'c-offerSend', 'c-accepted', 'c-contract', 'c-hired']));
  });

  it('meldet die Zusage, bevor der Arbeitsvertrag kommt', () => {
    const ids = clientGuideSteps(REVIEW).map(s => s.id);
    expect(ids.indexOf('c-accepted')).toBe(ids.indexOf('c-offerSend') + 1);
    expect(ids.indexOf('c-contract')).toBe(ids.indexOf('c-accepted') + 1);
    const scene = CLIENT_TOUR_SCENES[byId(REVIEW, 'c-accepted').scene!];
    expect(scene).toMatchObject({ phase: 'accepted', fill: 'bell' });
  });

  it('öffnet „Neue Stelle“ und zeigt das echte Aufnahme-Fenster, vor der eigenen Stelle', () => {
    for (const ctx of ALL) {
      const step = byId(ctx, 'c-jobsNew');
      expect(step.target).toBe('[data-tour="jobs.newBlank"]');
      expect(step.fillArea).toBe('[data-tour="jobs.new"]');
      expect(CLIENT_TOUR_SCENES[step.scene!].fill).toBe('newJob');
    }
    const ids = clientGuideSteps(REVIEW).map(s => s.id);
    expect(ids.slice(0, 7)).toEqual(['c-welcome', 'c-jobsNew', 'c-intakeKind', 'c-intakeWays', 'c-myJob', 'c-jobReview', 'c-jobLive']);
    // Die Art klickt der Kunde selbst (Marko 17.11.), passend zu seiner Stelle
    expect(byId(REVIEW, 'c-intakeKind').target).toBe('[data-kind="full-time"]');
    expect(byId(CONTRACTING, 'c-intakeKind').target).toBe('[data-kind="freelance"]');
    expect(byId(CONTRACTING, 'c-intakeKind').click).toBeTruthy();
    expect(CLIENT_TOUR_SCENES[byId(REVIEW, 'c-intakeWays').scene!]).toMatchObject({ page: 'intake', fill: 'intakeKind' });
    // Live ist die echte Karte schon voll: kein Extra-Schritt
    expect(clientGuideSteps(LIVE).map(s => s.id)).not.toContain('c-jobLive');
  });

  it('meldet nach dem Gespräch den Eindruck des Kandidaten, auf „Aufgaben“, vor dem Feedback', () => {
    for (const ctx of [REVIEW, CONTRACTING]) {
      const ids = clientGuideSteps(ctx).map(s => s.id);
      expect(ids.indexOf('c-impression')).toBe(ids.indexOf('c-agenda') + 1);
      expect(ids.indexOf('c-feedback')).toBe(ids.indexOf('c-impression') + 1);
    }
    expect(CLIENT_TOUR_SCENES[byId(REVIEW, 'c-impression').scene!]).toMatchObject({ phase: 'interviewed', page: 'tasks', fill: 'bell' });
    expect(CLIENT_TOUR_SCENES[byId(REVIEW, 'c-accepted').scene!].page).toBe('tasks');
  });

  it('schickt den Arbeitsvertrag selbst: kein Hochladen im Rundgang', () => {
    const step = byId(REVIEW, 'c-contract');
    expect(step.target).toBe('[data-tour="contract.saveSelf"]');
    expect(step.click).toBeTruthy();
  });

  it('gibt jedem Bühnenbild eine eigene Adresse, damit Browser-Zurück einen Schritt zurückführt', () => {
    const stage = clientGuideSteps(REVIEW).filter(s => s.route === CLIENT_TOUR_STAGE);
    expect(new Set(stage.map(s => s.path)).size).toBe(stage.length);
    for (const s of stage) expect(s.path).toBe(`${CLIENT_TOUR_STAGE}?schritt=${s.id}`);
  });

  it('erkennt nach Browser-Zurück den passenden Schritt, zuerst rückwärts', () => {
    const steps = clientGuideSteps(REVIEW);
    const at = (id: string) => steps.findIndex(s => s.id === id);
    expect(nearestStepAt(steps, at('c-profile'), CLIENT_TOUR_STAGE, '?schritt=c-candidate')).toBe(at('c-candidate'));
    expect(nearestStepAt(steps, at('c-jobReview'), '/dashboard/jobs', '?tab=review')).toBe(at('c-myJob'));
    expect(nearestStepAt(steps, at('c-myJob'), '/dashboard', '')).toBe(at('c-welcome'));
    expect(nearestStepAt(steps, at('c-done'), '/dashboard/jobs', '?tab=review')).toBe(at('c-myJob'));
    expect(nearestStepAt(steps, at('c-profile'), '/dashboard/settings', '')).toBe(-1);
    expect(atStep(byId(REVIEW, 'c-myJob'), '/dashboard/jobs', '')).toBe(false);
    expect(atStep(byId(REVIEW, 'c-myJob'), '/dashboard/jobs', '?tab=review')).toBe(true);
  });

  it('endet auf den echten Seiten des Kontos', () => {
    // Team zeigt das Einladen auf der Bühne; „Aufgaben“ kam im Ablauf (im neuen Konto wäre die Seite leer).
    const tail = clientGuideSteps(REVIEW).filter(s => s.chapter === 5).map(s => s.id);
    expect(tail).toEqual(['c-team', 'c-notify', 'c-positionEntry', 'c-done']);
    expect(byId(REVIEW, 'c-team').route).toBe(CLIENT_TOUR_STAGE);
    expect(clientGuideSteps({ ...REVIEW, waiting: true }).map(s => s.id)).not.toContain('c-positionEntry');
  });
});

describe('Kunden-Rundgang: Texte', () => {
  const ids = new Set(ALL.flatMap(ctx => clientGuideSteps(ctx).map(s => s.id)));

  it('hat für jeden Schritt Titel und Text in allen vier Sprachen', () => {
    for (const lang of [de, en, sv, nb]) {
      for (const id of ids) {
        const texts = (lang.steps as Record<string, Record<string, string>>)[id];
        expect(texts?.title, id).toBeTruthy();
        expect(texts?.body, id).toBeTruthy();
      }
    }
  });

  it('hat Beschriftungen für jeden Mitmach-Schritt und alle Kapitel', () => {
    for (const lang of [de, en, sv, nb]) {
      for (const id of ['c-candidate', 'c-request', 'c-invite', 'c-feedback', 'c-offer', 'c-offerSend']) expect((lang.steps as Record<string, Record<string, string>>)[id].action).toBeTruthy();
      for (const key of [...CLIENT_GUIDE_CHAPTERS, 'einsatz']) expect((lang.chapters as Record<string, string>)[key]).toBeTruthy();
    }
  });

  it('hat für jedes Schild am Zeiger einen Text in allen vier Sprachen', () => {
    const withPoints = ALL.flatMap(ctx => clientGuideSteps(ctx)).filter(s => s.points?.length);
    expect(withPoints.map(s => s.id)).toEqual(expect.arrayContaining(['c-profile', 'c-talk', 'c-career']));
    for (const lang of [de, en, sv, nb]) {
      for (const step of withPoints) {
        step.points!.forEach((_, i) => expect((lang.steps as Record<string, Record<string, string>>)[step.id][`p${i + 1}`], `${step.id}.p${i + 1}`).toBeTruthy());
      }
      expect((lang.demo.data as Record<string, string>).notifyAccepted).toContain('{{name}}');
    }
  });

  it('verspricht keinen Score und keine Prozentzahl', () => {
    expect(JSON.stringify(de)).not.toMatch(/\d+\s?%/);
  });
});

describe('Kunden-Rundgang: Merker', () => {
  const steps = clientGuideSteps(REVIEW);

  it('liest den laufenden Rundgang nur mit eigenen Schritten', () => {
    const storage = { getItem: () => JSON.stringify({ userId: 'u1', stepId: 'c-offer', paused: false }) };
    expect(readGuideState(storage, 'u1', steps, CLIENT_GUIDE_STATE_KEY)?.stepId).toBe('c-offer');
    const alt = { getItem: () => JSON.stringify({ userId: 'u1', stepId: 'c-kind', paused: false }) };
    expect(readGuideState(alt, 'u1', steps, CLIENT_GUIDE_STATE_KEY)).toBeNull();
  });

  it('startet einmal für jeden, auch wer den alten Rundgang gesehen hat', () => {
    const user = { id: 'u1', user_metadata: { client_tour_seen_at: '2026-10-01' } };
    expect(clientTourSeen(user, null)).toBe(false);
    expect(clientTourSettled(user, null)).toBe(false);
  });

  it('„Später“ verschiebt nur: startet nicht mehr von selbst, ist aber nicht erledigt', () => {
    const user = { id: 'u1', user_metadata: { [CLIENT_TOUR_POSTPONED_KEY]: '2026-11-16' } };
    expect(clientTourSettled(user, null)).toBe(true);
    expect(clientTourSeen(user, null)).toBe(false);
    const browser = { getItem: (key: string) => (key === clientTourPostponedStorageKey('u2') ? 'x' : null) };
    expect(clientTourSettled({ id: 'u2' }, browser)).toBe(true);
  });

  it('merkt sich „gesehen“ im Konto und im Browser', () => {
    expect(clientTourSeen({ id: 'u1', user_metadata: { [CLIENT_TOUR_SEEN_KEY]: 'x' } }, null)).toBe(true);
    const browser = { getItem: (key: string) => (key === clientTourStorageKey('u3') ? 'x' : null) };
    expect(clientTourSeen({ id: 'u3' }, browser)).toBe(true);
    expect(clientTourSeen(null, null)).toBe(true);
  });
});
