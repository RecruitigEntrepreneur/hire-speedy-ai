import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { DocuSignConfig } from './docusign.ts';
import { syncEnvelope, type RecruiterEnvelope } from './recruiter-onboarding-service.ts';

/**
 * Sicherheitsnetz der Recruiterverwaltung. DocuSign meldet Unterschriften nur
 * mit DOCUSIGN_HMAC_KEY selbst, und nur für danach erstellte Umschläge. Deshalb
 * gleicht das Öffnen der Liste offene Verträge mit DocuSign ab; dabei geht auch
 * die Mail „hat unterschrieben – bitte gegenzeichnen“ raus.
 * DocuSign erlaubt je Umschlag höchstens alle 15 Minuten eine Statusabfrage.
 */
export const SYNC_INTERVAL_MS = 15 * 60_000;
/** Mehr Abfragen je Listenaufruf würden das Laden spürbar bremsen. */
export const LIST_SYNC_LIMIT = 5;
/** Rückkehr aus der eigenen Gegenzeichnung: Mindestabstand statt 15 Minuten. */
export const RETURN_INTERVAL_MS = 20_000;

/**
 * Darf der Vertrag jetzt bei DocuSign abgefragt werden? Regulär alle 15 Minuten.
 * Kommt der hinterlegte Gegenzeichner mit event=signing_complete aus DocuSign zurück,
 * gilt ein einzelner Abruf nach seiner Unterschrift nicht als Dauerabfrage: dann
 * reichen 20 Sekunden Abstand, damit Freischaltung und Willkommensmail sofort folgen.
 */
export function syncDue(e: Pick<RecruiterEnvelope, 'state' | 'recruiter_signed_at' | 'counter_user_id' | 'last_synced_at'>, now: number,
  returned?: { event?: unknown; userId: string }): boolean {
  const since = e.last_synced_at ? now - (Date.parse(e.last_synced_at) || 0) : Infinity;
  const afterCounter = !!returned && returned.event === 'signing_complete' && e.counter_user_id === returned.userId
    && e.state === 'sent' && !!e.recruiter_signed_at;
  return since >= (afterCounter ? RETURN_INTERVAL_MS : SYNC_INTERVAL_MS);
}

type Row = Pick<RecruiterEnvelope, 'state' | 'envelope_id' | 'countersigned_at' | 'last_synced_at'>;

/** Versendete Verträge ohne Gegenzeichnung, deren letzter Abgleich lange genug her ist; älteste zuerst. */
export function contractsDueForSync<T extends Row>(contracts: T[], now: number, limit = LIST_SYNC_LIMIT): T[] {
  const synced = (c: T) => (c.last_synced_at ? Date.parse(c.last_synced_at) : 0) || 0;
  return contracts
    .filter(c => c.state === 'sent' && c.envelope_id && !c.countersigned_at && now - synced(c) >= SYNC_INTERVAL_MS)
    .sort((a, b) => synced(a) - synced(b))
    .slice(0, limit);
}

/** Gleicht die fälligen Verträge ab und gibt die Liste mit frischem Stand zurück. Wirft nie. */
export async function refreshDueContracts(db: SupabaseClient, contracts: RecruiterEnvelope[], cfg: DocuSignConfig,
  deps = { sync: syncEnvelope, now: () => Date.now() }): Promise<RecruiterEnvelope[]> {
  const due = contractsDueForSync(contracts, deps.now());
  if (!due.length) return contracts;
  const results = await Promise.allSettled(due.map(c => deps.sync(db, c, cfg)));
  const fresh = new Map<string, RecruiterEnvelope>();
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') fresh.set(r.value.id, r.value);
    else console.error('[recruiter-admin] Abgleich mit DocuSign fehlgeschlagen', due[i].id, r.reason instanceof Error ? r.reason.message : r.reason);
  });
  return contracts.map(c => fresh.get(c.id) ?? c);
}
