/** Bezeichnungen rund um Feedback-Tickets — eine Stelle für Lasche und Admin. */

export type FeedbackKind = 'bug' | 'unclear' | 'idea' | 'praise';
export type FeedbackSeverity = 'blocker' | 'annoying' | 'minor';
export type FeedbackStatus = 'new' | 'in_progress' | 'built' | 'done' | 'dismissed' | 'duplicate';
export type FeedbackPriority = 'p0' | 'p1' | 'p2' | 'p3';
export type FeedbackArea = 'client' | 'recruiter' | 'intake' | 'admin' | 'other';

export const KIND_OPTIONS: { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: 'Fehler' },
  { value: 'unclear', label: 'Unklar' },
  { value: 'idea', label: 'Idee' },
  { value: 'praise', label: 'Gefällt mir' },
];
export const KIND_LABEL = Object.fromEntries(KIND_OPTIONS.map((o) => [o.value, o.label])) as Record<FeedbackKind, string>;

export const SEVERITY_OPTIONS: { value: FeedbackSeverity; label: string }[] = [
  { value: 'blocker', label: 'Blockiert mich' },
  { value: 'annoying', label: 'Nervt' },
  { value: 'minor', label: 'Kleinigkeit' },
];
export const SEVERITY_LABEL = Object.fromEntries(SEVERITY_OPTIONS.map((o) => [o.value, o.label])) as Record<FeedbackSeverity, string>;

/** Ablauf: Neu → In Arbeit → Gebaut (wartet auf Deploy) → Live erledigt. */
export const STATUS_FLOW: FeedbackStatus[] = ['new', 'in_progress', 'built', 'done'];
export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: 'Neu',
  in_progress: 'In Arbeit',
  built: 'Gebaut, wartet auf Deploy',
  done: 'Live erledigt',
  dismissed: 'Verworfen',
  duplicate: 'Duplikat',
};
export const STATUS_SHORT: Record<FeedbackStatus, string> = {
  new: 'Neu',
  in_progress: 'In Arbeit',
  built: 'Wartet auf Deploy',
  done: 'Live',
  dismissed: 'Verworfen',
  duplicate: 'Duplikat',
};
/** Was der Absender in „Ihre Meldungen“ sieht. */
export const STATUS_FOR_REPORTER: Record<FeedbackStatus, string> = {
  new: 'Eingegangen',
  in_progress: 'In Arbeit',
  built: 'Umgesetzt, kommt bald',
  done: 'Erledigt',
  dismissed: 'Geschlossen',
  duplicate: 'Eingegangen',
};
export const OPEN_STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'built'];

export const PRIORITY_OPTIONS: { value: FeedbackPriority; label: string; hint: string }[] = [
  { value: 'p0', label: 'P0', hint: 'Kernprozess blockiert, Datenverlust oder Datenleck' },
  { value: 'p1', label: 'P1', hint: 'Wichtiger Ablauf stark gestört' },
  { value: 'p2', label: 'P2', hint: 'Störend, es gibt einen Umweg' },
  { value: 'p3', label: 'P3', hint: 'Kosmetik, Idee, Lob' },
];

export const AREA_LABEL: Record<FeedbackArea, string> = {
  client: 'Kunde',
  recruiter: 'Headhunter',
  intake: 'Aufnahme-Link',
  admin: 'Admin',
  other: 'Sonstiges',
};

export const ROLE_LABEL: Record<string, string> = {
  client: 'Kunde',
  recruiter: 'Headhunter',
  guest: 'Gast (Aufnahme-Link)',
  admin: 'Admin',
};

export const ticketLabel = (no: number | string | null | undefined) =>
  no == null ? 'FB-…' : `FB-${String(no).padStart(4, '0')}`;

/** „FB-0012“, „fb-12“ oder „12“ → 12 */
export function parseTicket(value: string | undefined): number | null {
  const m = /^(?:fb-?)?0*(\d+)$/i.exec((value ?? '').trim());
  return m ? Number(m[1]) : null;
}

/** „Chrome 141 · macOS“ aus dem User-Agent. */
export function shortBrowser(ua: string | null | undefined): string {
  if (!ua) return 'Browser unbekannt';
  const version = (re: RegExp) => re.exec(ua)?.[1];
  const browser = version(/Edg\/(\d+)/)
    ? `Edge ${version(/Edg\/(\d+)/)}`
    : version(/Firefox\/(\d+)/)
    ? `Firefox ${version(/Firefox\/(\d+)/)}`
    : version(/Chrome\/(\d+)/)
    ? `Chrome ${version(/Chrome\/(\d+)/)}`
    : /Version\/(\d+).*Safari/.test(ua)
    ? `Safari ${version(/Version\/(\d+)/)}`
    : 'Browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
}
