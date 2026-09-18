/**
 * Mail-Statistik für transaktionale Mails aus der Tabelle email_events.
 *
 * Resend meldet Zustellung, Öffnen und Klicks per Webhook. Bis zum 18.09.2026
 * landeten diese Ereignisse nur bei Outreach-Mails; Einladungen, Anmeldecodes
 * und Freischaltungen blieben blind. Jetzt schreibt der Webhook sie in
 * email_events.metadata.events mit, und die Admin-Karte eines Vorgangs zeigt
 * daraus, wann und wie oft eine Mail geöffnet oder ein Link geklickt wurde.
 *
 * Reine Funktionen ohne Netz und ohne Deno; das Frontend nutzt die Typen.
 */

export type MailEventType = 'sent' | 'delivered' | 'delivery_delayed' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'failed' | 'suppressed';
export interface MailEvent { type: MailEventType; at: string; link?: string }
export type MailProblem = 'bounced' | 'complained' | 'failed' | 'suppressed' | 'delivery_delayed';
export interface MailStat {
  id: string;
  template: string;
  to: string;
  subject: string;
  /** Übergabe an Resend. */
  sentAt: string;
  /** pending, sent oder failed: Ergebnis der Übergabe an Resend. */
  status: string;
  error: string | null;
  /** Jüngstes Ereignis; ohne mitgeschriebene Ereignisse der letzte Stand laut Resend-API. */
  lastEvent: MailEventType | null;
  /** Webhook-Ereignisse liegen vor. Ohne sie gibt es weder Uhrzeiten noch Anzahlen. */
  tracked: boolean;
  deliveredAt: string | null;
  opens: { count: number; first: string | null; last: string | null };
  clicks: { count: number; first: string | null; last: string | null; links: string[] };
  problem: { type: MailProblem; at: string } | null;
  events: MailEvent[];
}
export interface MailRow {
  id: string; to_email?: string | null; template_name?: string | null; subject?: string | null;
  status?: string | null; error_message?: string | null; metadata?: unknown; created_at: string;
}

export const MAIL_EVENT_TYPES: readonly MailEventType[] = ['sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'bounced', 'complained', 'failed', 'suppressed'];
const PROBLEMS: readonly MailProblem[] = ['bounced', 'complained', 'failed', 'suppressed', 'delivery_delayed'];
/** Obergrenze je Mail; ältere Ereignisse fallen heraus. */
export const MAX_MAIL_EVENTS = 200;

const isType = (v: unknown): v is MailEventType => typeof v === 'string' && (MAIL_EVENT_TYPES as readonly string[]).includes(v);
const validTime = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

function readEvents(value: unknown): MailEvent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((e): e is MailEvent => !!e && typeof e === 'object' && isType((e as MailEvent).type) && validTime((e as MailEvent).at));
}

/**
 * Resend-Webhook in ein Ereignis übersetzen. Zeitpunkt ist der des Ereignisses
 * (bei Klicks click.timestamp), nicht data.created_at: das ist der Versand.
 */
export function eventFromWebhook(body: unknown): { resendId: string; event: MailEvent } | null {
  const b = body && typeof body === 'object' ? body as { type?: unknown; created_at?: unknown; data?: unknown } : null;
  const type = typeof b?.type === 'string' ? b.type.replace(/^email\./, '') : '';
  if (!isType(type)) return null;
  const data = b?.data && typeof b.data === 'object' ? b.data as Record<string, unknown> : {};
  const resendId = typeof data.email_id === 'string' ? data.email_id.trim() : '';
  if (!resendId) return null;
  const click = data.click && typeof data.click === 'object' ? data.click as Record<string, unknown> : null;
  const at = [click?.timestamp, b?.created_at].find(validTime);
  const link = typeof click?.link === 'string' && click.link ? click.link.slice(0, 300) : undefined;
  return { resendId, event: { type, at: new Date(at ?? Date.now()).toISOString(), ...(link ? { link } : {}) } };
}

/**
 * Ereignis in die Metadaten einer Mail übernehmen. Resend wiederholt Webhooks;
 * dasselbe Ereignis zur selben Zeit zählt deshalb nur einmal. Übrige Metadaten
 * (case_id, resend_id) bleiben unverändert.
 */
export function mergeEmailEvent(metadata: unknown, event: MailEvent): Record<string, unknown> {
  const meta = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { ...(metadata as Record<string, unknown>) } : {};
  const events = readEvents(meta.events);
  if (events.some(e => e.type === event.type && e.at === event.at && (e.link ?? '') === (event.link ?? ''))) return meta;
  meta.events = [...events, event].sort((a, b) => a.at.localeCompare(b.at)).slice(-MAX_MAIL_EVENTS);
  return meta;
}

/** Zeile aus email_events zur Statistik verdichten. */
export function summarizeMail(row: MailRow): MailStat {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
  const events = readEvents(meta.events);
  const of = (type: MailEventType) => events.filter(e => e.type === type);
  const opens = of('opened');
  const clicks = of('clicked');
  const problem = [...events].reverse().find(e => (PROBLEMS as readonly string[]).includes(e.type));
  return {
    id: row.id,
    template: row.template_name ?? '',
    to: row.to_email ?? '',
    subject: row.subject ?? '',
    sentAt: row.created_at,
    status: row.status ?? 'pending',
    error: row.error_message ?? null,
    lastEvent: events.length ? events[events.length - 1].type : isType(meta.resend_last_event) ? meta.resend_last_event : null,
    tracked: events.length > 0,
    deliveredAt: of('delivered')[0]?.at ?? null,
    opens: { count: opens.length, first: opens[0]?.at ?? null, last: opens[opens.length - 1]?.at ?? null },
    clicks: {
      count: clicks.length, first: clicks[0]?.at ?? null, last: clicks[clicks.length - 1]?.at ?? null,
      links: [...new Set(clicks.map(c => c.link).filter((l): l is string => !!l))],
    },
    problem: problem ? { type: problem.type as MailProblem, at: problem.at } : null,
    events,
  };
}
