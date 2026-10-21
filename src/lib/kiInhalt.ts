import {
  bereinigeInhalt, bereinigeText, faktenText, vorteilBegriffe, type KiTexte,
} from '../../supabase/functions/_shared/recruiter-anzeige.ts';

/**
 * Die KI-Aufbereitung einer Stelle, wie Headhunter sie sehen dürfen (21.10.2026):
 * ohne Marktstellung, falsche Zahlen und „von Vorteil“ als Pflicht. Der
 * Generator streicht das schon beim Schreiben; diese Fassung schützt auch die
 * Texte, die vorher entstanden sind.
 */
export function kiInhalt<T extends KiTexte>(job: { formatted_content?: unknown } & Record<string, unknown>): T | null {
  const fc = job.formatted_content;
  if (!fc || typeof fc !== 'object') return null;
  return bereinigeInhalt(fc as T, faktenText(job), vorteilBegriffe(job)).content;
}

/** Ein einzelner KI-Satz außerhalb von formatted_content, etwa aus job_summary. */
export function kiSatz(job: Record<string, unknown>, text: unknown): string | null {
  if (typeof text !== 'string' || !text.trim()) return null;
  return bereinigeText(text.trim(), faktenText(job), vorteilBegriffe(job));
}
