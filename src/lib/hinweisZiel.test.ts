import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { hinweisZiel } from './hinweisZiel';

const h = (type: string, related_type: string | null, related_id: string | null = 'x1', extra: Record<string, string> = {}) => ({ type, related_type, related_id, ...extra });

describe('Ziel eines Hinweises: Headhunter', () => {
  it('Angebot, Vertrag, Nachgespräch und Einsatz öffnen ihr Fenster im Profil', () => {
    expect(hinweisZiel(h('offer_received', 'candidate'), 'recruiter')).toEqual({ pfad: '/recruiter/candidates/x1?angebot=1' });
    expect(hinweisZiel(h('offer_answer', 'candidate'), 'recruiter')).toEqual({ pfad: '/recruiter/candidates/x1?angebot=1' });
    expect(hinweisZiel(h('contract_update', 'candidate'), 'recruiter')).toEqual({ pfad: '/recruiter/candidates/x1?vertrag=1' });
    expect(hinweisZiel(h('interview_feedback', 'candidate'), 'recruiter')).toEqual({ pfad: '/recruiter/candidates/x1?nachgespraech=1' });
    expect(hinweisZiel(h('engagement_requested', 'candidate'), 'recruiter')).toEqual({ pfad: '/recruiter/candidates/x1?vorgang=1' });
  });
  it('Lebenslauf: nur wenn das Auslesen nicht geklappt hat, gleich die Akte', () => {
    expect(hinweisZiel(h('cv_received', 'candidate', 'x1', { message: 'Auslesen hat nicht geklappt' }), 'recruiter')).toEqual({ pfad: '/recruiter/candidates/x1?akte=bearbeiten' });
    expect(hinweisZiel(h('cv_received', 'candidate', 'x1', { message: 'Angaben übernommen' }), 'recruiter')).toEqual({ pfad: '/recruiter/candidates/x1' });
  });
  it('Termin über die Terminseite zeigt die Interview-Karte', () => {
    expect(hinweisZiel(h('booking_created', 'candidate'), 'recruiter')).toEqual({ pfad: '/recruiter/candidates/x1?zeigen=einladen' });
  });
  it('Einreichung führt ins Profil (Kandidat wird nachgeschlagen)', () => {
    expect(hinweisZiel(h('candidate_rejected', 'submission'), 'recruiter')).toEqual({ vorgang: 'x1' });
  });
  it('Seiten mit Markierung: Besetzung, Liga, Interview, Gespräch', () => {
    expect(hinweisZiel(h('placement_created', 'placement'), 'recruiter')).toEqual({ pfad: '/recruiter/earnings?besetzung=x1' });
    expect(hinweisZiel(h('liga_award', 'liga_season'), 'recruiter')).toEqual({ pfad: '/recruiter/liga?saison=x1' });
    expect(hinweisZiel(h('interview_scheduled', 'interview'), 'recruiter')).toEqual({ pfad: '/recruiter/interviews?interview=x1' });
    expect(hinweisZiel(h('client_question', 'conversation'), 'recruiter')).toEqual({ pfad: '/recruiter/messages?c=x1' });
  });
  it('ohne Bezug kein Ziel', () => {
    expect(hinweisZiel(h('feedback_done', null, null), 'recruiter')).toBeNull();
  });
});

describe('Ziel eines Hinweises: Kunde', () => {
  it('Fragen des Headhunters öffnen das Fenster in den Aufgaben', () => {
    expect(hinweisZiel({ ...h('recruiter_job_questions', 'job', 'job1'), id: 'n1' }, 'client')).toEqual({ pfad: '/dashboard/aufgaben?aufgabe=question%3An1&stelle=job1' });
    expect(hinweisZiel({ ...h('recruiter_nudge', 'job', 'job1', { title: 'Ihr Headhunter hat 2 Fragen', message: 'Bitte:\n– Reisen?' }), id: 'n2' }, 'client')).toEqual({ pfad: '/dashboard/aufgaben?aufgabe=question%3An2&stelle=job1' });
    expect(hinweisZiel({ ...h('recruiter_nudge', 'job', 'job1', { title: 'Erinnerung' }), id: 'n3' }, 'client')).toEqual({ pfad: '/dashboard/jobs/job1' });
  });
  it('Rechnung, Interview und Bewerber', () => {
    expect(hinweisZiel(h('invoice_issued', 'submission', 's1'), 'client')).toEqual({ pfad: '/dashboard/rechnungen?beleg=s1' });
    expect(hinweisZiel(h('interview_scheduled', 'interview', 'i1'), 'client')).toEqual({ pfad: '/dashboard/interviews?interview=i1' });
    expect(hinweisZiel(h('offer_recommendation', 'submission', 's1'), 'client')).toEqual({ pfad: '/dashboard/candidates/s1' });
  });
  it('Admin behält seine Ziele', () => {
    expect(hinweisZiel(h('company_request', 'client_company', 'c1'), 'admin')).toEqual({ pfad: '/admin?firma=c1' });
    expect(hinweisZiel(h('company_decision', 'client_company', 'c1'), 'client')).toEqual({ pfad: '/dashboard/settings#firmendaten' });
  });
});
