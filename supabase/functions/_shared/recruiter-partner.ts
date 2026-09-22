/**
 * Partnerstatus „Matchunt Partner“ (Etappe 3, freigegeben 22.09.2026).
 *
 * Wer einen gegengezeichneten Vertrag ab Fassung 2.1 hat, bekommt eine Partnernummer
 * und eine öffentliche Prüfseite. Im Profil liegen die Bausteine, mit denen er den
 * Status zeigen kann: LinkedIn-Zertifikat, E-Mail-Signatur, Website-Abzeichen, Texte.
 * Alles ist freiwillig; eine Pflicht, den Status zu zeigen, wäre selbst ein Indiz für
 * Eingliederung (Rechtsrecherche 22.09.2026).
 *
 * Reine Funktionen; Frontend und Edge Functions importieren diese Datei.
 */

export const APP_ORIGIN = 'https://matchunt.ai';

/**
 * Numerische ID der LinkedIn-Unternehmensseite „Matchunt“. Die Seite gibt es noch nicht
 * (Stand 22.09.2026). Solange hier null steht, bleibt das Zertifikat im LinkedIn-Fenster
 * zu: ohne Seite hätte es kein Logo, und alte Einträge bekämen es auch später nicht.
 */
export const LINKEDIN_ORGANIZATION_ID: string | null = null;

/** Ohne 0, 1, I, L, O und U: nichts, was man am Telefon oder auf Papier verwechselt. */
export const PARTNER_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export const PARTNER_NUMBER = /^MP-[2-9A-HJKMNP-TV-Z]{4}-[2-9A-HJKMNP-TV-Z]{4}$/;
/** Erst Anlage 6 der Fassung 2.1 erlaubt Name und Abzeichen. */
export const MIN_CONTRACT_VERSION = '2.1';
/** Nach dem Ende zeigt die Prüfseite so lange „nicht mehr aktiv“, danach nur „ungültig“ (Anwalt prüft die Dauer). */
export const ENDED_VISIBLE_DAYS = 183;
const DAY = 86_400_000;

export type PartnerTier = 'partner' | 'gold';
export type PartnerChannel = 'linkedin' | 'signature' | 'post';
export const PARTNER_CHANNELS: readonly PartnerChannel[] = ['linkedin', 'signature', 'post'];
export type Lang = 'de' | 'en';

export interface PartnerStatusRow {
  user_id: string;
  partner_number: string;
  tier: PartnerTier;
  contract_version: string;
  granted_at: string;
  ended_at: string | null;
  end_reason: 'revoked' | 'contract_ended' | null;
  directory_consent_at: string | null;
  show_expertise_at: string | null;
  channels: Partial<Record<PartnerChannel, string>>;
  website_domain: string | null;
  website_seen_at: string | null;
}

export const TIER_LABEL: Record<PartnerTier, string> = { partner: 'Matchunt Partner', gold: 'Matchunt Gold Partner' };

/** Neue Partnernummer. Zufall ohne Verzerrung: Bytes ab 240 werden verworfen (240 = 8 × 30). */
export function partnerNumber(random: (n: number) => Uint8Array = n => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = '';
  while (out.length < 8) {
    for (const b of random(16)) {
      if (b < 240 && out.length < 8) out += PARTNER_ALPHABET[b % PARTNER_ALPHABET.length];
    }
  }
  return `MP-${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Eingabe von Hand: Groß-/Kleinschreibung und Leerzeichen spielen keine Rolle. */
export const normalizeNumber = (input: unknown): string =>
  typeof input === 'string' ? input.trim().toUpperCase().replace(/\s+/g, '') : '';

/** „2.1“, „2.2“, „3“ … mindestens so neu wie min; alles andere (etwa von Hand getippt) zählt nicht. */
export function versionAtLeast(version: unknown, min = MIN_CONTRACT_VERSION): boolean {
  if (typeof version !== 'string' || !/^\d+(\.\d+)*$/.test(version.trim())) return false;
  const a = version.trim().split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

export const checkUrl = (number: string) => `${APP_ORIGIN}/partner/${number}`;
export const checkLabel = (number: string) => `matchunt.ai/partner/${number}`;

const berlin = (iso: string, opts: Intl.DateTimeFormatOptions, lang: Lang = 'de') =>
  new Date(iso).toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { timeZone: 'Europe/Berlin', ...opts });
/** „September 2026“ */
export const monthYear = (iso: string, lang: Lang = 'de') => berlin(iso, { month: 'long', year: 'numeric' }, lang);
/** „22.09.2026“ */
export const dayDate = (iso: string) => berlin(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Link „Zu LinkedIn hinzufügen“. LinkedIn füllt die Felder laut eigener Hilfe (a528030)
 * nicht mehr sicher vor; das Fenster zeigt deshalb jedes Feld auch zum Kopieren.
 * Ohne Unternehmensseite gibt es keinen Link (siehe LINKEDIN_ORGANIZATION_ID).
 */
export function linkedinAddUrl(p: { number: string; grantedAt: string; tier?: PartnerTier; organizationId?: string | null }): string | null {
  const organizationId = p.organizationId === undefined ? LINKEDIN_ORGANIZATION_ID : p.organizationId;
  if (!organizationId) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', month: 'numeric', year: 'numeric' }).formatToParts(new Date(p.grantedAt));
  const part = (type: string) => parts.find(x => x.type === type)?.value ?? '';
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: TIER_LABEL[p.tier ?? 'partner'],
    organizationId,
    issueYear: part('year'),
    issueMonth: String(Number(part('month'))),
    certUrl: checkUrl(p.number),
    certId: p.number,
  });
  return `https://www.linkedin.com/profile/add?${params.toString()}`;
}

/**
 * Abzeichen als Bild. Für alle Partner derselbe Dateiname: keine Nummer in der Bildadresse,
 * sonst würde das Bild in Mails wie ein Zählpixel wirken.
 */
export const badgeImage = (tier: PartnerTier, theme: 'light' | 'dark' = 'light') =>
  `${APP_ORIGIN}/badges/${tier === 'gold' ? 'gold' : `partner-${theme}`}@2x.png`;
export const BADGE_SIZE: Record<PartnerTier, { width: number; height: number }> = {
  partner: { width: 150, height: 44 }, gold: { width: 176, height: 44 },
};

const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Baustein für die E-Mail-Signatur: Abzeichen als Bild, daneben Nummer und Prüflink als
 * echter Text. Tabellen und Inline-Stile, damit Outlook, Gmail und Apple Mail ihn gleich zeigen;
 * blockiert ein Programm Bilder, bleibt der Text lesbar.
 */
export function signatureHtml(p: { number: string; tier?: PartnerTier; lang?: Lang }): string {
  const tier = p.tier ?? 'partner';
  const { width, height } = BADGE_SIZE[tier];
  const url = checkUrl(p.number);
  const en = p.lang === 'en';
  return '<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;margin-top:12px;">'
    + '<tr>'
    + `<td style="padding:0 12px 0 0;vertical-align:middle;"><a href="${url}" style="text-decoration:none;border:0;">`
    + `<img src="${badgeImage(tier)}" width="${width}" height="${height}" alt="${escapeHtml(TIER_LABEL[tier])}" style="display:block;border:0;width:${width}px;height:${height}px;"></a></td>`
    + '<td style="vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:#6b6b6b;">'
    + `${en ? 'No.' : 'Nr.'} ${escapeHtml(p.number)}<br>`
    + `<a href="${url}" style="color:#0a0a0a;text-decoration:underline;">${en ? 'Verify status' : 'Status prüfen'}</a>`
    + '</td></tr></table>';
}

/** Dieselbe Signatur als reiner Text, für Programme ohne HTML. */
export const signatureText = (p: { number: string; tier?: PartnerTier; lang?: Lang }) =>
  `${TIER_LABEL[p.tier ?? 'partner']} · ${p.lang === 'en' ? 'No.' : 'Nr.'} ${p.number} · ${checkLabel(p.number)}`;

/** Website-Abzeichen, das den Status beim Laden abfragt. */
export function embedCode(number: string, opts: { theme?: 'light' | 'dark'; size?: 's' | 'l' } = {}): string {
  const attrs = [`partner="${number}"`, opts.theme === 'dark' ? 'theme="dark"' : '', opts.size === 's' ? 'size="s"' : ''].filter(Boolean).join(' ');
  return `<script src="${APP_ORIGIN}/badge.js" async></script>\n<matchunt-badge ${attrs}></matchunt-badge>`;
}

/** Vorschlag für die Datenschutzerklärung des Headhunters; er gleicht ihn mit seiner eigenen ab. */
export const PRIVACY_SENTENCE = 'Auf dieser Website binden wir ein Abzeichen von Matchunt ein, das unseren Partnerstatus anzeigt. '
  + 'Beim Laden überträgt Ihr Browser technisch notwendige Daten wie Ihre IP-Adresse an Matchunt. Cookies werden dabei nicht gesetzt.';

/** Satz für die Kandidatenansprache. Ohne Anrede-Geschlecht, ohne Kunden von Matchunt. */
export function outreachText(p: { number: string; lang: Lang; formal: boolean; long: boolean }): string {
  const link = checkLabel(p.number);
  if (p.lang === 'en') {
    return p.long
      ? `A quick note about me: I work as an independent headhunter and I'm a Matchunt Partner. You can check my current status at any time: ${link}`
      : `I work as an independent headhunter and I'm a Matchunt Partner. Verify: ${link}`;
  }
  if (!p.long) return `Ich arbeite selbstständig im Headhunting und bin Matchunt Partner. Nachweis: ${link}`;
  return `Kurz zu mir: Ich arbeite selbstständig im Headhunting und bin Partner von Matchunt. Ob mein Status aktuell ist, ${p.formal ? 'können Sie' : 'kannst du'} jederzeit hier prüfen: ${link}`;
}

/** Vorlage für den LinkedIn-Beitrag; der Schwerpunkt kommt aus dem Profil. */
export function postText(p: { number: string; lang: Lang; focus?: string }): string {
  const link = checkUrl(p.number);
  const focus = (p.focus ?? '').trim();
  if (p.lang === 'en') return `News: I'm now a Matchunt Partner.${focus ? ` Focus: ${focus}.` : ''} My partner status can be verified here: ${link}`;
  return `Neu: Ich bin jetzt Matchunt Partner.${focus ? ` Schwerpunkt: ${focus}.` : ''} Mein Partnerstatus ist hier öffentlich prüfbar: ${link}`;
}

/** Absatz für Angebote an Kunden. */
export const offerText = (number: string, lang: Lang = 'de') => lang === 'en'
  ? `I'm a Matchunt Partner. You can verify my current status at ${checkLabel(number)}.`
  : `Ich bin Matchunt Partner. Den aktuellen Status finden Sie unter ${checkLabel(number)}.`;

/** LinkedIn übernimmt beim Teilen nur den Link; den Text fügt der Headhunter selbst ein. */
export const linkedinShareUrl = (number: string) =>
  `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(checkUrl(number))}`;

/** Nur echte Websites merken: nicht Matchunt selbst, keine Vorschau, kein localhost. */
export function siteDomain(origin: string | null | undefined): string | null {
  if (!origin) return null;
  let host: string;
  try { host = new URL(origin).hostname.toLowerCase(); } catch { return null; }
  if (!host.includes('.') || /^(localhost|127\.|\d+\.\d+\.\d+\.\d+$)/.test(host)) return null;
  if (host === 'matchunt.ai' || host.endsWith('.matchunt.ai') || host.endsWith('lovable.app') || host.endsWith('lovableproject.com') || host.endsWith('lovable.dev')) return null;
  return host.replace(/^www\./, '').slice(0, 120);
}

/** Selbst gemeldete Einrichtung je Stelle: nur bekannte Stellen, nur Zeitstempel. */
export function cleanChannels(input: unknown): Partial<Record<PartnerChannel, string>> {
  const src = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const out: Partial<Record<PartnerChannel, string>> = {};
  for (const key of PARTNER_CHANNELS) {
    const v = src[key];
    if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) out[key] = v;
  }
  return out;
}

export type PublicPartner =
  | { state: 'active'; number: string; name: string; company: string; tier: PartnerTier; since: string; checkedAt: string; expertise: string | null }
  | { state: 'paused'; number: string; checkedAt: string }
  | { state: 'ended'; number: string; endedAt: string }
  | { state: 'invalid' };

/**
 * Was die Prüfseite zeigt. Ohne Einwilligung nur Name, Firma, Nummer, Stufe, Status und
 * Datum; Schwerpunkte nur mit Einwilligung. Ein gesperrtes Konto heißt „derzeit nicht
 * aktiv“, ohne Namen. Nach dem Ende befristet „nicht mehr aktiv“, danach „ungültig“.
 */
export function publicView(
  row: Pick<PartnerStatusRow, 'partner_number' | 'tier' | 'granted_at' | 'ended_at' | 'show_expertise_at'> | null,
  person: { name: string; company: string; suspended: boolean; expertise: string | null } | null,
  now: number,
): PublicPartner {
  if (!row) return { state: 'invalid' };
  if (row.ended_at) {
    return now - Date.parse(row.ended_at) <= ENDED_VISIBLE_DAYS * DAY
      ? { state: 'ended', number: row.partner_number, endedAt: row.ended_at }
      : { state: 'invalid' };
  }
  const checkedAt = new Date(now).toISOString();
  if (!person || person.suspended) return { state: 'paused', number: row.partner_number, checkedAt };
  return {
    state: 'active', number: row.partner_number, name: person.name, company: person.company, tier: row.tier,
    since: row.granted_at, checkedAt, expertise: row.show_expertise_at ? person.expertise || null : null,
  };
}

/** „Finance & Controlling · Fach, Führung“ aus den Schwerpunkten. */
export function expertiseLine(x: { areas: string[]; extras: string[]; levels: string[] } | null): string {
  if (!x) return '';
  return [[...x.areas, ...x.extras].join(', '), x.levels.join(', ')].filter(Boolean).join(' · ');
}
