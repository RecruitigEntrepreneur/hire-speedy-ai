import { supabase } from '@/integrations/supabase/client';

/**
 * Zugriff auf die Tabellen der Jobaufnahme-Links.
 *
 * src/integrations/supabase/types.ts wird aus der LAUFENDEN Datenbank
 * generiert. Migrationsdateien aus Git werden bei Lovable nie automatisch
 * angewandt — sie müssen einzeln über den Migrations-Flow angestoßen werden
 * (LOVABLE_DB_PROMPTS.md:254-266). Solange das für
 * supabase/migrations/2026090110*.sql nicht geschehen ist, kennt die generierte
 * Typdatei die neuen Tabellen nicht, und jeder .from('intake_drafts')
 * scheitert am Typecheck.
 *
 * Deshalb genau hier ein Cast: an einer Stelle, benannt und begründet, statt
 * verstreut als `as any` in zwanzig Aufrufen. Sobald die Migrationen angewandt
 * und die Typen neu generiert sind, kann diese Datei ersatzlos entfallen und
 * die Aufrufe gehen direkt auf supabase.from().
 *
 * Zur Laufzeit ändert der Cast nichts: fehlt die Tabelle wirklich, antwortet
 * PostgREST mit einem Fehler, den die aufrufende Stelle sichtbar macht — sie
 * wird nicht still geschluckt.
 */
export type IntakeTable =
  | 'intake_links'
  | 'intake_link_events'
  | 'intake_drafts'
  | 'intake_draft_tokens'
  | 'commercial_terms_templates'
  | 'commercial_mandates'
  | 'intake_link_funnel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const intakeDb = (table: IntakeTable) => (supabase as any).from(table);

/** Erkennt "Tabelle/Spalte gibt es nicht" — also: Migration nicht angewandt. */
export const isMissingSchema = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  if (['42P01', 'PGRST205', 'PGRST204'].includes(error.code ?? '')) return true;
  const m = (error.message ?? '').toLowerCase();
  return (m.includes('relation') && m.includes('does not exist')) ||
    (m.includes('could not find') && m.includes('schema cache'));
};

export const MIGRATION_HINT =
  'Die Tabellen der Jobaufnahme-Links fehlen in der Datenbank. Die Migrationen ' +
  'supabase/migrations/2026090110*.sql müssen in Lovable angestoßen werden — ' +
  'siehe LOVABLE_DB_PROMPTS.md.';
