// ─── PII-Redaktion vor der KI (assess-candidate-fit) ────────────────────────
// Zweck: Direkte Identifikatoren der Kandidatin/des Kandidaten erreichen das
// externe Sprachmodell (Gemini via Lovable Gateway) NICHT mehr. Fachliche
// Substanz (Rolle, Skills, Erfahrung, Gehalt, Region) bleibt erhalten.
//
// Prinzip (Rotes Team): ALLOWLIST statt Blocklist — es wird ein NEUES Payload
// nur aus erlaubten, redigierten Feldern gebaut. Alles andere existiert im
// LLM-Input per Konstruktion nicht (keine Geo-Koordinaten, Handles, Adresse,
// nationality/residence aus select('*')).
//
// Scope MVP: zuverlässige Pseudonymisierung der DIREKTEN Identifikatoren
// (Name, Kontakt, Arbeitgeber, exakter Ort). Inferenz-Schutz gegen Drittnamen
// (NER) und k-Anonymität ist Phase 2 (dokumentiertes Restrisiko).

export const REDACTION_VERSION = "r1";

// ─── Diakritik / Schreibvarianten ───────────────────────────────────────────

function foldDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Erzeugt Schreibvarianten eines Tokens (Umlaut <-> ae/oe/ue, ß <-> ss),
// damit "Müller" auch "Mueller" im Freitext trifft (und umgekehrt).
function tokenVariants(token: string): string[] {
  const variants = new Set<string>();
  const add = (v: string) => {
    const t = v.trim();
    if (t.length >= 2) variants.add(t);
  };
  add(token);
  add(
    token
      .replace(/ä/g, "ae").replace(/Ä/g, "Ae")
      .replace(/ö/g, "oe").replace(/Ö/g, "Oe")
      .replace(/ü/g, "ue").replace(/Ü/g, "Ue")
      .replace(/ß/g, "ss"),
  );
  add(
    token
      .replace(/ae/gi, "ä").replace(/oe/gi, "ö").replace(/ue/gi, "ü").replace(/ss/g, "ß"),
  );
  return [...variants];
}

// Unicode-bewusste Wortgrenze (keine Buchstaben/Ziffern direkt daneben),
// damit "Berg" nicht "Heidelberg" trifft und "SAP" nicht in "SAPP" steht.
function wordRegex(variant: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${escapeRegex(variant)})(?![\\p{L}\\p{N}])`,
    "giu",
  );
}

// ─── Regex-Klassen (Muster-PII unabhängig von bekannten Werten) ─────────────

const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const RE_URL = /\b(?:https?:\/\/|www\.)[^\s)]+/gi;
const RE_HANDLE = /\b(?:linkedin\.com\/in\/|github\.com\/|xing\.com\/profile\/)[A-Za-z0-9._-]+/gi;
const RE_IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){10,30}\b/g;
const RE_DATE = /\b\d{1,2}\.\d{1,2}\.\d{4}\b/g;
// Telefon konservativ: international (+/00) ODER 0-Vorwahl, mind. eine Trennung,
// damit Gehälter ("80000") und Jahre ("2019") NICHT als Telefon gelten.
const RE_PHONE =
  /(?:\+|00)\d{1,3}[\s/.\-]?\(?\d{1,5}\)?(?:[\s/.\-]?\d{2,}){2,}|\(?0\d{2,4}\)?[\s/.\-]\d{3,}(?:[\s/.\-]?\d{2,})*/g;

export type RedactionReport = {
  mode: string;
  nameTokens: number;
  employersAliased: number;
  citiesGeneralized: number;
  emailsRemoved: number;
  phonesRemoved: number;
  urlsRemoved: number;
  datesRemoved: number;
  ibansRemoved: number;
  freeTextFields: number;
};

type RedactEntry = { variants: string[]; replacement: string };

// ─── Region-Generalisierung (Port von SQL anon_region_broad) ────────────────

export function generalizeRegion(city: string | null | undefined): string {
  const c = (city ?? "").trim().toLowerCase();
  if (!c) return "DACH";
  const test = (re: RegExp) => re.test(c);
  if (test(/münchen|munich|augsburg|nürnberg|regensburg|stuttgart|ulm|freiburg|karlsruhe/)) return "Süddeutschland";
  if (test(/berlin|hamburg|bremen|hannover|kiel|rostock|lübeck|schwerin/)) return "Norddeutschland";
  if (test(/köln|düsseldorf|dortmund|essen|frankfurt|bonn|aachen|wiesbaden|mainz/)) return "Westdeutschland";
  if (test(/dresden|leipzig|chemnitz|erfurt|magdeburg|potsdam/)) return "Ostdeutschland";
  if (test(/wien|vienna|graz|linz|salzburg|innsbruck|klagenfurt|österreich|austria/)) return "Österreich";
  if (test(/zürich|zurich|basel|bern|genf|geneva|lausanne|schweiz|switzerland/)) return "Schweiz";
  if (test(/amsterdam|netherlands|niederlande/)) return "EU - Benelux";
  if (test(/paris|france|frankreich/)) return "EU - Frankreich";
  if (test(/london|uk|england/)) return "UK";
  if (test(/spain|spanien|madrid|barcelona/)) return "EU - Südeuropa";
  if (test(/poland|polen|warsaw|krakow/)) return "EU - Osteuropa";
  if (test(/germany|deutschland/)) return "Deutschland";
  return "DACH";
}

// ─── Freitext-Redaktion ─────────────────────────────────────────────────────

export function redactFreeText(
  text: string | null | undefined,
  entries: RedactEntry[],
  report: RedactionReport,
): string | null {
  if (text == null || text === "") return text ?? null;
  let out = String(text);

  // Pass 1 — Muster-Regex (Reihenfolge: URL/Handle/E-Mail/IBAN/Datum vor Telefon)
  out = out.replace(RE_HANDLE, () => { report.urlsRemoved++; return "[Profil]"; });
  out = out.replace(RE_URL, () => { report.urlsRemoved++; return "[Link]"; });
  out = out.replace(RE_EMAIL, () => { report.emailsRemoved++; return "[E-Mail]"; });
  out = out.replace(RE_IBAN, () => { report.ibansRemoved++; return "[Konto]"; });
  out = out.replace(RE_DATE, () => { report.datesRemoved++; return "[Datum]"; });
  out = out.replace(RE_PHONE, () => { report.phonesRemoved++; return "[Telefon]"; });

  // Pass 2 — Token-Substitution (längste Variante zuerst → "Anna Müller" vor "Anna")
  const flat = entries
    .flatMap((e) => e.variants.map((v) => ({ v, replacement: e.replacement })))
    .sort((a, b) => b.v.length - a.v.length);
  for (const { v, replacement } of flat) {
    out = out.replace(wordRegex(v), () => replacement);
  }
  return out;
}

// ─── Allowlist-Payload-Builder ──────────────────────────────────────────────

type AnyRec = Record<string, any>;

function partTokens(fullName: string | null | undefined): string[] {
  if (!fullName) return [];
  return String(fullName)
    .split(/[\s.\-]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 2);
}

function handleFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = String(url).match(/(?:\/in\/|\/profile\/|github\.com\/|\/)([A-Za-z0-9._-]{3,})\/?$/);
  return m ? m[1] : null;
}

export type LLMView = {
  nameLabel: string;
  job_title: string | null;
  employer_alias: string | null;
  seniority: string | null;
  experience_years: number | null;
  region: string;
  location_relation: string;
  salary_min: number | null;
  salary_max: number | null;
  remote_preference: string | null;
  skills: string[];
  certifications: string[];
  skillsDetailed: { name: string; level: string | null; years: number | null; category: string | null }[];
  languages: { language: string; proficiency: string | null }[];
  cvSummary: string | null;
  experiences: {
    job_title: string | null;
    employer_alias: string | null;
    region: string;
    start_date: string | null;
    end_date: string | null;
    description: string | null;
  }[];
  interview: {
    change_motivation: string | null;
    salary_current: string | null;
    salary_desired: string | null;
    career_ultimate_goal: string | null;
    would_recommend: boolean | null;
  } | null;
  priorAssessment: { overall_score: number | null; risk_level: string | null; recommendation: string | null } | null;
};

export type LeakContext = { nameTokens: string[]; companyTokens: string[]; cityTokens: string[] };

const ALIAS_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function redactCandidateForLLM(
  candidate: AnyRec,
  experiences: AnyRec[],
  skills: AnyRec[],
  languages: AnyRec[],
  interviewNotes: AnyRec | null,
  jobLocation: string | null,
  mode: string,
): { view: LLMView; report: RedactionReport; leakContext: LeakContext } {
  const report: RedactionReport = {
    mode, nameTokens: 0, employersAliased: 0, citiesGeneralized: 0,
    emailsRemoved: 0, phonesRemoved: 0, urlsRemoved: 0, datesRemoved: 0, ibansRemoved: 0, freeTextFields: 0,
  };

  // Skill-/Zertifikats-Allowlist (schützt z.B. "SAP", "Oracle" vor Ersetzung).
  const allowlist = new Set<string>();
  for (const s of candidate.skills ?? []) allowlist.add(String(s).toLowerCase());
  for (const c of candidate.certifications ?? []) allowlist.add(String(c).toLowerCase());
  for (const s of skills ?? []) if (s.skill_name) allowlist.add(String(s.skill_name).toLowerCase());

  // Stabile Arbeitgeber-Aliase (chronologisch: aktueller = A).
  const aliasMap = new Map<string, string>();
  const orderedEmployers = [candidate.company, ...experiences.map((e) => e.company_name)];
  for (const raw of orderedEmployers) {
    const name = (raw ?? "").trim();
    if (!name) continue;
    const key = foldDiacritics(name).toLowerCase();
    if (allowlist.has(name.toLowerCase())) continue; // Skill-Kollision → nicht aliasen
    if (!aliasMap.has(key)) {
      aliasMap.set(key, `[Arbeitgeber ${ALIAS_LETTERS[aliasMap.size] ?? "X"}]`);
    }
  }
  const aliasFor = (raw: string | null | undefined): string | null => {
    const name = (raw ?? "").trim();
    if (!name) return null;
    if (allowlist.has(name.toLowerCase())) return name; // geschützter Skill-Name bleibt
    return aliasMap.get(foldDiacritics(name).toLowerCase()) ?? "[ein Unternehmen]";
  };

  // Redaktions-Einträge für Freitext (Namen → [KANDIDAT], Firmen → Alias, Orte → Region).
  const entries: RedactEntry[] = [];
  const nameTokens = partTokens(candidate.full_name);
  const emailLocal = candidate.email ? String(candidate.email).split("@")[0] : null;
  if (emailLocal && emailLocal.length >= 3) nameTokens.push(emailLocal);
  for (const urlField of [candidate.linkedin_url, candidate.github_url, candidate.website_url, candidate.portfolio_url]) {
    const h = handleFromUrl(urlField);
    if (h) nameTokens.push(h);
  }
  if (candidate.full_name) entries.push({ variants: tokenVariants(String(candidate.full_name)), replacement: "[KANDIDAT]" });
  for (const t of nameTokens) {
    if (allowlist.has(t.toLowerCase())) continue;
    entries.push({ variants: tokenVariants(t), replacement: "[KANDIDAT]" });
  }
  for (const [key, alias] of aliasMap) {
    // Originalnamen aus den geladenen Feldern für die Token-Varianten nutzen.
    const original = orderedEmployers.find((e) => e && foldDiacritics(String(e)).toLowerCase() === key);
    if (original) entries.push({ variants: tokenVariants(String(original).trim()), replacement: alias });
  }
  const cityTokens: string[] = [];
  const addCity = (city: string | null | undefined) => {
    const c = (city ?? "").trim();
    if (c) {
      cityTokens.push(c);
      entries.push({ variants: tokenVariants(c), replacement: "[Region]" });
    }
  };
  addCity(candidate.city);
  for (const e of experiences) addCity(e.location);

  const rf = (text: string | null | undefined): string | null => {
    if (text == null || text === "") return text ?? null;
    report.freeTextFields++;
    return redactFreeText(text, entries, report);
  };

  // Zähler
  report.nameTokens = nameTokens.length + (candidate.full_name ? 1 : 0);
  report.employersAliased = aliasMap.size;
  report.citiesGeneralized = new Set(cityTokens.map((c) => c.toLowerCase())).size;

  const candRegion = generalizeRegion(candidate.city);
  const jobRegion = generalizeRegion(jobLocation);
  const sameRegion = candidate.city && jobLocation ? candRegion === jobRegion : false;
  const locationRelation =
    (sameRegion ? "gleiche Region wie die Stelle" : "andere Region als die Stelle") +
    (candidate.remote_preference ? `, Remote-Präferenz vorhanden` : "");

  const view: LLMView = {
    nameLabel: "[KANDIDAT]",
    job_title: candidate.job_title ?? null,
    employer_alias: aliasFor(candidate.company),
    seniority: candidate.seniority ?? null,
    experience_years: candidate.experience_years ?? null,
    region: candRegion,
    location_relation: locationRelation,
    salary_min: candidate.salary_expectation_min ?? null,
    salary_max: candidate.salary_expectation_max ?? null,
    remote_preference: candidate.remote_preference ?? null,
    skills: candidate.skills ?? [],
    certifications: candidate.certifications ?? [],
    skillsDetailed: (skills ?? []).map((s) => ({
      name: s.skill_name, level: s.level ?? null, years: s.years_experience ?? null, category: s.category ?? null,
    })),
    languages: (languages ?? []).map((l) => ({ language: l.language, proficiency: l.proficiency ?? null })),
    cvSummary: rf(candidate.cv_ai_summary ?? candidate.summary),
    experiences: (experiences ?? []).map((e) => ({
      job_title: e.job_title ?? null,
      employer_alias: aliasFor(e.company_name),
      region: generalizeRegion(e.location),
      start_date: e.start_date ?? null,
      end_date: e.end_date ?? null,
      description: rf(e.description),
    })),
    interview: interviewNotes
      ? {
          change_motivation: rf(interviewNotes.change_motivation),
          salary_current: rf(interviewNotes.salary_current),
          salary_desired: rf(interviewNotes.salary_desired),
          career_ultimate_goal: rf(interviewNotes.career_ultimate_goal),
          would_recommend: interviewNotes.would_recommend ?? null,
        }
      : null,
    priorAssessment: candidate ? null : null, // gesetzt vom Aufrufer (s. index.ts)
  };

  const leakContext: LeakContext = {
    nameTokens: nameTokens.filter((t) => !allowlist.has(t.toLowerCase())),
    companyTokens: orderedEmployers
      .filter((e): e is string => !!e && !allowlist.has(String(e).toLowerCase())),
    cityTokens,
  };

  return { view, report, leakContext };
}

// ─── Outgoing-Leak-Assertion (fail-closed) ──────────────────────────────────
// Prüft den FINALEN Prompt. Spezifische Klassen (E-Mail/Link/Konto) müssen 0
// sein; bekannte Klartext-Tokens (Name/Firma/Ort) dürfen nicht mehr vorkommen.
// Telefon/Datum werden redigiert, aber NICHT hart asserted (False-Positive-Schutz).

export function assertNoLeak(prompt: string, ctx: LeakContext): string[] {
  const leaks: string[] = [];
  if (RE_EMAIL.test(prompt)) leaks.push("email");
  RE_EMAIL.lastIndex = 0;
  if (RE_URL.test(prompt)) leaks.push("url");
  RE_URL.lastIndex = 0;
  if (RE_HANDLE.test(prompt)) leaks.push("handle");
  RE_HANDLE.lastIndex = 0;
  if (RE_IBAN.test(prompt)) leaks.push("iban");
  RE_IBAN.lastIndex = 0;
  const present = (token: string): boolean =>
    tokenVariants(token).some((v) => {
      const re = wordRegex(v);
      return re.test(prompt);
    });
  if (ctx.nameTokens.some(present)) leaks.push("name");
  if (ctx.companyTokens.some(present)) leaks.push("company");
  if (ctx.cityTokens.some(present)) leaks.push("city");
  return [...new Set(leaks)];
}
