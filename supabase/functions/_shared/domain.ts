/**
 * Domain-Normalisierung und Freemail-Erkennung.
 *
 * Konsolidiert vier divergierende Implementierungen:
 *   enrich-company-from-domain/index.ts:48-50
 *   crawl-company-data/index.ts:596
 *   src/hooks/useCompanyEnrichment.ts:32-35
 *   src/hooks/useCompanyImport.ts:26-44   (nutzt replace('www.','') statt ^www\. —
 *                                          "foo.wwwbar.de" wird falsch beschnitten)
 * plus useOutreachCompanies.ts:99-102, das gar nicht normalisiert. Zwei Pfade
 * konnten fuer dieselbe Eingabe unterschiedliche Domains erzeugen und damit die
 * UNIQUE-Pruefung auf outreach_companies.domain umgehen.
 *
 * Spiegelbild in src/lib/domain.ts — beide Dateien muessen identisch bleiben.
 */

/** Freemail und Wegwerfadressen. Basis war die sechs Eintraege lange Inline-Liste
 *  in crawl-career-page/index.ts:132; hier ergaenzt um die im DACH-Raum
 *  relevanten Anbieter und die gaengigen Wegwerfdienste. */
export const FREEMAIL_DOMAINS = new Set<string>([
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.de', 'hotmail.com', 'hotmail.de',
  'live.com', 'live.de', 'msn.com', 'yahoo.com', 'yahoo.de', 'ymail.com',
  'web.de', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 'gmx.com',
  't-online.de', 'freenet.de', 'arcor.de', 'aol.com', 'aol.de',
  'icloud.com', 'me.com', 'mac.com',
  'mail.de', 'mail.com', 'posteo.de', 'mailbox.org', 'protonmail.com', 'proton.me',
  'bluewin.ch', 'sunrise.ch', 'hispeed.ch', 'chello.at', 'aon.at', 'a1.net',
  'zoho.com', 'yandex.com', 'yandex.ru',
  // Wegwerfdienste
  'mailinator.com', 'guerrillamail.com', 'yopmail.com', 'trashmail.com', 'trashmail.de',
  '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'sharklasers.com',
  'getnada.com', 'dispostable.com', 'maildrop.cc', 'throwawaymail.com',
  'wegwerfemail.de', 'einrot.com', 'fakeinbox.com', 'mohmal.com',
]);

/**
 * Normalisiert eine Domain oder URL auf den reinen Hostnamen in Kleinschreibung.
 * Gibt null zurueck, wenn nichts Brauchbares uebrig bleibt.
 */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let value = String(input).trim().toLowerCase();
  if (!value) return null;

  value = value.replace(/^[a-z][a-z0-9+.-]*:\/\//, ''); // Protokoll
  value = value.split(/[/?#]/)[0];                       // Pfad, Query, Fragment
  value = value.split('@').pop() ?? value;                // versehentlich E-Mail
  value = value.replace(/:\d+$/, '');                     // Port
  value = value.replace(/^www\./, '');                    // genau ein fuehrendes www.
  value = value.replace(/\.+$/, '');                      // trailing dot (FQDN)

  if (!value || !value.includes('.')) return null;
  // Zeichenvorrat inkl. IDN-Punycode (xn--), aber ohne Leerzeichen und Umlaute.
  if (!/^[a-z0-9.-]+$/.test(value)) return null;
  if (value.startsWith('.') || value.startsWith('-') || value.endsWith('-')) return null;
  return value;
}

/** Domain aus einer E-Mail-Adresse. */
export function domainFromEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes('@')) return null;
  return normalizeDomain(email.split('@').pop());
}

/** Nimmt beides: E-Mail oder URL. */
export function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  return input.includes('@') ? domainFromEmail(input) : normalizeDomain(input);
}

export function isFreemailDomain(domain: string | null | undefined): boolean {
  const d = normalizeDomain(domain);
  return d ? FREEMAIL_DOMAINS.has(d) : false;
}

export function isFreemailAddress(email: string | null | undefined): boolean {
  return isFreemailDomain(domainFromEmail(email));
}

/**
 * Bewusst pragmatische E-Mail-Pruefung. Eine RFC-5322-vollstaendige Regex
 * lehnt mehr gueltige Adressen ab, als sie ungueltige faengt; die echte
 * Pruefung ist ohnehin der Code, der an die Adresse geht.
 */
export function isPlausibleEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const value = email.trim();
  if (value.length < 6 || value.length > 254) return false;
  return /^[^\s@,;:<>()[\]\\]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
}

/** "ma***@acme.de" — fuer Rueckmeldungen, ohne die Adresse zu wiederholen. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, Math.min(2, local.length));
  return `${head}${'*'.repeat(Math.max(3, local.length - head.length))}@${domain}`;
}
