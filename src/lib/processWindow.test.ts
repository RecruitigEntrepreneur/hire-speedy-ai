import { describe, expect, it } from 'vitest';
import { consentAt, interviewKind, processState, processSteps, slotsFrom } from './processWindow';

const now = new Date('2026-10-14T12:00:00').getTime();
const sub = { stage: 'interview_requested', submitted_at: '2026-09-27T13:37:00', opt_in_requested_at: '2026-10-11T09:00:00' };
const pending = {
  status: 'pending_response',
  round: 1,
  created_at: '2026-10-11T09:00:00',
  response_token_expires_at: '2026-10-15T09:00:00',
};

describe('Prozess-Fenster: wer ist am Zug', () => {
  it('Einladung offen: Kandidat ist dran, Frist ist der Ablauf des Links', () => {
    const s = processState(sub, pending, 'Marko', now);
    expect(s.turn).toBe('Marko (Terminwahl)');
    expect(s.turnOf).toBe('candidate');
    expect(s.headline).toBe('Am Zug: Marko · Terminwahl offen seit 3 Tagen');
    expect(s.detail).toBe('Link läuft Do 15.10. um 09:00 ab. Danach ist die Anfrage verfallen.');
    expect(s.deadline).toBe('2026-10-15T09:00:00');
    expect(s.phase).toBe('Interview angefragt · Runde 1');
  });

  it('abgelaufener Link wird als abgelaufen gemeldet', () => {
    const s = processState(sub, { ...pending, response_token_expires_at: '2026-10-13T09:00:00' }, 'Marko', now);
    expect(s.detail).toBe('Der Link ist am Di 13.10. · 09:00 abgelaufen.');
  });

  it('eingereicht: der Kunde prüft', () => {
    const s = processState({ stage: 'submitted', submitted_at: '2026-10-07T12:00:00' }, null, 'Marko', now);
    expect(s.turnOf).toBe('client');
    expect(s.headline).toBe('Am Zug: Kunde · prüft seit 7 Tagen');
  });

  it('Termin vorbei: Kunde schuldet Feedback', () => {
    const s = processState({ ...sub, stage: 'interview_scheduled' }, { status: 'scheduled', scheduled_at: '2026-10-13T10:00:00', duration_minutes: 60 }, 'Marko', now);
    expect(s.turn).toBe('Kunde (Feedback)');
  });

  it('Absage mit Grund', () => {
    const s = processState({ ...sub, stage: 'client_rejected', rejection_reason: 'Gehalt' }, null, 'Marko', now);
    expect(s.tone).toBe('closed');
    expect(s.detail).toBe('Grund: Gehalt');
  });
});

describe('Prozess-Fenster: Stufen und Zeiten', () => {
  it('Datum nur dort, wo es sicher bekannt ist', () => {
    const steps = processSteps(sub, pending);
    expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'current', 'todo', 'todo', 'todo', 'todo']);
    expect(steps.map((s) => s.date)).toEqual(['27.09.', null, '11.10.', null, null, null, null]);
  });

  it('vergebene und vergangene Zeiten sind gestrichen, Reihenfolge nach Zeit', () => {
    const slots = slotsFrom([
      { datetime: '2026-10-15T09:00:00', status: 'available' },
      { datetime: '2026-10-13T10:00:00', status: 'available' },
      { datetime: '2026-10-14T14:00:00', status: 'taken' },
    ], now);
    expect(slots.map((s) => s.gone)).toEqual([true, true, false]);
  });

  it('Art des Gesprächs in einer Zeile', () => {
    expect(interviewKind({ round: 1, meeting_format: 'video', meeting_provider: 'teams', duration_minutes: 60 })).toBe('Runde 1 · Video (Teams) · 60 Min');
  });
});

describe('Prozess-Fenster: Zusage', () => {
  it('alter Einwilligungs-Zeitpunkt ohne Freigabe ist keine Zusage', () => {
    expect(consentAt({ ...sub, consent_confirmed_at: '2026-02-23T00:23:00', identity_unlocked: false }, pending)).toBeNull();
    expect(consentAt({ ...sub, consent_confirmed_at: '2026-10-12T18:00:00', identity_unlocked: true }, pending)).toBe('2026-10-12T18:00:00');
    expect(consentAt(sub, { ...pending, consent_given_at: '2026-10-13T08:00:00' })).toBe('2026-10-13T08:00:00');
  });
});
