import type { AuditEntry, StoredContract, StoredOnboarding } from './recruiterOnboardingApi';
import type { MailEventType, MailStat } from '../../supabase/functions/_shared/email-stats';

/**
 * Headhunter-Netzwerk als eine Liste von Personen.
 *
 * Heute gibt es drei Quellen: Einladungen und Onboarding-Vorgänge
 * (recruiter_onboarding_cases), Verträge (recruiter_contract_envelopes) und
 * Recruiter-Konten (user_roles + profiles, teils aus der Zeit vor dem
 * Rahmenvertrag). Dieses Modell führt sie über die E-Mail-Adresse zu einer Person
 * zusammen und leitet ab, was die Admin-Seite zeigt: Phase, letztes Signal,
 * nächster Schritt, die Zahlen unter „Jetzt dran“ und den Verlauf der Akte.
 *
 * Rein und ohne Netz, getestet in recruiterNetwork.test.ts.
 */

export interface RecruiterAccount {
  userId: string; email: string; name: string; company: string; createdAt: string;
  verified: boolean; status: string; customFee: number | null; notes: string;
  submissions: number; interviewed: number; interviews: number; placements: number; lastSubmissionAt: string | null;
}

export type Phase = 'invited' | 'expired' | 'draft' | 'review' | 'awaiting_signature' | 'countersign' | 'activate'
  | 'active' | 'legacy_active' | 'no_contract' | 'suspended' | 'revoked';
export type Group = 'onboarding' | 'active' | 'no_contract' | 'suspended' | 'archive';
export type StepKind = 'review' | 'countersign' | 'activate' | 'remind' | 'resend' | 'start_contract' | 'wait' | 'none';
export type Tile = 'decide' | 'activate' | 'evidence' | 'followUp' | 'expiring';

export const PHASE_LABELS: Record<Phase, string> = {
  invited: 'Eingeladen', expired: 'Link abgelaufen', draft: 'Angaben in Arbeit', review: 'Zur Prüfung',
  awaiting_signature: 'Unterschrift offen', countersign: 'Gegenzeichnen', activate: 'Freischalten', active: 'Aktiv',
  legacy_active: 'Aktiv · Altvertrag', no_contract: 'Ohne Vertrag', suspended: 'Gesperrt', revoked: 'Widerrufen',
};
/** Wie viele der sechs Stationen erreicht sind: Eingeladen, Angaben, Eingereicht, Unterschrieben, Gegengezeichnet, Aktiv. */
export const PHASE_STEP: Record<Phase, number> = {
  invited: 1, expired: 1, draft: 2, review: 3, awaiting_signature: 3, countersign: 4, activate: 5, active: 6,
  legacy_active: 6, no_contract: 0, suspended: 0, revoked: 0,
};
export const STEP_LABELS = ['Eingeladen', 'Angaben', 'Eingereicht', 'Unterschrieben', 'Gegengezeichnet', 'Aktiv'] as const;
export const GROUP_LABELS: Record<Group, string> = {
  onboarding: 'Im Onboarding', active: 'Aktiv', no_contract: 'Ohne Vertrag', suspended: 'Gesperrt', archive: 'Archiv',
};
export const TILE_LABELS: Record<Tile, { title: string; hint: string }> = {
  decide: { title: 'Prüfen und gegenzeichnen', hint: 'Angaben liegen vor' },
  activate: { title: 'Freischalten', hint: 'Vertrag komplett' },
  evidence: { title: 'Nachweise prüfen', hint: 'neu hochgeladen' },
  followUp: { title: 'Nachfassen', hint: 'ohne Reaktion' },
  expiring: { title: 'Link läuft bald ab', hint: 'in den nächsten 2 Tagen' },
};

/** Einladung ohne Reaktion gilt nach so vielen Tagen als „Nachfassen“. */
export const FOLLOW_UP_DAYS = 3;
const DAY = 86_400_000;

export interface Partner {
  key: string; email: string; name: string; company: string; kind: string | null; isTest: boolean;
  account: RecruiterAccount | null; caseRow: StoredOnboarding | null; otherCases: StoredOnboarding[]; contract: StoredContract | null;
  phase: Phase; step: number; group: Group;
  signal: { text: string; at: string | null };
  next: { kind: StepKind; label: string };
  needs: { review: boolean; countersign: boolean; activation: boolean; evidence: boolean; followUp: boolean; expiring: boolean };
}

export const normalizeEmail = (v: string | null | undefined) => String(v ?? '').trim().toLowerCase();
const TEST_PATTERN = /\b(test|demo)\b|onboarding-test|beispiel|example\.|@demo\./i;
export const looksLikeTest = (...values: (string | null | undefined)[]) => values.some(v => TEST_PATTERN.test(String(v ?? '')));

const time = (v: string | null | undefined) => (v ? Date.parse(v) : NaN);
const packetOf = (contracts: StoredContract[], caseId: string) =>
  contracts.find(p => p.case_id === caseId && !['declined', 'voided'].includes(p.state)) ?? null;

/** Wie weit ein Vorgang ist; der weiteste gilt als Hauptvorgang der Person. */
function caseRank(c: StoredOnboarding, packet: StoredContract | null, now: number): number {
  if (c.revoked_at) return -1;
  if (c.activated) return 7;
  if (packet?.state === 'completed') return 6;
  if (packet?.recruiter_signed_at) return 5;
  if (c.state === 'approved') return 4;
  if (c.state === 'review') return 3;
  if (c.state === 'draft') return 2;
  return c.expires_at && time(c.expires_at) <= now ? 0.5 : 1;
}

export function derivePhase(c: StoredOnboarding | null, packet: StoredContract | null, account: RecruiterAccount | null, now: number): Phase {
  if (account?.status === 'suspended') return 'suspended';
  if (c && !c.revoked_at) {
    if (c.activated) return 'active';
    if (packet?.state === 'completed') return 'activate';
    if (packet?.recruiter_signed_at) return 'countersign';
    if (c.state === 'approved') return 'awaiting_signature';
    if (c.state === 'review') return 'review';
    if (c.state === 'draft') return 'draft';
    return c.expires_at && time(c.expires_at) <= now ? 'expired' : 'invited';
  }
  if (account) return account.verified ? 'legacy_active' : 'no_contract';
  return c?.revoked_at ? 'revoked' : 'no_contract';
}

const groupOf = (phase: Phase): Group =>
  phase === 'suspended' ? 'suspended'
  : phase === 'active' || phase === 'legacy_active' ? 'active'
  : phase === 'no_contract' ? 'no_contract'
  : phase === 'revoked' ? 'archive'
  : 'onboarding';

const MAIL_WORDS: Partial<Record<MailEventType, string>> = {
  delivered: 'zugestellt', opened: 'geöffnet', clicked: 'Link geklickt', bounced: 'unzustellbar', complained: 'als Spam gemeldet', failed: 'fehlgeschlagen', suppressed: 'unterdrückt',
};

/** Jüngstes Lebenszeichen einer Person, als kurzer Satz mit Zeitpunkt. */
export function lastSignal(c: StoredOnboarding | null, packet: StoredContract | null, account: RecruiterAccount | null): { text: string; at: string | null } {
  const events: { at: string; text: string }[] = [];
  const add = (at: string | null | undefined, text: string) => { if (at && !Number.isNaN(time(at))) events.push({ at, text }); };
  if (c) {
    add(c.created_at, c.entry_source === 'website' ? 'registriert' : 'Einladung angelegt');
    const mail: MailStat | null | undefined = c.mail;
    if (mail) {
      if (mail.status === 'failed') add(mail.sentAt, 'Mailversand fehlgeschlagen');
      else {
        const blind = !mail.tracked && mail.lastEvent && mail.lastEvent !== 'sent' ? MAIL_WORDS[mail.lastEvent] : null;
        add(mail.sentAt, blind ? `Einladung gesendet, laut Resend ${blind}` : 'Einladung gesendet');
        add(mail.deliveredAt, 'Einladung zugestellt');
        add(mail.opens.last, mail.opens.count > 1 ? `Einladung ${mail.opens.count}× geöffnet` : 'Einladung geöffnet');
        add(mail.clicks.last, 'Link in der Einladung geklickt');
        if (mail.problem && mail.problem.type !== 'delivery_delayed') add(mail.problem.at, `Einladung ${MAIL_WORDS[mail.problem.type]}`);
      }
    } else if (mail === null && c.entry_source !== 'website' && !c.claimed_at) {
      add(c.created_at, 'Link angelegt, keine Mail gesendet');
    }
    add(c.claimed_at, 'Angaben begonnen');
    add(c.reviewed_at, 'Prüfung abgeschlossen');
    add(c.revoked_at, 'Einladung widerrufen');
  }
  add(packet?.recruiter_signed_at, 'hat unterschrieben');
  add(packet?.countersigned_at, 'Matchunt hat gegengezeichnet');
  if (account) {
    add(account.lastSubmissionAt, 'Einreichung');
    if (!c) add(account.createdAt, account.verified ? 'Konto angelegt' : 'registriert, noch ohne Vertrag');
  }
  if (!events.length) return { text: '–', at: null };
  // Bei gleicher Zeit gewinnt das spätere Ereignis der Aufzählung (etwa „Link angelegt, keine Mail“).
  return events.reduce((a, b) => (time(b.at) >= time(a.at) ? b : a));
}

function nextStep(phase: Phase, needs: Partner['needs'], c: StoredOnboarding | null): Partner['next'] {
  switch (phase) {
    case 'countersign': return needs.review ? { kind: 'review', label: 'Prüfen, zeichnen' } : { kind: 'countersign', label: 'Gegenzeichnen' };
    case 'review': return { kind: 'review', label: 'Prüfen' };
    case 'activate': return { kind: 'activate', label: 'Freischalten' };
    case 'awaiting_signature': return { kind: 'wait', label: 'wartet auf Unterschrift' };
    case 'draft': return { kind: 'wait', label: 'Angaben in Arbeit' };
    case 'expired': return { kind: 'resend', label: 'Neuen Link senden' };
    case 'invited':
      if (c && 'mail' in c && c.mail === null) return { kind: 'resend', label: 'Mail senden' };
      return needs.followUp ? { kind: 'remind', label: 'Erinnern' } : { kind: 'wait', label: 'abwarten' };
    case 'no_contract': return { kind: 'start_contract', label: 'Vertrag starten' };
    case 'legacy_active': return { kind: 'start_contract', label: 'Vertrag 2.1 anbieten' };
    default: return { kind: 'none', label: '' };
  }
}

/** Dringlichkeit für die Sortierung: kleiner ist dringender. */
function urgency(p: Partner): number {
  if (p.needs.countersign || p.needs.review) return 0;
  if (p.needs.activation) return 1;
  if (p.needs.evidence) return 2;
  if (p.needs.expiring) return 3;
  if (p.needs.followUp) return 4;
  return ({ onboarding: 5, active: 6, no_contract: 7, suspended: 8, archive: 9 } as Record<Group, number>)[p.group];
}

/** `pendingEvidence`: offene Nachweise je Konto-ID (Profil › Nachweise, zur Prüfung durch Matchunt). */
export function buildPartners(input: { cases: StoredOnboarding[]; contracts: StoredContract[]; accounts: RecruiterAccount[]; pendingEvidence?: Record<string, number>; now?: number }): Partner[] {
  const now = input.now ?? Date.now();
  const people = new Map<string, { cases: StoredOnboarding[]; account: RecruiterAccount | null }>();
  const slot = (email: string) => {
    const key = normalizeEmail(email);
    if (!people.has(key)) people.set(key, { cases: [], account: null });
    return people.get(key)!;
  };
  for (const c of input.cases) slot(c.email).cases.push(c);
  for (const a of input.accounts) slot(a.email).account = a;

  const partners: Partner[] = [];
  for (const [key, { cases, account }] of people) {
    const ranked = [...cases].sort((a, b) => {
      const diff = caseRank(b, packetOf(input.contracts, b.id), now) - caseRank(a, packetOf(input.contracts, a.id), now);
      return diff || time(b.created_at) - time(a.created_at) || 0;
    });
    const caseRow = ranked[0] ?? null;
    const contract = caseRow ? packetOf(input.contracts, caseRow.id) : null;
    const phase = derivePhase(caseRow, contract, account, now);
    const openInvite = !!caseRow && !caseRow.revoked_at && !caseRow.claimed_at && caseRow.entry_source !== 'website' && ['invited', 'expired'].includes(phase);
    const expiresIn = caseRow?.expires_at ? time(caseRow.expires_at) - now : NaN;
    const needs = {
      review: !!caseRow && !caseRow.revoked_at && caseRow.state === 'review',
      countersign: !!caseRow && caseRow.state === 'approved' && contract?.state === 'sent' && !!contract.recruiter_signed_at && !contract.countersigned_at,
      activation: !!caseRow && caseRow.state === 'approved' && contract?.state === 'completed' && !caseRow.activated,
      evidence: (input.pendingEvidence?.[account?.userId ?? caseRow?.claimed_by ?? ''] ?? 0) > 0,
      followUp: openInvite && (phase === 'expired' || now - time(caseRow!.created_at) > FOLLOW_UP_DAYS * DAY),
      expiring: openInvite && phase === 'invited' && expiresIn > 0 && expiresIn <= 2 * DAY,
    };
    const name = caseRow?.profile?.name || account?.name || key;
    const company = caseRow?.profile?.company || account?.company || '';
    partners.push({
      key, email: caseRow?.email ?? account?.email ?? key, name, company, kind: caseRow?.kind ?? null,
      isTest: looksLikeTest(name, company, key, account?.name, ...cases.map(c => c.profile?.name)),
      account, caseRow, otherCases: ranked.slice(1), contract,
      phase, step: PHASE_STEP[phase], group: groupOf(phase),
      signal: lastSignal(caseRow, contract, account),
      next: nextStep(phase, needs, caseRow),
      needs,
    });
  }
  return partners.sort((a, b) => urgency(a) - urgency(b) || time(b.signal.at) - time(a.signal.at) || a.name.localeCompare(b.name, 'de'));
}

export function countTiles(partners: Partner[]): Record<Tile, number> {
  return {
    decide: partners.filter(p => p.needs.review || p.needs.countersign).length,
    activate: partners.filter(p => p.needs.activation).length,
    evidence: partners.filter(p => p.needs.evidence).length,
    followUp: partners.filter(p => p.needs.followUp).length,
    expiring: partners.filter(p => p.needs.expiring).length,
  };
}

export const matchesTile = (p: Partner, tile: Tile) =>
  tile === 'decide' ? p.needs.review || p.needs.countersign
  : tile === 'activate' ? p.needs.activation
  : tile === 'evidence' ? p.needs.evidence
  : tile === 'followUp' ? p.needs.followUp
  : p.needs.expiring;

export function filterPartners(partners: Partner[], opts: { group?: Group | 'all'; tile?: Tile | null; search?: string; hideTests?: boolean }): Partner[] {
  const q = normalizeEmail(opts.search);
  return partners.filter(p =>
    (!opts.hideTests || !p.isTest)
    && (!opts.tile || matchesTile(p, opts.tile))
    && (opts.group === undefined || opts.group === 'all' ? p.group !== 'archive' || !!opts.tile : p.group === opts.group)
    && (!q || `${p.name} ${p.email} ${p.company}`.toLowerCase().includes(q)));
}

export function countGroups(partners: Partner[]): Record<Group | 'all', number> {
  const out = { all: 0, onboarding: 0, active: 0, no_contract: 0, suspended: 0, archive: 0 } as Record<Group | 'all', number>;
  for (const p of partners) { out[p.group]++; if (p.group !== 'archive') out.all++; }
  return out;
}

/** „heute 12:27“, „gestern 09:10“, „vor 3 Tagen“, „am 12.09.2026“. */
export function relativeTime(at: string | null | undefined, now = Date.now()): string {
  if (!at || Number.isNaN(time(at))) return '';
  const d = new Date(at);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(new Date(now)) - day(d)) / DAY);
  const clock = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  if (days <= 0) return `heute ${clock}`;
  if (days === 1) return `gestern ${clock}`;
  if (days < 7) return `vor ${days} Tagen`;
  return `am ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
}

const CASE_EVENTS: Record<string, string> = {
  'case.invited': 'Einladung angelegt', 'case.draft': 'Angaben begonnen', 'case.review': 'Angaben eingereicht', 'case.approved': 'Prüfung abgeschlossen',
};
const CONTRACT_EVENTS: Record<string, string> = {
  'contract.prepared': 'Vertragspaket erstellt', 'contract.sent': 'An DocuSign übergeben', 'contract.completed': 'Vertrag vollständig unterzeichnet',
  'contract.declined': 'Unterschrift abgelehnt', 'contract.voided': 'Vertragsvorgang zurückgenommen', 'contract.manual_review': 'Manuelle Klärung nötig',
};
const MAIL_NAMES: Record<string, string> = {
  recruiter_onboarding_invitation: 'Einladung', recruiter_onboarding_code: 'Anmeldecode', recruiter_onboarding_activation: 'Zugangsmail',
};
export interface TimelineEntry { at: string; text: string; tone?: 'good' | 'warn' | 'muted' }

/** Verlauf der Akte, neueste zuerst: Zustandswechsel, Mails, Unterschriften und Kontodaten. */
export function buildTimeline(input: { caseRow: StoredOnboarding | null; contract: StoredContract | null; mails: MailStat[]; history: AuditEntry[]; account: RecruiterAccount | null }): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const add = (at: string | null | undefined, text: string, tone?: TimelineEntry['tone']) => { if (at && !Number.isNaN(time(at))) out.push({ at, text, ...(tone ? { tone } : {}) }); };
  let lastCase = ''; let lastContract = '';
  for (const h of [...input.history].sort((a, b) => time(a.occurred_at) - time(b.occurred_at))) {
    if (h.event.startsWith('case.')) {
      if (h.event === lastCase) continue;
      add(h.occurred_at, lastCase === 'case.review' && h.event === 'case.draft' ? 'Zur Ergänzung geöffnet' : CASE_EVENTS[h.event] ?? h.event);
      lastCase = h.event;
    } else if (h.event.startsWith('contract.')) {
      if (h.event === lastContract || h.event === 'contract.creating') continue;
      add(h.occurred_at, CONTRACT_EVENTS[h.event] ?? h.event, h.event === 'contract.completed' ? 'good' : h.event === 'contract.declined' || h.event === 'contract.voided' ? 'warn' : undefined);
      lastContract = h.event;
    }
  }
  if (!input.history.length && input.caseRow) {
    add(input.caseRow.created_at, input.caseRow.entry_source === 'website' ? 'Über die Website registriert' : 'Einladung angelegt');
    add(input.caseRow.claimed_at, 'Angaben begonnen');
    add(input.caseRow.reviewed_at, 'Prüfung abgeschlossen');
  }
  add(input.caseRow?.revoked_at, 'Einladung widerrufen', 'muted');
  add(input.contract?.recruiter_signed_at, 'Headhunter hat unterschrieben', 'good');
  add(input.contract?.countersigned_at, 'Matchunt hat gegengezeichnet', 'good');
  for (const m of input.mails) {
    const name = MAIL_NAMES[m.template] ?? 'E-Mail';
    if (m.status === 'failed') { add(m.sentAt, `${name}: Versand fehlgeschlagen`, 'warn'); continue; }
    add(m.sentAt, m.template === 'recruiter_onboarding_code' ? 'Anmeldecode angefordert' : `${name} gesendet`);
    add(m.deliveredAt, `${name} zugestellt`, 'muted');
    add(m.opens.first, `${name} geöffnet`);
    if (m.opens.count > 1) add(m.opens.last, `${name} erneut geöffnet, insgesamt ${m.opens.count}×`);
    add(m.clicks.first, `Link in der ${name} geklickt`);
    if (m.problem) add(m.problem.at, `${name}: ${m.problem.type === 'delivery_delayed' ? 'Zustellung verzögert' : MAIL_WORDS[m.problem.type] ?? m.problem.type}`, 'warn');
  }
  if (input.account) {
    if (!input.caseRow) add(input.account.createdAt, 'Konto registriert');
    add(input.account.lastSubmissionAt, 'Letzte Einreichung');
  }
  return out.sort((a, b) => time(b.at) - time(a.at));
}
