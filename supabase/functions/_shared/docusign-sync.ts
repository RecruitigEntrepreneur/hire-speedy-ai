import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { DocuSignConfig } from './docusign.ts';
import type { ApplyResult, SignerState } from './docusign-apply.ts';

/**
 * Offene Kundenumschläge bei DocuSign nachfragen (Entscheidung 25.09.2026).
 *
 * Die schnelle Meldung ist der Webhook. Er setzt den HMAC-Schlüssel voraus,
 * und eine verlorene Zustellung merkt niemand: Dann wartet der Kunde nach
 * unserer Gegenzeichnung auf einen Zugang, der nie kommt (Kanna Medics,
 * 25.09.2026). Dieser Lauf holt den Stand alle 15 Minuten selbst und wendet
 * ihn mit derselben Logik an (docusign-apply.ts).
 *
 * DocuSign erlaubt je Umschlag höchstens eine Abfrage alle 15 Minuten. Der
 * Zeitstempel wird VOR der Abfrage gesetzt, damit ein Fehler nicht zu
 * Wiederholungen im Minutentakt führt.
 */

export const SYNC_INTERVAL_MS = 15 * 60_000;
/** Name des Cron-Schlüssels in private.cron_tokens (Migration 20260926151000). */
export const CRON_TOKEN_NAME = 'docusign-sync';
/** Ältere Umschläge gelten als liegengeblieben; die fragt niemand mehr automatisch ab. */
export const SYNC_MAX_AGE_DAYS = 60;
const BATCH = 10;

export interface OpenEnvelope { id: string; envelope_id: string; envelope_last_synced_at: string | null }

export const syncDue = (lastSyncedAt: string | null | undefined, now = Date.now()) =>
  !lastSyncedAt || now - Date.parse(lastSyncedAt) >= SYNC_INTERVAL_MS;

/** Versendet, nicht gegengezeichnet, nicht abgelehnt, und seit 15 Minuten nicht gefragt. */
export async function openEnvelopes(db: SupabaseClient, now = Date.now()): Promise<OpenEnvelope[]> {
  const due = new Date(now - SYNC_INTERVAL_MS).toISOString();
  const since = new Date(now - SYNC_MAX_AGE_DAYS * 86_400_000).toISOString();
  const { data, error } = await db.from('commercial_mandates')
    .select('id,envelope_id,envelope_last_synced_at')
    .not('envelope_id', 'is', null)
    .is('countersigned_at', null)
    .is('declined_at', null)
    .not('status', 'in', '(withdrawn,declined)')
    .gte('signature_sent_at', since)
    .or(`envelope_last_synced_at.is.null,envelope_last_synced_at.lt."${due}"`)
    .order('envelope_last_synced_at', { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) throw new Error(`Offene Umschläge nicht lesbar (${error.code ?? 'db'})`);
  return (data ?? []) as OpenEnvelope[];
}

export interface SyncDeps {
  status: (cfg: DocuSignConfig, envelopeId: string) => Promise<{ status: string; recipients?: { signers?: SignerState[] } }>;
  apply: (db: SupabaseClient, envelopeId: string, signers: SignerState[]) => Promise<ApplyResult>;
  saveDocument: (db: SupabaseClient, envelopeId: string, ids: Pick<ApplyResult, 'mandateId' | 'frameworkId'>) => Promise<void>;
}

/** Einen Durchlauf. Ein Fehler bei einem Umschlag hält die anderen nicht auf. */
export async function syncClientEnvelopes(db: SupabaseClient, cfg: DocuSignConfig, deps: SyncDeps, now = Date.now()) {
  const open = await openEnvelopes(db, now);
  const results: { envelope_id: string; status?: string; countersigned?: boolean; error?: string }[] = [];
  for (const m of open) {
    await db.from('commercial_mandates')
      .update({ envelope_last_synced_at: new Date(now).toISOString() }).eq('id', m.id);
    try {
      const stand = await deps.status(cfg, m.envelope_id);
      const ergebnis = await deps.apply(db, m.envelope_id, (stand?.recipients?.signers ?? []) as SignerState[]);
      if (ergebnis.matched && (stand?.status === 'completed' || (ergebnis.customerSigned && ergebnis.countersigned))) {
        await deps.saveDocument(db, m.envelope_id, ergebnis);
      }
      results.push({ envelope_id: m.envelope_id, status: stand?.status, countersigned: ergebnis.countersigned });
    } catch (e) {
      console.warn('[docusign-sync] Umschlag nicht abgeglichen:', m.envelope_id, e instanceof Error ? e.message : e);
      results.push({ envelope_id: m.envelope_id, error: e instanceof Error ? e.message : 'unbekannt' });
    }
  }
  return { checked: results.length, results };
}

/**
 * Wer den Abgleich auslösen darf: der Cron mit seinem Schlüssel (x-cron-token,
 * Migration 20260926151000 -- app.settings gibt es in diesem Projekt nicht)
 * oder das eigene Backend mit dem Service-Schlüssel.
 */
export async function syncAllowed(req: Request, db: SupabaseClient, isService: (req: Request) => boolean): Promise<boolean> {
  if (isService(req)) return true;
  const token = req.headers.get('x-cron-token');
  if (!token || token.length < 32) return false;
  const { data, error } = await db.rpc('cron_token_valid', { _name: CRON_TOKEN_NAME, _token: token });
  if (error) console.warn('[docusign-sync] Cron-Schlüssel nicht prüfbar:', error.message);
  return !error && data === true;
}
