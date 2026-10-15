/**
 * Automatischer Abgleich einer beantragten Firma mit ihrem Impressum
 * (enrich-company-from-domain). Ergebnis je Feld für die Admin-Prüfung;
 * entscheiden tut Matchunt.
 */
export type CheckStatus = 'ok' | 'diff' | 'missing' | 'empty';
export interface FieldCheck { status: CheckStatus; text: string; found?: string | null }
export interface CheckReport {
  checked_via: 'impressum' | 'none';
  url: string | null;
  fields: Partial<Record<'legal_name' | 'registration_number' | 'vat_id' | 'address' | 'website', FieldCheck>>;
  note?: string;
}

interface Angaben {
  name: string;
  legal_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  registration_number: string | null;
  vat_id: string | null;
  website: string | null;
}

type Impressum = Partial<Record<'legal_name' | 'street' | 'postal_code' | 'city' | 'registration_number' | 'vat_id', string | undefined>>;

/** Vergleichbar machen: klein, ohne Umlaut-Varianten, Satzzeichen und Leerzeichen. */
export function canon(v: string | null | undefined): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/straße|strasse/g, 'str')
    .replace(/[^a-z0-9]/g, '');
}

/** „HRB 123456 B · AG Charlottenburg“ → „hrb123456“ (Art + Nummer). */
export function registerKey(v: string | null | undefined): string {
  const m = /\b(HRA|HRB|GnR|PR|VR)\s*[-.:]?\s*(\d+)/i.exec(String(v ?? ''));
  return m ? `${m[1].toLowerCase()}${m[2]}` : canon(v).replace(/[^0-9]/g, '');
}

/** Deutsches Format DE + 9 Ziffern; andere Länder nur grob (2 Buchstaben + 8–12 Zeichen). */
export function vatFormatOk(v: string | null | undefined): boolean {
  const s = String(v ?? '').replace(/\s+/g, '').toUpperCase();
  if (s.startsWith('DE')) return /^DE\d{9}$/.test(s);
  return /^[A-Z]{2}[0-9A-Z]{8,12}$/.test(s);
}

function field(ours: string, theirs: string | undefined, same: (a: string, b: string) => boolean, label: { ok: string }): FieldCheck {
  if (!ours.trim()) return { status: 'empty', text: 'nicht angegeben' };
  if (!theirs?.trim()) return { status: 'missing', text: 'im Impressum nicht gefunden' };
  return same(ours, theirs)
    ? { status: 'ok', text: label.ok, found: theirs }
    : { status: 'diff', text: `? Impressum nennt ${theirs}`, found: theirs };
}

export function compareWithImpressum(c: Angaben, imp: Impressum, url: string | null): CheckReport {
  if (!url && !Object.values(imp).some(Boolean)) {
    return { checked_via: 'none', url: null, fields: {}, note: 'Kein Impressum auf der Website gefunden.' };
  }
  const name = (c.legal_name || c.name || '').trim();
  const nameCheck = field(name, imp.legal_name, (a, b) => {
    const x = canon(a), y = canon(b);
    return x === y || (x.length > 4 && y.includes(x)) || (y.length > 4 && x.includes(y));
  }, { ok: '✓ passt zum Impressum' });

  const hrb = field(c.registration_number ?? '', imp.registration_number, (a, b) => registerKey(a) === registerKey(b), { ok: '✓ passt zum Impressum' });

  let vat = field(c.vat_id ?? '', imp.vat_id, (a, b) => canon(a) === canon(b), { ok: '✓ steht im Impressum' });
  if (c.vat_id && !vatFormatOk(c.vat_id)) vat = { status: 'diff', text: '? Format ungültig', found: imp.vat_id ?? null };

  const ourStreet = c.street ?? '';
  const address: FieldCheck = !ourStreet.trim() && !c.postal_code
    ? { status: 'empty', text: 'nicht angegeben' }
    : !imp.street && !imp.postal_code
      ? { status: 'missing', text: 'im Impressum nicht gefunden' }
      : canon(ourStreet) === canon(imp.street) && (!imp.postal_code || imp.postal_code === c.postal_code)
        ? { status: 'ok', text: '✓ passt zum Impressum', found: [imp.street, [imp.postal_code, imp.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') }
        : { status: 'diff', text: `? Impressum nennt ${[imp.street, [imp.postal_code, imp.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}` };

  return {
    checked_via: 'impressum',
    url,
    fields: {
      legal_name: nameCheck,
      registration_number: hrb,
      vat_id: vat,
      address,
      website: url ? { status: 'ok', text: '✓ Impressum gefunden' } : { status: 'missing', text: 'Impressum nicht eindeutig' },
    },
  };
}
