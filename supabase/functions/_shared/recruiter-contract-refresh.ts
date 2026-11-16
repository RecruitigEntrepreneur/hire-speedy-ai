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
/** Der Headhunter wartet auf dem Bestätigungsbildschirm: Nachfragen kurz hintereinander. */
export const SIGNER_INTERVAL_MS = 3_000;
/** Ältere Verträge gelten als liegengeblieben; die fragt der Cron nicht mehr ab. */
export const OPEN_MAX_AGE_DAYS = 60;

/**
 * Darf der Vertrag jetzt bei DocuSign abgefragt werden? Regulär alle 15 Minuten.
 * Kommt jemand aus der EIGENEN Unterschrift zurück, gilt ein Abruf danach nicht als
 * Dauerabfrage:
 * - Headhunter (recruiter_client_user_id), solange seine Unterschrift noch nicht erkannt
 *   ist: alle 3 Sekunden, denn danach geht es direkt ins Dashboard, und die Mail an
 *   Matchunt geht gleich raus. Befund 25.09.2026 (Luca, Greeners GmbH): Ohne diese
 *   Ausnahme wartete die Seite endlos, weil ohne DOCUSIGN_HMAC_KEY kein Webhook kommt.
 *   `viewing_complete` zählt mit: Wer schon unterschrieben hat und den Vertrag noch
 *   einmal öffnet, kommt mit diesem Ereignis zurück.
 * - Gegenzeichner (counter_user_id) nach der Headhunter-Unterschrift: alle 20 Sekunden,
 *   Freischaltung und Willkommensmail folgen sofort.
 */
export function syncDue(e: Pick<RecruiterEnvelope, 'state' | 'recruiter_signed_at' | 'recruiter_client_user_id' | 'counter_user_id' | 'last_synced_at'>, now: number,
  returned?: { event?: unknown; userId: string }): boolean {
  const since = e.last_synced_at ? now - (Date.parse(e.last_synced_at) || 0) : Infinity;
  const open = !!returned && e.state === 'sent';
  const fromSigning = returned?.event === 'signing_complete' || returned?.event === 'viewing_complete';
  const afterRecruiter = open && fromSigning && e.recruiter_client_user_id === returned!.userId && !e.recruiter_signed_at;
  const afterCounter = open && returned!.event === 'signing_complete' && e.counter_user_id === returned!.userId && !!e.recruiter_signed_at;
  return since >= (afterRecruiter ? SIGNER_INTERVAL_MS : afterCounter ? RETURN_INTERVAL_MS : SYNC_INTERVAL_MS);
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

/**
 * Cron docusign-sync: offene Headhunter-Verträge abgleichen, ohne dass jemand die
 * Recruiterverwaltung öffnen muss. Befund 30.10.2026 (Linn): Sie unterschrieb am 24.10.,
 * die Mail an Matchunt ging erst am 29.10. raus, beim nächsten Öffnen der Liste.
 */
export async function refreshOpenRecruiterContracts(db: SupabaseClient, cfg: DocuSignConfig,
  deps = { sync: syncEnvelope, now: () => Date.now() }): Promise<{ checked: number }> {
  const since = new Date(deps.now() - OPEN_MAX_AGE_DAYS * 86_400_000).toISOString();
  const { data, error } = await db.from('recruiter_contract_envelopes').select('*')
    .eq('state', 'sent').not('envelope_id', 'is', null).is('countersigned_at', null).gte('created_at', since);
  if (error) throw new Error(`Offene Headhunter-Verträge nicht lesbar (${error.code ?? 'db'})`);
  const open = (data ?? []) as RecruiterEnvelope[];
  const checked = contractsDueForSync(open, deps.now()).length;
  await refreshDueContracts(db, open, cfg, deps);
  return { checked };
}
