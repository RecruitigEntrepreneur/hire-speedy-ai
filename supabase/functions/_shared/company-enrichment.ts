import { normalizeDomain } from './domain.ts';
import { looksLikeImpressum, rankImpressumLinks, urlKey, validateImpressum, type ImpressumFields } from './impressum.ts';

/**
 * Firma aus Website und Impressum. Genutzt von der Kunden-Jobaufnahme
 * (intake-ai), dem Headhunter-Onboarding (recruiter-enrich) und dem Outreach
 * (useCompanyEnrichment), alle über die Function enrich-company-from-domain.
 *
 * Bis zum 16.09.2026 ging die JSON-Extraktion in der Schreibweise der
 * Firecrawl-API v2 an den Endpunkt v1. Firecrawl lehnte mit 400 ab, übrig blieb
 * der aus der Domain geratene Name („Bluewater-bridge“), und die Karte zeigte ihn
 * als gefundene Angabe. Seitdem:
 *   1. Alle Aufrufe gehen an v2. Startseite und Seitenkarte laufen parallel.
 *   2. Das Impressum wird gezielt gesucht: Links, die nach Impressum heißen,
 *      notfalls /impressum direkt. Höchstens zwei Seiten.
 *   3. Jeder Wert muss wörtlich auf der Seite stehen und zum Format passen
 *      (impressum.ts). Verworfenes steht in `impressum.dropped`.
 *   4. Das Impressum gewinnt: Sitz und Ort kommen von dort, nicht aus dem
 *      Werbetext der Startseite.
 * Alles in einem Zeitbudget, weil intake-ai und recruiter-enrich nach
 * 55 Sekunden abbrechen und der Kaltstart der Function davon abgeht.
 */

export interface EnrichmentResult extends ImpressumFields {
  name: string;
  description?: string;
  industry?: string;
  headcount?: number;
  founding_year?: number;
  technologies?: string[];
}
export interface EnrichmentWarning { step: string; status?: number; detail?: string }
export interface ImpressumReport {
  /** Firmierung oder Straße mit Postleitzahl stehen geprüft im Impressum. */
  found: boolean;
  url: string | null;
  tried: string[];
  /** Vorschläge der Extraktion, die nicht auf der Seite standen oder nicht zum Format passten. */
  dropped: string[];
}
export interface EnrichmentOutcome { domain: string; data: EnrichmentResult; warnings: EnrichmentWarning[]; impressum: ImpressumReport }
export interface EnrichmentDeps {
  fetch: typeof fetch;
  firecrawlKey: string;
  lovableKey?: string;
  now?: () => number;
}

interface FirecrawlPayload {
  success?: boolean;
  links?: unknown;
  data?: { markdown?: unknown; json?: unknown; links?: unknown; metadata?: { statusCode?: unknown } };
}

const FIRECRAWL = 'https://api.firecrawl.dev/v2';
export const BUDGET_MS = 40_000;
const IMPRESSUM_TRIES = 2;
/** Unter dieser Restzeit beginnt keine Impressum-Seite mehr; die Extraktion braucht selbst einige Sekunden. */
const MIN_IMPRESSUM_MS = 10_000;

const HOME_FORMAT = {
  type: 'json',
  schema: {
    type: 'object',
    properties: {
      company_name: { type: 'string', description: 'The company name as used on the website' },
      tagline: { type: 'string', description: 'Company tagline or slogan' },
      description: { type: 'string', description: 'Brief company description' },
      industry: { type: 'string', description: 'Industry or sector' },
      headquarters: { type: 'string', description: 'Headquarters location/city' },
      employee_count: { type: 'string', description: 'Number of employees if mentioned' },
      founding_year: { type: 'string', description: 'Year the company was founded' },
    },
  },
  prompt: 'Extract company information from this website. Focus on finding the company name, what they do, their industry, location, and size.',
};

// Bewusst ohne Beispielwerte: ein Beispiel wird im Zweifel abgeschrieben.
const IMPRESSUM_FORMAT = {
  type: 'json',
  schema: {
    type: 'object',
    properties: {
      legal_name: { type: 'string', description: 'Full legal company name including the legal form, exactly as printed' },
      street: { type: 'string', description: 'Street and house number of the company address, without postal code and city' },
      postal_code: { type: 'string', description: 'Postal code of the company address' },
      city: { type: 'string', description: 'City of the company address, without postal code' },
      country: { type: 'string', description: 'Country of the company address, only if printed on the page' },
      registration_number: { type: 'string', description: 'Commercial register type and number exactly as printed, without the court' },
      register_court: { type: 'string', description: 'Register court exactly as printed' },
      vat_id: { type: 'string', description: 'VAT identification number (USt-IdNr., UID) exactly as printed' },
      ceo_name: { type: 'string', description: 'Names of the managing directors, owners or board members exactly as printed, without their role' },
    },
  },
  prompt: 'This page is the legal notice (Impressum) of a company. Copy every value exactly as it is printed on this page. '
    + 'Leave a field empty when the page does not state it. Never guess, complete, translate or reformat a value, '
    + 'because the values end up in a contract.',
};

export const hasImpressumData = (f: ImpressumFields): boolean => !!(f.legal_name || (f.street && f.postal_code));

const str = (v: unknown): string => typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';

function employeeCount(value: string): number | null {
  const numbers = value.match(/\d+/g);
  if (!numbers) return null;
  if (numbers.length >= 2) return Math.round((parseInt(numbers[0]) + parseInt(numbers[1])) / 2);
  return value.toLowerCase().includes('k') ? parseInt(numbers[0]) * 1000 : parseInt(numbers[0]);
}

export async function enrichDomain(input: string, deps: EnrichmentDeps): Promise<EnrichmentOutcome | null> {
  const domain = normalizeDomain(input);
  if (!domain) return null;
  const now = deps.now ?? (() => Date.now());
  const started = now();
  const left = () => BUDGET_MS - (now() - started);
  const site = `https://${domain}`;
  const warnings: EnrichmentWarning[] = [];

  const firecrawl = async (step: string, path: 'scrape' | 'map', body: Record<string, unknown>, limitMs: number): Promise<FirecrawlPayload | null> => {
    const wait = Math.min(limitMs, left());
    if (wait < 3_000) { warnings.push({ step, detail: 'Zeitbudget erschöpft' }); return null; }
    try {
      const res = await deps.fetch(`${FIRECRAWL}/${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${deps.firecrawlKey}`, 'Content-Type': 'application/json' },
        // Firecrawl bricht selbst ab, bevor wir es tun; sonst läuft die Seite ungenutzt weiter.
        body: JSON.stringify(path === 'scrape' ? { ...body, timeout: Math.max(3_000, wait - 1_000) } : body),
        signal: AbortSignal.timeout(wait),
      });
      const text = await res.text();
      let payload: FirecrawlPayload | null = null;
      try { payload = JSON.parse(text); } catch { /* keine JSON-Antwort */ }
      if (res.ok && payload?.success) return payload;
      warnings.push({ step, status: res.status, detail: text.slice(0, 200) });
      return null;
    } catch (e) {
      warnings.push({ step, detail: e instanceof Error ? e.name : 'Fehler' });
      return null;
    }
  };

  // 1. Die Startseite liefert Beschreibung und Branche und läuft im Hintergrund.
  //    Die Seitenkarte entscheidet sofort, wo das Impressum liegt.
  const homeTask = firecrawl('startseite', 'scrape', { url: site, formats: ['markdown', 'links', HOME_FORMAT], onlyMainContent: true }, 30_000);
  const map = await firecrawl('seitenkarte', 'map', { url: site }, 15_000);
  let home: FirecrawlPayload | null | undefined;
  let candidates = rankImpressumLinks(map?.links, domain, IMPRESSUM_TRIES);
  if (!candidates.length) {
    // Ohne Treffer in der Seitenkarte helfen die Links der Startseite, etwa im Seitenfuß.
    home = await homeTask;
    candidates = rankImpressumLinks(home?.data?.links, domain, IMPRESSUM_TRIES);
  }
  const guess = `${site}/impressum`;
  if (!candidates.some(url => urlKey(url) === urlKey(guess))) candidates.push(guess);

  // 2. Impressum lesen und prüfen.
  const impressum: ImpressumReport = { found: false, url: null, tried: [], dropped: [] };
  let fields: ImpressumFields = {};
  for (const url of candidates.slice(0, IMPRESSUM_TRIES)) {
    if (left() < MIN_IMPRESSUM_MS) { warnings.push({ step: 'impressum', detail: 'Zeitbudget erschöpft' }); break; }
    impressum.tried.push(url);
    const page = await firecrawl('impressum', 'scrape', { url, formats: ['markdown', IMPRESSUM_FORMAT], onlyMainContent: false }, 30_000);
    const markdown = str(page?.data?.markdown);
    const status = Number(page?.data?.metadata?.statusCode ?? 200);
    if (!markdown || status >= 400 || !looksLikeImpressum(markdown)) continue;
    const checked = validateImpressum(page?.data?.json, markdown);
    if (impressum.url && !hasImpressumData(checked.fields)) continue;
    fields = checked.fields;
    impressum.url = url;
    impressum.dropped = checked.dropped;
    if (hasImpressumData(fields)) { impressum.found = true; break; }
  }
  if (home === undefined) home = await homeTask;

  // 3. Zusammenführen. Das Impressum gewinnt vor der Startseite.
  const h = (home?.data?.json && typeof home.data.json === 'object' ? home.data.json : {}) as Record<string, unknown>;
  const data: EnrichmentResult = {
    name: str(h.company_name) || fields.legal_name || domain.charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
  };
  if (str(h.description)) data.description = str(h.description);
  if (str(h.industry)) data.industry = str(h.industry);
  const headcount = employeeCount(str(h.employee_count));
  if (headcount) data.headcount = headcount;
  const year = parseInt(str(h.founding_year));
  if (year > 1800 && year <= new Date().getFullYear()) data.founding_year = year;
  Object.assign(data, fields);
  if (!data.city && str(h.headquarters)) data.city = str(h.headquarters);

  // 4. Branche und Beschreibung notfalls per KI aus der Startseite, wenn noch Zeit ist.
  const homeMarkdown = str(home?.data?.markdown);
  if (deps.lovableKey && (!data.industry || !data.description) && homeMarkdown && left() > 6_000) {
    try {
      const ai = await deps.fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${deps.lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a company research assistant. Analyze website content and extract company information. Be concise and accurate. Respond only with valid JSON.' },
            { role: 'user', content: `Analyze this website content and extract company information. Return JSON with these fields:\n{\n  "industry": "primary industry/sector",\n  "description": "1-2 sentence company description",\n  "technologies": ["tech1", "tech2"] // if it's a tech company\n}\n\nWebsite content (first 3000 chars):\n${homeMarkdown.slice(0, 3000)}` },
          ],
          temperature: 0.3,
        }),
        signal: AbortSignal.timeout(Math.min(10_000, left())),
      });
      if (ai.ok) {
        const content = str((await ai.json())?.choices?.[0]?.message?.content);
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (!data.industry && str(parsed.industry)) data.industry = str(parsed.industry);
          if (!data.description && str(parsed.description)) data.description = str(parsed.description);
          if (Array.isArray(parsed.technologies)) data.technologies = parsed.technologies.filter((t: unknown) => typeof t === 'string').slice(0, 10);
        }
      } else {
        warnings.push({ step: 'ki', status: ai.status });
      }
    } catch (e) {
      warnings.push({ step: 'ki', detail: e instanceof Error ? e.name : 'Fehler' });
    }
  }

  return { domain, data, warnings, impressum };
}
