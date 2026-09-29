// Schnellerkennung ohne KI: liest harte Fakten aus Notizen, Transkripten und
// Headhunter-Kürzeln ("IST 52 / WG 60 / SG 56", "KüF 3M z. QE", "rem. 3/5").
// Läuft sofort im Browser (auch beim Tippen) und ist die Rückfallebene, wenn
// die KI-Auswertung nicht erreichbar ist. Jeder Treffer trägt das Zitat, aus
// dem er stammt. Geschützte Angaben (Art. 9 DSGVO, AGG) werden erkannt, aber
// nie übernommen.

import {
  DossierForm,
  DossierLanguage,
  NOTICE_OPTIONS,
  OTHER_APPLICATIONS_OPTIONS,
  PERMIT_OPTIONS,
  WORK_MODEL_OPTIONS,
  formatEuro,
  mapNoticeText,
  optionLabel,
  parseSalary,
} from './candidateDossier';

export type SuggestionOrigin = 'quick' | 'ai';

export interface CaptureSuggestion {
  key: keyof DossierForm;
  value: DossierForm[keyof DossierForm];
  display: string;
  quote: string;
  sourceLabel?: string;
  /** 1 = unsicher, 3 = sicher */
  confidence: 1 | 2 | 3;
  origin: SuggestionOrigin;
}

export interface QuickExtractResult {
  suggestions: CaptureSuggestion[];
  /** Kategorien geschützter Angaben, die bewusst NICHT übernommen wurden. */
  protectedMentions: string[];
}

const PROTECTED: Array<[RegExp, string]> = [
  [/\b(schwanger\w*|krank\w*|burn-?out|depression\w*|therapie\w*|diagnose\w*|reha\b|operation\w*|behinder\w*|chronisch\w*)/i, 'Gesundheit'],
  [/\b(religi\w*|kirche\w*|moschee\w*|muslim\w*|christ(in|lich)?|jüdisch\w*|glaube)\b/i, 'Religion'],
  [/\b(gewerkschaft\w*|betriebsrat\w*)/i, 'Gewerkschaft'],
  [/\b(sexuell\w*|homosexuell\w*|lesbisch|schwul|queer|transgender)\b/i, 'Sexuelle Orientierung'],
  [/\b(herkunft|migrationshintergrund|ethni\w*|hautfarbe|nationalität)\b/i, 'Herkunft'],
  [/\b(kinder\w*|kita|elternzeit|mutterschutz|verheiratet|scheidung|geschieden|kinderwunsch|familienplanung)\b/i, 'Familie'],
  [/\b(\d{2})\s*jahre\s*alt\b|\balter\s*:?\s*\d{2}\b|\bjahrgang\s*\d{2,4}\b/i, 'Alter'],
];

const MOTIVATION_KEYWORDS: Array<[RegExp, string]> = [
  [/schicht|arbeitszeit|dienstplan|wochenend|überstunde|nachtdienst|bereitschaft/i, 'Arbeitszeiten'],
  [/verantwortung/i, 'Verantwortung'],
  [/\bchef|führung(skraft|sstil)?|vorgesetzt|management|geschäftsführ/i, 'Führung'],
  [/\bteam|kolleg/i, 'Team'],
  [/entwicklung|perspektive|karriere|aufstieg|weiterbildung|stillstand/i, 'Karriere'],
  [/home.?office|remote|mobil(es)? arbeit/i, 'Remote'],
  [/pendel|fahrtweg|anfahrt|arbeitsweg|standort/i, 'Standort'],
  [/kultur|betriebsklima|stimmung|wertschätzung/i, 'Unternehmenskultur'],
  [/unsicher|insolvenz|stellenabbau|befristet|kurzarbeit/i, 'Sicherheit'],
  [/work.?life|ausgleich|privatleben|balance/i, 'Work-Life-Balance'],
  [/gehalt|verdien|unterbezahlt|mehr geld/i, 'Gehalt'],
  [/projekt/i, 'Projekte'],
];

const LANGUAGES: Record<string, string> = {
  deutsch: 'Deutsch', englisch: 'Englisch', französisch: 'Französisch', franzoesisch: 'Französisch', spanisch: 'Spanisch',
  italienisch: 'Italienisch', türkisch: 'Türkisch', polnisch: 'Polnisch', russisch: 'Russisch', arabisch: 'Arabisch',
  niederländisch: 'Niederländisch', portugiesisch: 'Portugiesisch', ukrainisch: 'Ukrainisch', rumänisch: 'Rumänisch',
};

const LEVEL_MAP: Array<[RegExp, string]> = [
  [/mutter\s*sprach\w*|native/i, 'Muttersprache'],
  [/\bc2\b/i, 'C2'], [/\bc1\b|verhandlungssicher|fließend|fliessend/i, 'C1'],
  [/\bb2\b|sehr gut/i, 'B2'], [/\bb1\b|\bgut\b/i, 'B1'],
  [/\ba2\b|grundkenntnis\w*/i, 'A2'], [/\ba1\b/i, 'A1'],
];

/** Trennt an Zeilen und Satzenden, aber nicht an Abkürzungen ("z. QE", "ca. 45"). */
function sentences(text: string): string[] {
  return text
    .split(/\r?\n|(?<=[.!?])(?<!\b[A-Za-zÄÖÜäöü]\.)\s+(?=[A-ZÄÖÜ][a-zäöüß])|(?<=[!?;])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** Datum, Uhrzeit und Zeitstempel stören beim Lesen von Beträgen. */
function withoutDates(s: string): string {
  return s
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
    .replace(/\b\d{1,2}\.\d{1,2}\.(\d{2,4})?/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ');
}

const clip = (s: string) => (s.length > 160 ? `${s.slice(0, 157)}…` : s);

/** Zahlen unter 300 im Gehaltskontext sind Tausender ("will 45"). */
function salaryFrom(fragment: string): { low: number; high: number } | null {
  const r = parseSalary(withoutDates(fragment));
  if (!r) return null;
  const scale = (n: number) => (n > 0 && n < 300 ? n * 1000 : n);
  const low = scale(r.low);
  const high = scale(r.high);
  if (high < 15000 || high > 500000) return null;
  return { low, high };
}

function push(list: CaptureSuggestion[], s: Omit<CaptureSuggestion, 'origin'>) {
  // pro Feld nur den sichersten Treffer behalten (bei Gleichstand den ersten)
  const i = list.findIndex((x) => x.key === s.key);
  if (i === -1) list.push({ ...s, origin: 'quick' });
  else if (s.confidence > list[i].confidence) list[i] = { ...s, origin: 'quick' };
}

const LABEL_WORDS = /^(ist|wg|sg|wunsch\w*|gehalt\w*|verdienst|kündigung\w*|küf|frist|verfügbar\w*|start|motivation|wechsel\w*|sprachen?|englisch|deutsch|remote|homeoffice|home|pendel\w*|arbeitsort|standort|umzug|führung|notiz\w*|info|fazit|einschätzung|empfehlung|sperrliste|bewerbungen|telefonat|rückruf|gespräch|interview|ziel\w*|karriere)$/i;

export function quickExtract(text: string, sourceLabel?: string): QuickExtractResult {
  const out: CaptureSuggestion[] = [];
  const protectedMentions = new Set<string>();
  const tags = new Set<string>();
  let tagQuote = '';
  const langs: DossierLanguage[] = [];
  let langQuote = '';

  let topic: 'salary' | 'notice' | null = null;
  for (const raw of sentences(text)) {
    // Sprecher und Zeitstempel aus Transkriptzeilen entfernen ("00:12:40 Lena T.: …")
    // Themenwörter vor dem Doppelpunkt ("Gehalt: 45k", "WG: 45") sind kein Sprecher.
    const s = raw
      .replace(/^\s*\[?\d{1,2}:\d{2}(:\d{2})?\]?\s*/, '')
      .replace(/^([A-ZÄÖÜ][\wäöüß.-]*(?:\s+[A-ZÄÖÜ][\wäöüß.-]*){0,2}):\s+/, (m, label: string) => (LABEL_WORDS.test(label.split(/[\s-]/)[0]) ? m : ''));
    const low = s.toLowerCase();
    const askedTopic: 'salary' | 'notice' | null = /\?\s*$/.test(s)
      ? (/(gehalt|verdien|vorstellung|wunsch)/i.test(low) ? 'salary' : /(kündig|frist|verfügbar|anfangen|starten)/i.test(low) ? 'notice' : null)
      : null;
    let isProtected = false;
    for (const [re, cat] of PROTECTED) {
      if (re.test(s)) {
        protectedMentions.add(cat);
        isProtected = true;
      }
    }
    if (isProtected) continue; // Satz mit geschützter Angabe wird gar nicht ausgewertet

    const q = clip(s);

    // Kürzel: IST 52 / WG 60 / SG 56, auch mit Füllwort ("WG jetzt 46k").
    // "ist" nur groß oder mit Doppelpunkt, sonst wird "Sie ist 45" zum Gehalt.
    const fill = String.raw`\s*:?\s*(?:(?:jetzt|nun|neu|eher|ca\.?|circa|um|etwa|rund|bei)\s+)?`;
    const amount = String.raw`(\d{2,3}(?:[.,]\d)?\s*k?)`;
    const shorthand: Array<[RegExp, keyof DossierForm, string]> = [
      [new RegExp(String.raw`(?:\bIST\b|\b[Ii]st-?[Gg]ehalt\b|\b[Ii]st(?=\s*:))${fill}${amount}`), 'current_salary', 'Aktuelles Gehalt'],
      [new RegExp(String.raw`\b(?:wg|wunsch)${fill}${amount}`, 'i'), 'expected_salary', 'Wunschgehalt'],
      [new RegExp(String.raw`\b(?:sg|min(?:imum)?|untergrenze|schmerzgrenze)${fill}${amount}`, 'i'), 'salary_minimum', 'Schmerzgrenze'],
    ];
    for (const [re, key, label] of shorthand) {
      const m = s.match(re);
      const v = m ? salaryFrom(m[1]) : null;
      if (v) push(out, { key, value: v.high, display: `${label} ${formatEuro(v.high)}`, quote: q, sourceLabel, confidence: 3 });
    }

    // Gehalt in Teilsätzen ("will 45k, ginge auch mit 42"); das Thema einer
    // Frage in der Vorzeile gilt für die Antwort ("Ihr Gehaltswunsch?" → "45.000")
    const clauses = s.split(/,|;|\s(?:und|aber|oder)\s/i).map((c) => c.trim()).filter(Boolean);
    for (const clause of clauses) {
      const c = clause.toLowerCase();
      const hasMoney = /(\d)\s*(k\b|t€|tsd|€|euro|\.000)|\b(will|möchte|hätte (ich )?gerne?|wunsch|ginge|runter|mindestens|verdient|aktuell|derzeit|gehalt|minimum)\b[^.]*\d{2,3}/i.test(withoutDates(clause))
        || (topic === 'salary' && /\d{2,3}/.test(withoutDates(clause)));
      if (!hasMoney) continue;
      const v = salaryFrom(clause);
      if (!v) continue;
      if (/(min(imum)?|untergrenze|schmerzgrenze|mindestens|ginge|nicht unter|runter)/i.test(c)) {
        push(out, { key: 'salary_minimum', value: v.low, display: `Schmerzgrenze ${formatEuro(v.low)}`, quote: q, sourceLabel, confidence: 2 });
      } else if (/(aktuell|derzeit|momentan|verdient|zur zeit|heute)/i.test(c)) {
        push(out, { key: 'current_salary', value: v.high, display: `Aktuelles Gehalt ${formatEuro(v.high)}`, quote: q, sourceLabel, confidence: 2 });
      } else if (/(will|möchte|hätte (ich )?gerne?|wunsch|ziel|vorstellung|erwartet)/i.test(c) || topic === 'salary') {
        push(out, { key: 'expected_salary', value: v.high, display: `Wunschgehalt ${formatEuro(v.high)}`, quote: q, sourceLabel, confidence: 2 });
        if (v.low < v.high) push(out, { key: 'salary_minimum', value: v.low, display: `Schmerzgrenze ${formatEuro(v.low)}`, quote: q, sourceLabel, confidence: 1 });
      } else if (/gehalt/i.test(c)) {
        // "Gehalt: 45k" – heute oder Wunsch? Als unsicher vorschlagen, der Headhunter entscheidet
        push(out, { key: 'expected_salary', value: v.high, display: `Wunschgehalt ${formatEuro(v.high)}`, quote: q, sourceLabel, confidence: 1 });
      }
    }

    // Kündigungsfrist
    if (/(kündig|küf|frist|verfügbar|kann (erst )?(ab|in)|wechseln (ab|in))/i.test(low) || topic === 'notice') {
      const n = mapNoticeText(s);
      if (n) push(out, { key: 'notice_period', value: n, display: `Kündigungsfrist ${optionLabel(NOTICE_OPTIONS, n)}`, quote: q, sourceLabel, confidence: 3 });
    }

    // Sprachen
    for (const [word, name] of Object.entries(LANGUAGES)) {
      const re = new RegExp(`(muttersprache\\s*)?${word}\\w*\\s*(\\(?\\s*(c2|c1|b2|b1|a2|a1|muttersprach\\w*|fließend|fliessend|verhandlungssicher|sehr gut|gut|grundkenntnis\\w*|native)\\s*\\)?)?`, 'i');
      const m = s.match(re);
      if (m && !/\bauf\s+deutsch\b/i.test(s)) {
        const levelText = `${m[1] ?? ''} ${m[2] ?? ''}`;
        const level = LEVEL_MAP.find(([r]) => r.test(levelText))?.[1] ?? '';
        if (level || /spricht|sprach|kenntnis|level|niveau/i.test(low)) {
          if (!langs.some((l) => l.language === name)) langs.push({ language: name, proficiency: level });
          langQuote = langQuote || q;
        }
      }
    }

    // Motivation
    for (const [re, tag] of MOTIVATION_KEYWORDS) {
      if (re.test(s) && /(wechsel|weg|unzufrieden|stört|nervt|genug|grund|motivation|möchte|will|sucht|fehlt|kein|nicht mehr|belastet|zu viel|zu wenig)/i.test(low)) {
        tags.add(tag);
        tagQuote = tagQuote || q;
      }
    }
    if (/(wechselmotivation|wechselgrund|will weg|möchte weg|unzufrieden|stört|nervt|genug von|belastet|grund für den wechsel)/i.test(low)) {
      push(out, { key: 'change_motivation', value: s.replace(/^[-–•*]\s*/, ''), display: s, quote: q, sourceLabel, confidence: 2 });
    }
    const incident = s.match(/(seit (dem|der) [^,.;]+|neue[rn]? (chef\w*|vorgesetzt\w*|dienstplan|geschäftsführung|leitung)[^,.;]*|umstrukturierung[^,.;]*|übernahme[^,.;]*|reorganisation[^,.;]*)/i);
    if (incident) push(out, { key: 'specific_incident', value: incident[1].trim(), display: `Auslöser: ${incident[1].trim()}`, quote: q, sourceLabel, confidence: 1 });

    // Intern angesprochen / bleiben
    if (/(intern|chef\w*|vorgesetzt\w*|hr)\b[^.]*(angesprochen|gesprochen|thematisiert)/i.test(low)) {
      const v = /(ohne ergebnis|nichts passiert|abgelehnt|abgeblockt|keine lösung|bringt nichts)/i.test(low) ? 'Ja, ohne Ergebnis'
        : /(wird geprüft|in aussicht|zugesagt|lösung)/i.test(low) ? 'Ja, Lösung in Aussicht' : null;
      if (v) push(out, { key: 'discussed_internally', value: v, display: `Intern angesprochen: ${v}`, quote: q, sourceLabel, confidence: 2 });
    }
    if (/(würde|wäre|bliebe)[^.]*(nicht|kein)[^.]*bleiben|(bleibt|bleiben) (auf keinen fall|nicht)|gegenangebot[^.]*(nicht|kein)/i.test(low)) {
      push(out, { key: 'would_stay', value: 'no', display: 'Bleibt bei Nachbesserung: Nein', quote: q, sourceLabel, confidence: 2 });
    } else if (/(würde|wäre)[^.]*vielleicht[^.]*bleiben|gegenangebot[^.]*(überleg|vielleicht)/i.test(low)) {
      push(out, { key: 'would_stay', value: 'maybe', display: 'Bleibt bei Nachbesserung: Vielleicht', quote: q, sourceLabel, confidence: 2 });
    }

    // Arbeitsmodell, Pendeln, Umzug, Beschäftigung
    const remoteDays = s.match(/\brem(?:ote)?\.?\s*(\d)\s*\/\s*5\b|(\d)\s*tage?\s*(home.?office|remote|mobil)/i);
    let model: string | null = null;
    if (/nur remote|full.?remote|100\s*%\s*remote|komplett remote/i.test(low)) model = 'remote';
    else if (remoteDays) model = Number(remoteDays[1] ?? remoteDays[2]) >= 5 ? 'remote' : 'hybrid';
    else if (/\bhybrid\b/i.test(low)) model = 'hybrid';
    else if (/(vor ort|präsenz)[^.]*(ok|gern|kein problem|passt)/i.test(low)) model = 'onsite';
    else if (/(arbeitsmodell|remote|vor ort)[^.]*flexibel|flexibel[^.]*(remote|vor ort|arbeitsmodell)/i.test(low)) model = 'flexible';
    if (model) push(out, { key: 'remote_preference', value: model, display: `Arbeitsmodell ${optionLabel(WORK_MODEL_OPTIONS, model)}`, quote: q, sourceLabel, confidence: 2 });
    const commute = s.match(/(\d{2})\s*min(?:uten)?\.?\s*(?:pendel|fahrt|anfahrt|arbeitsweg|max)|(?:pendel\w*|anfahrt|fahrtweg|arbeitsweg)[^.\d]*(\d{2})\s*min/i);
    if (commute) {
      const minutes = Number(commute[1] ?? commute[2]);
      const nearest = [15, 30, 45, 60, 90].reduce((a, b) => (Math.abs(b - minutes) < Math.abs(a - minutes) ? b : a));
      push(out, { key: 'max_commute_minutes', value: nearest, display: `Max. Pendelzeit ${nearest} Min.`, quote: q, sourceLabel, confidence: 2 });
    }
    if (/umzug(sbereit\w*)?[^.]*(ja|möglich|kein problem|denkbar|vorstellbar)|würde umziehen|bereit umzuziehen/i.test(low)) {
      push(out, { key: 'relocation_willing', value: true, display: 'Umzugsbereit: Ja', quote: q, sourceLabel, confidence: 2 });
    } else if (/kein(en)? umzug|nicht umziehen|umzug[^.]*(nein|ausgeschlossen|kommt nicht)/i.test(low)) {
      push(out, { key: 'relocation_willing', value: false, display: 'Umzugsbereit: Nein', quote: q, sourceLabel, confidence: 2 });
    }
    if (/\bteilzeit\b/i.test(low)) push(out, { key: 'employment_type', value: 'parttime', display: 'Beschäftigung Teilzeit', quote: q, sourceLabel, confidence: 2 });
    else if (/\bvollzeit\b/i.test(low)) push(out, { key: 'employment_type', value: 'fulltime', display: 'Beschäftigung Vollzeit', quote: q, sourceLabel, confidence: 2 });
    else if (/freiberuf|freelance|selbstständig/i.test(low)) push(out, { key: 'employment_type', value: 'freelance', display: 'Beschäftigung freiberuflich', quote: q, sourceLabel, confidence: 1 });

    // Arbeitserlaubnis
    const permit = /eu-?bürger|deutsche[rn]? (staatsbürger|pass)|staatsangehörigkeit (deutsch|eu)/i.test(low) ? 'citizen'
      : /(blaue karte|niederlassungserlaubnis|aufenthaltstitel|arbeitserlaubnis (liegt vor|vorhanden))/i.test(low) ? 'permit'
      : /(visum (nötig|notwendig|erforderlich)|braucht (ein )?visum|keine arbeitserlaubnis)/i.test(low) ? 'needs_visa'
      : /(visum|arbeitserlaubnis) (beantragt|in (klärung|bearbeitung))/i.test(low) ? 'pending' : null;
    if (permit) push(out, { key: 'work_permit', value: permit, display: `Arbeitserlaubnis: ${optionLabel(PERMIT_OPTIONS, permit)}`, quote: q, sourceLabel, confidence: 2 });

    // Markt: andere Bewerbungen, Sperrliste, Einverständnis
    if (/(andere[rnm]?\s+(prozess\w*|bewerbung\w*|gespräch\w*|firm\w*|anbieter\w*|unternehmen|arbeitgeber\w*)|zweite[snr]? (gespräch|runde)|dritte[nr]? runde|finale[nr]? runde|letzte[nr]? runde|angebot (von|bei|liegt|in der tasche)|im gespräch mit)/i.test(low)) {
      const v = /(angebot (liegt|in der tasche|bekommen)|hat ein angebot)/i.test(low) ? 'offer'
        : /(zweite[snr]? (gespräch|runde)|dritte[nr]? runde|finale|letzte[nr]? runde|fortgeschritten)/i.test(low) ? 'advanced' : 'early';
      push(out, { key: 'other_applications', value: v, display: `Andere Bewerbungen: ${optionLabel(OTHER_APPLICATIONS_OPTIONS, v)}`, quote: q, sourceLabel, confidence: 2 });
    }
    const block = s.match(/(?:nicht (?:zu|bei|an)|bitte nicht|keinesfalls|auf keinen fall(?: zu| bei)?)\s+((?:[A-ZÄÖÜ][\w&-]+)(?:\s+[A-ZÄÖÜ][\w&-]+){0,3})/);
    if (block) {
      const company = block[1].replace(/[.,;:]+$/, '').trim();
      push(out, { key: 'blocked_companies', value: [company], display: `Sperrliste: ${company}`, quote: q, sourceLabel, confidence: 2 });
    }
    if (/(einverstanden|darf (ich )?(sie|ihn|ihr|sein) (profil )?vorstellen|ok mit (der )?vorstellung|zustimmung zur vorstellung)/i.test(low) && !/nicht einverstanden/i.test(low)) {
      push(out, { key: 'presentation_consent', value: true, display: 'Einverständnis zur anonymen Vorstellung', quote: q, sourceLabel, confidence: 1 });
    }
    topic = askedTopic;
  }

  if (tags.size) push(out, { key: 'change_motivation_tags', value: [...tags], display: `Motivation: ${[...tags].join(', ')}`, quote: tagQuote, sourceLabel, confidence: 2 });
  if (langs.length) push(out, { key: 'languages', value: langs, display: `Sprachen: ${langs.map((l) => (l.proficiency ? `${l.language} ${l.proficiency}` : l.language)).join(', ')}`, quote: langQuote, sourceLabel, confidence: 2 });

  return { suggestions: out, protectedMentions: [...protectedMentions] };
}
