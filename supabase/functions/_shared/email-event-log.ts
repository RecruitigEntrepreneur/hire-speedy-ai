import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { eventFromWebhook, mergeEmailEvent, summarizeMail, type MailRow, type MailStat } from './email-stats.ts';

/**
 * Datenbankseite der Mail-Statistik (Regeln in email-stats.ts).
 *
 * recordEmailEvent  vom Resend-Webhook: Ereignis bei der passenden Zeile in
 *                   email_events mitschreiben, gefunden über metadata.resend_id.
 * caseMails         für die Admin-Karte: alle Mails eines Onboarding-Vorgangs.
 *                   Für Mails ohne mitgeschriebene Ereignisse, etwa alles vor dem
 *                   18.09.2026, fragt es Resend nach dem letzten Stand.
 * invitationMails   für die Liste: je Vorgang die jüngste Einladungsmail.
 */

const COLUMNS = 'id,to_email,template_name,subject,status,error_message,metadata,created_at';
/** Live-Abfragen je Karte; die Resend-API erlaubt nur wenige Aufrufe pro Sekunde. */
const LIVE_LIMIT = 3;

const resendIdOf = (row: MailRow): string | null => {
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
  return typeof meta.resend_id === 'string' && meta.resend_id ? meta.resend_id : null;
};
const hasEvents = (row: MailRow) => summarizeMail(row).tracked;

export async function recordEmailEvent(db: SupabaseClient, body: unknown): Promise<boolean> {
  const parsed = eventFromWebhook(body);
  if (!parsed) return false;
  const { data, error } = await db.from('email_events').select('id,metadata').eq('metadata->>resend_id', parsed.resendId).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return false;
  const { error: updateError } = await db.from('email_events').update({ metadata: mergeEmailEvent(data.metadata, parsed.event) }).eq('id', data.id);
  if (updateError) throw updateError;
  return true;
}

export interface LiveDeps { fetch: typeof fetch; apiKey?: string; now?: () => Date }

export async function caseMails(db: SupabaseClient, caseId: string, deps: LiveDeps): Promise<MailStat[]> {
  const { data, error } = await db.from('email_events').select(COLUMNS)
    .eq('metadata->>case_id', caseId).order('created_at', { ascending: false }).limit(30);
  if (error) throw error;
  const rows = (data ?? []) as MailRow[];
  if (deps.apiKey) {
    for (const row of rows.filter(r => resendIdOf(r) && !hasEvents(r)).slice(0, LIVE_LIMIT)) {
      try {
        const res = await deps.fetch(`https://api.resend.com/emails/${encodeURIComponent(resendIdOf(row)!)}`, {
          headers: { Authorization: `Bearer ${deps.apiKey}` }, signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const payload = await res.json().catch(() => null);
        if (typeof payload?.last_event !== 'string') continue;
        const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
        row.metadata = { ...meta, resend_last_event: payload.last_event, resend_checked_at: (deps.now?.() ?? new Date()).toISOString() };
        await db.from('email_events').update({ metadata: row.metadata }).eq('id', row.id);
      } catch {
        // Resend nicht erreichbar: die Karte zeigt dann den gespeicherten Stand.
      }
    }
  }
  return rows.map(summarizeMail);
}

export async function invitationMails(db: SupabaseClient, caseIds: string[]): Promise<Record<string, MailStat>> {
  if (!caseIds.length) return {};
  const { data, error } = await db.from('email_events').select(COLUMNS)
    .eq('template_name', 'recruiter_onboarding_invitation').in('metadata->>case_id', caseIds)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const byCase: Record<string, MailStat> = {};
  for (const row of (data ?? []) as MailRow[]) {
    const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {};
    const id = typeof meta.case_id === 'string' ? meta.case_id : '';
    if (id && !byCase[id]) byCase[id] = summarizeMail(row);
  }
  return byCase;
}
