import { describe, expect, it } from 'vitest';
import { buildPartners, buildTimeline, countGroups, countTiles, filterPartners, looksLikeTest, relativeTime, type RecruiterAccount } from './recruiterNetwork';
import type { StoredContract, StoredOnboarding } from './recruiterOnboardingApi';
import { cleanProfile } from '../../supabase/functions/_shared/recruiter-contract-policy';
import { summarizeMail } from '../../supabase/functions/_shared/email-stats';

const NOW = Date.parse('2026-09-18T12:00:00.000Z');
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString();
const ahead = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

let n = 0;
const invite = (over: Partial<StoredOnboarding> = {}): StoredOnboarding => ({
  id: `case-${++n}`, revision: 1, entry_source: 'invitation', kind: 'individual', email: `person${n}@firma.de`,
  profile: cleanProfile({ name: `Person ${n}`, company: `Firma ${n}` }), state: 'invited', feedback: '',
  contracts: [], created_at: ago(1), expires_at: ahead(6), ...over,
});
const packet = (caseId: string, over: Partial<StoredContract> = {}): StoredContract => ({
  id: `env-${caseId}`, case_id: caseId, state: 'sent', package_version: '2.1', documents: [],
  recruiter_client_user_id: null, recruiter_signed_at: null, countersigned_at: null, signed_document_path: null, certificate_path: null, ...over,
});
const account = (over: Partial<RecruiterAccount> = {}): RecruiterAccount => ({
  userId: `user-${++n}`, email: `konto${n}@firma.de`, name: `Konto ${n}`, company: '', createdAt: ago(100),
  verified: false, status: 'active', customFee: null, notes: '', submissions: 0, interviewed: 0, interviews: 0, placements: 0, lastSubmissionAt: null, ...over,
});
const mail = (events: { type: string; at: string }[], over: Record<string, unknown> = {}) => summarizeMail({
  id: `mail-${++n}`, template_name: 'recruiter_onboarding_invitation', status: 'sent', created_at: ago(1), to_email: 'x@firma.de',
  metadata: { resend_id: 're', events }, ...over,
});
const one = (input: Parameters<typeof buildPartners>[0]) => buildPartners({ ...input, now: NOW });

describe('eine Person statt drei Listen', () => {
  it('führt Konto und Vorgänge über die E-Mail zusammen und nimmt den weitesten Vorgang als Hauptvorgang', () => {
    const revoked = invite({ email: 'Anna@Weber.de', created_at: ago(20), revoked_at: ago(19) });
    const draft = invite({ email: 'anna@weber.de', state: 'draft', claimed_at: ago(2), created_at: ago(3) });
    const [p] = one({ cases: [revoked, draft], contracts: [], accounts: [account({ email: 'ANNA@weber.de', name: 'Anna Weber' })] });
    expect(p.caseRow?.id).toBe(draft.id);
    expect(p.otherCases.map(c => c.id)).toEqual([revoked.id]);
    expect([p.phase, p.group, p.next.label]).toEqual(['draft', 'onboarding', 'Angaben in Arbeit']);
    expect(p.account?.name).toBe('Anna Weber');
  });
});

describe('Phase und nächster Schritt über den ganzen Weg', () => {
  const cases: [string, () => ReturnType<typeof one>[number], string, string, string][] = [];
  const add = (name: string, make: () => ReturnType<typeof one>[number], phase: string, kind: string, label: string) => cases.push([name, make, phase, kind, label]);
  add('frische Einladung mit Mail', () => one({ cases: [invite({ mail: mail([{ type: 'delivered', at: ago(1) }]) })], contracts: [], accounts: [] })[0], 'invited', 'wait', 'abwarten');
  add('Einladung ohne Reaktion', () => one({ cases: [invite({ created_at: ago(5), mail: mail([]) })], contracts: [], accounts: [] })[0], 'invited', 'remind', 'Erinnern');
  add('Link angelegt, Mail nie gesendet', () => one({ cases: [invite({ mail: null })], contracts: [], accounts: [] })[0], 'invited', 'resend', 'Mail senden');
  add('abgelaufener Link', () => one({ cases: [invite({ created_at: ago(10), expires_at: ago(3) })], contracts: [], accounts: [] })[0], 'expired', 'resend', 'Neuen Link senden');
  add('Angaben eingereicht', () => one({ cases: [invite({ state: 'review', claimed_at: ago(1) })], contracts: [], accounts: [] })[0], 'review', 'review', 'Prüfen');
  add('eingereicht und unterschrieben', () => { const c = invite({ state: 'review', claimed_at: ago(2) }); return one({ cases: [c], contracts: [packet(c.id, { recruiter_signed_at: ago(0.1) })], accounts: [] })[0]; }, 'countersign', 'review', 'Prüfen, zeichnen');
  add('geprüft und unterschrieben', () => { const c = invite({ state: 'approved', claimed_at: ago(2) }); return one({ cases: [c], contracts: [packet(c.id, { recruiter_signed_at: ago(0.1) })], accounts: [] })[0]; }, 'countersign', 'countersign', 'Gegenzeichnen');
  add('geprüft, Unterschrift offen', () => one({ cases: [invite({ state: 'approved', claimed_at: ago(2) })], contracts: [], accounts: [] })[0], 'awaiting_signature', 'wait', 'wartet auf Unterschrift');
  add('Vertrag komplett', () => { const c = invite({ state: 'approved', claimed_at: ago(5) }); return one({ cases: [c], contracts: [packet(c.id, { state: 'completed', recruiter_signed_at: ago(2), countersigned_at: ago(1) })], accounts: [] })[0]; }, 'activate', 'activate', 'Freischalten');
  add('freigeschaltet', () => { const c = invite({ state: 'approved', claimed_at: ago(5), activated: true }); return one({ cases: [c], contracts: [packet(c.id, { state: 'completed' })], accounts: [] })[0]; }, 'active', 'none', '');
  add('altes Konto, verifiziert', () => one({ cases: [], contracts: [], accounts: [account({ verified: true })] })[0], 'legacy_active', 'start_contract', 'Vertrag 2.1 anbieten');
  add('altes Konto ohne Vertrag', () => one({ cases: [], contracts: [], accounts: [account()] })[0], 'no_contract', 'start_contract', 'Vertrag starten');
  add('gesperrtes Konto', () => one({ cases: [], contracts: [], accounts: [account({ verified: true, status: 'suspended' })] })[0], 'suspended', 'none', '');
  add('nur widerrufene Einladung', () => one({ cases: [invite({ revoked_at: ago(1) })], contracts: [], accounts: [] })[0], 'revoked', 'none', '');
  it.each(cases)('%s', (_name, make, phase, kind, label) => {
    const p = make();
    expect([p.phase, p.next.kind, p.next.label]).toEqual([phase, kind, label]);
  });
});

describe('Jetzt dran, Sortierung und Filter', () => {
  const review = invite({ state: 'review', claimed_at: ago(1), profile: cleanProfile({ name: 'Anna Weber', company: 'Weber Personal' }) });
  const signed = invite({ state: 'approved', claimed_at: ago(3) });
  const done = invite({ state: 'approved', claimed_at: ago(9) });
  const stale = invite({ created_at: ago(6) });
  const expiring = invite({ created_at: ago(5.5), expires_at: ahead(1) });
  const fresh = invite();
  const partners = one({
    cases: [fresh, stale, expiring, done, signed, review, invite({ revoked_at: ago(2) })],
    contracts: [packet(signed.id, { recruiter_signed_at: ago(0.2) }), packet(done.id, { state: 'completed', recruiter_signed_at: ago(3), countersigned_at: ago(2) })],
    accounts: [account({ verified: true, name: 'Tim Roth', lastSubmissionAt: ago(2) }), account({ email: 'recruiter@demo.de', name: 'Max Mustermann' })],
  });
  it('zählt die Kacheln', () => {
    expect(countTiles(partners)).toEqual({ decide: 2, activate: 1, followUp: 2, expiring: 1 });
  });
  it('sortiert Entscheidungen nach oben, Archiv nach unten', () => {
    expect(partners.slice(0, 3).map(p => p.phase)).toEqual(['countersign', 'review', 'activate']);
    expect(partners.at(-1)?.group).toBe('archive');
  });
  it('filtert nach Kachel, Gruppe, Suche und Testkonten; das Archiv zeigt sich nur auf Wunsch', () => {
    expect(filterPartners(partners, { tile: 'decide' }).map(p => p.caseRow?.id).sort()).toEqual([review.id, signed.id].sort());
    expect(filterPartners(partners, { group: 'all' }).some(p => p.group === 'archive')).toBe(false);
    expect(filterPartners(partners, { group: 'archive' })).toHaveLength(1);
    expect(filterPartners(partners, { search: 'weber' }).map(p => p.name)).toEqual(['Anna Weber']);
    expect(filterPartners(partners, { hideTests: true }).some(p => p.name === 'Max Mustermann')).toBe(false);
    expect(countGroups(partners)).toMatchObject({ onboarding: 6, active: 1, no_contract: 1, archive: 1 });
  });
});

describe('letztes Signal', () => {
  it('nimmt das jüngste Ereignis und nennt fehlende Mails beim Namen', () => {
    const opened = one({ cases: [invite({ mail: mail([{ type: 'delivered', at: ago(1) }, { type: 'opened', at: ago(0.5) }, { type: 'opened', at: ago(0.1) }]) })], contracts: [], accounts: [] })[0];
    expect(opened.signal).toEqual({ text: 'Einladung 2× geöffnet', at: ago(0.1) });
    expect(one({ cases: [invite({ mail: null })], contracts: [], accounts: [] })[0].signal.text).toBe('Link angelegt, keine Mail gesendet');
    const blind = one({ cases: [invite({ mail: mail([], { metadata: { resend_id: 're', resend_last_event: 'opened' } }) })], contracts: [], accounts: [] })[0];
    expect(blind.signal.text).toBe('Einladung gesendet, laut Resend geöffnet');
    expect(one({ cases: [], contracts: [], accounts: [account({ verified: true, lastSubmissionAt: ago(2) })] })[0].signal).toEqual({ text: 'Einreichung', at: ago(2) });
  });
});

describe('Kleinigkeiten, die zählen', () => {
  it('erkennt Testkonten, aber keine Firmennamen, die nur mit Test beginnen', () => {
    expect(looksLikeTest('Marko Benko (Onboarding-Test)')).toBe(true);
    expect(looksLikeTest('recruiter@demo.de')).toBe(true);
    expect(looksLikeTest('TestHaus GmbH', 'kontakt@testhaus.de')).toBe(false);
  });
  it('schreibt Zeiten so, wie man sie sagt', () => {
    expect(relativeTime(new Date(NOW - 3_600_000).toISOString(), NOW)).toMatch(/^heute \d\d:\d\d$/);
    expect(relativeTime(ago(1), NOW)).toMatch(/^gestern /);
    expect(relativeTime(ago(3), NOW)).toBe('vor 3 Tagen');
    expect(relativeTime(ago(30), NOW)).toMatch(/^am \d\d\.\d\d\.\d{4}$/);
    expect(relativeTime(null, NOW)).toBe('');
  });
});

describe('Verlauf der Akte', () => {
  it('fasst Zwischenspeicherungen zusammen, erkennt Rückfragen und mischt Mails und Unterschriften ein', () => {
    const c = invite({ state: 'approved', claimed_at: ago(4) });
    const timeline = buildTimeline({
      caseRow: c,
      contract: packet(c.id, { recruiter_signed_at: ago(0.5) }),
      mails: [mail([{ type: 'delivered', at: ago(5) }, { type: 'opened', at: ago(4.8) }, { type: 'opened', at: ago(4.5) }], { created_at: ago(5) })],
      history: [
        { event: 'case.invited', revision: 1, occurred_at: ago(5) }, { event: 'case.draft', revision: 2, occurred_at: ago(4) },
        { event: 'case.draft', revision: 3, occurred_at: ago(3.9) }, { event: 'case.review', revision: 4, occurred_at: ago(3) },
        { event: 'case.draft', revision: 5, occurred_at: ago(2.5) }, { event: 'case.review', revision: 6, occurred_at: ago(2) },
        { event: 'contract.prepared', revision: 1, occurred_at: ago(1) }, { event: 'contract.creating', revision: 2, occurred_at: ago(0.99) },
        { event: 'contract.sent', revision: 3, occurred_at: ago(0.98) }, { event: 'case.approved', revision: 7, occurred_at: ago(0.2) },
      ],
      account: null,
    });
    expect(timeline.map(t => t.text)).toEqual([
      'Prüfung abgeschlossen', 'Headhunter hat unterschrieben', 'An DocuSign übergeben', 'Vertragspaket erstellt', 'Angaben eingereicht',
      'Zur Ergänzung geöffnet', 'Angaben eingereicht', 'Angaben begonnen', 'Einladung erneut geöffnet, insgesamt 2×', 'Einladung geöffnet',
      'Einladung angelegt', 'Einladung gesendet', 'Einladung zugestellt',
    ]);
  });
  it('kommt ohne Protokoll mit den Daten des Vorgangs aus', () => {
    const c = invite({ state: 'draft', claimed_at: ago(1), created_at: ago(2) });
    expect(buildTimeline({ caseRow: c, contract: null, mails: [], history: [], account: null }).map(t => t.text)).toEqual(['Angaben begonnen', 'Einladung angelegt']);
  });
});
