import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { firmierungAus } from './firma-pflicht.ts';

/**
 * Firmenprofil aus der Aufnahme (Variante B, Entscheidung 26.09.2026).
 *
 * Befund (Luca Bartosch, Kanna Medics, 26.09.2026): Die Annahme legte Konto,
 * Organisation und Stelle an, aber kein Firmenprofil. Alles, was der Kunde in
 * der Aufnahme angegeben hatte (Firmierung, Anschrift, Register, USt-IdNr.),
 * lag nur in der Aufnahme -- der Start-Kasten im Dashboard meldete
 * "Firmendaten fehlt", obwohl nichts fehlte.
 *
 * Still übernommen werden nur Stammdaten und Kennzahlen, und nur in LEERE
 * Felder: was der Kunde selbst eingetragen hat, bleibt unangetastet. Was je
 * nach Stelle anders sein kann (Arbeitsweise, Benefits, Arbeitgeberargumente,
 * Ziel-/No-Go-Firmen), schlägt die Einstellungsseite nur vor.
 */

type Json = Record<string, any>;

/** Die Felder, die still aus der Aufnahme kommen dürfen. */
export const STAMMFELDER = [
  'company_name', 'legal_name', 'street', 'postal_code', 'city', 'registration_number',
  'tax_id', 'website', 'industry', 'billing_email', 'headcount',
] as const;
export type Stammfeld = typeof STAMMFELDER[number];

const text = (v: unknown): string | null => {
  const s = String(v ?? '').trim();
  return s ? s : null;
};

const ganzzahl = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

/** Was die Aufnahme über die Firma weiß -- in den Spaltennamen des Firmenprofils. */
export function stammdatenAusAufnahme(draft: Json, jobRow: Json = {}): Partial<Record<Stammfeld, string | number>> {
  const werte: Partial<Record<Stammfeld, string | number | null>> = {
    company_name: text(draft.company_name),
    legal_name: text(firmierungAus(draft)),
    street: text(draft.company_street),
    postal_code: text(draft.company_postal_code),
    city: text(draft.company_city),
    registration_number: text(draft.company_registration_number),
    tax_id: text(draft.company_vat_id),
    website: text(draft.company_website) ?? text(draft.company_domain),
    industry: text(draft.company_industry) ?? text(jobRow.industry),
    billing_email: text(draft.billing_email) ?? text(draft.contact_email),
    headcount: ganzzahl(jobRow.company_headcount),
  };
  const out: Partial<Record<Stammfeld, string | number>> = {};
  for (const [k, v] of Object.entries(werte)) if (v != null) out[k as Stammfeld] = v;
  return out;
}

const leer = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');

/** Nur die Felder, die im Profil noch leer sind. */
export function nurLeereFelder<T extends Record<string, unknown>>(profil: Json | null, daten: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(daten)) {
    if (leer(v)) continue;
    if (!profil || leer(profil[k])) (out as Json)[k] = v;
  }
  return out;
}

/**
 * Bei der Annahme: das Firmenprofil des Kundenkontos aus der Aufnahme füllen.
 * Nicht blockierend -- scheitert es, ist die Annahme trotzdem gültig; der
 * Kunde kann die Angaben in den Einstellungen ergänzen.
 */
export async function firmenprofilAusAufnahme(
  db: SupabaseClient, userId: string, draft: Json, jobRow: Json = {},
): Promise<{ gefuellt: string[]; fehler?: string }> {
  try {
    const daten = stammdatenAusAufnahme(draft, jobRow);
    const { data: profil } = await db.from('company_profiles').select('*').eq('user_id', userId).maybeSingle();
    const patch = nurLeereFelder(profil as Json | null, daten) as Json;
    const gefuellt = Object.keys(patch);
    if (!gefuellt.length) return { gefuellt };

    // Die alte Adresszeile mitführen: Bestandsansichten lesen noch sie.
    if ((patch.street || patch.city) && leer((profil as Json | null)?.address)) {
      const s = patch.street ?? (profil as Json | null)?.street;
      const ort = [patch.postal_code ?? (profil as Json | null)?.postal_code, patch.city ?? (profil as Json | null)?.city]
        .filter(Boolean).join(' ');
      patch.address = [s, ort].filter(Boolean).join(', ') || null;
    }
    const alt = ((profil as Json | null)?.intake_source?.fields ?? []) as string[];
    patch.intake_source = {
      draft_id: draft.id ?? null,
      at: new Date().toISOString(),
      fields: [...new Set([...alt, ...gefuellt])],
    };

    const res = profil
      ? await db.from('company_profiles').update(patch).eq('user_id', userId)
      : await db.from('company_profiles').insert({ user_id: userId, company_name: daten.company_name ?? 'Unbekannt', ...patch });
    if (res.error) return { gefuellt: [], fehler: res.error.message };
    return { gefuellt };
  } catch (e) {
    return { gefuellt: [], fehler: e instanceof Error ? e.message : String(e) };
  }
}
