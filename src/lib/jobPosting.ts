import { briefingText, getRecruiterCriteria } from './recruiterBriefing';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';
import { setzePlatzhalter, type Ansprache, type Anzeige } from '../../supabase/functions/_shared/recruiter-anzeige.ts';
import { zahlungKandidat } from './recruiterContracting';
import { kiInhalt } from './kiInhalt';
import { candidateLanguage, fmtNumber, tFor } from './localeFormat';

// Anzeige und Ansprache gehen an Kandidaten: in der Sprache des Headhunters (sein Markt),
// beim Aufruf gelesen (Namespace jobPosting). Inhalte des Kunden bleiben, wie sie sind.
const tp = (key: string, options?: Record<string, unknown>): string => tFor(candidateLanguage(), 'jobPosting')(key, options) as string;

/**
 * Die Stellenanzeige — die Fassung, die der Headhunter dem Kandidaten zeigt.
 *
 * Das Mandatsbriefing ist etwas anderes: es ist für IHN geschrieben und
 * enthält, was der Kandidat nie sehen darf — sein Honorar, die Konkurrenzlage,
 * warum die letzte Kandidatin abgesprungen ist, und wer hier gescheitert ist.
 *
 * Diese Seite lässt all das weg. Sie liest sich wie eine Stellenanzeige, weil
 * genau diese Form jeder kennt: Über die Position, Aufgaben, Profil, Angebot,
 * Unternehmen. Der Firmenname bleibt auch dann draußen, wenn der Recruiter ihn
 * kennt — die Freigabe gilt ihm, nicht dem Kandidaten.
 *
 * Woher der Text kommt, ist eine bewusste Mischung: Aufgaben und Angebot aus
 * den ECHTEN Angaben des Kunden, nur die Einleitung aus der KI-Aufbereitung.
 * Reine Modelltexte lesen sich glatter und sagen weniger; die Sätze des Kunden
 * sind das, was einen Kandidaten bewegt.
 *
 * Seit 29.09.2026 (Anzeige & Ansprache): Die KI liefert zusätzlich eine
 * vollständige Anzeige (formatted_content.anzeige). Sie füllt nur, wo der
 * Kunde nichts gesagt hat -- jeder Abschnitt trägt seine Herkunft, die der
 * Recruiter sieht (nicht der Kandidat). Beträge kommen immer vom System.
 */

export type Herkunft = 'kunde' | 'ki' | 'system';
export type PostingGruppe = { titel: string; bullets: string[] };
export type PostingBlock = {
  id: string;
  title: string;
  lead?: string;
  bullets: string[];
  /** Unterüberschriften, z. B. "Zwingend" / "Von Vorteil". */
  gruppen?: PostingGruppe[];
  /** Absatz nach den Punkten, z. B. der Arbeitsalltag. */
  nachsatz?: string;
  /** Woher der Inhalt stammt -- nur für den Recruiter, nie im kopierten Text. */
  herkunft?: Herkunft[];
};
export type Eckdatum = { label: string; wert: string };
export type Kontakt = { name?: string | null; email?: string | null; phone?: string | null; linkedin?: string | null };
export type Posting = {
  title: string;
  subtitle: string;
  facts: string[];
  eckdaten: Eckdatum[];
  blocks: PostingBlock[];
  kontakt?: Kontakt;
};

type Formatted = {
  role_summary?: string;
  ideal_candidate?: string;
  anonymous_company_pitch?: string;
  highlights?: string[];
  anzeige?: Anzeige | null;
  ansprache?: Ansprache | null;
};

const EMPLOYMENT_KEY: Record<string, string> = {
  'full-time': 'fullTime', 'part-time': 'partTime', freelance: 'freelance', contract: 'contract',
};
const employment = (v: string) => (EMPLOYMENT_KEY[v] ? tp(`employment.${EMPLOYMENT_KEY[v]}`) : v);
const LEVEL: Record<string, string> = {
  junior: 'Junior', mid: 'Mid-Level', senior: 'Senior', lead: 'Lead', principal: 'Principal',
};
const REMOTE_KEYS = new Set(['remote', 'hybrid', 'onsite']);
const remote = (v: string) => (REMOTE_KEYS.has(v) ? tp(`remote.${v}`) : v);

const money = (value: number) => fmtNumber(value, candidateLanguage(), { maximumFractionDigits: 0 });

const schluessel = (value: string) => value.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');

function list(value: unknown): string[] {
  const text = briefingText(value);
  return text ? text.split(' · ').filter(Boolean) : [];
}

/**
 * Benefit-Listen enthalten dieselbe Leistung mehrfach.
 *
 * BEFUND (10.09.2026, an einer echten Stelle gezaehlt): 20 Eintraege, darunter
 * "betriebliche Altersvorsorge" und "Betriebliche Altersvorsorge", "Jobrad"
 * und "Jobrad / Fahrradleasing", "Essenszuschuss" und "Essenszuschuss oder
 * Kantine". Die Chipliste der Aufnahme ist ueber die Zeit gewachsen und
 * enthaelt beide Schreibweisen; der Kunde klickt beide an, weil beide
 * zutreffen.
 *
 * Zwei Regeln, beide eng gefasst: Gross-/Kleinschreibung faellt zusammen, und
 * ein Eintrag, der vollstaendig am Anfang eines laengeren steht, entfaellt
 * zugunsten des laengeren. "Jobrad" verschwindet also hinter "Jobrad /
 * Fahrradleasing", aber "Bonus" bleibt neben "Bonusregelung des Wettbewerbs"
 * stehen -- nur ein echter Praefix mit folgendem Trennzeichen zaehlt.
 */
function ohneDubletten(werte: string[]): string[] {
  const eindeutig = [...new Map(werte.map(w => [schluessel(w), w])).values()];
  return eindeutig.filter(kurz => !eindeutig.some(lang => {
    if (lang === kurz) return false;
    const a = schluessel(kurz), b = schluessel(lang);
    return b.startsWith(a) && /[\s/,(-]/.test(b.charAt(a.length));
  }));
}

/** Nur echte Werte. Ein leerer Block erscheint gar nicht, statt als Floskel. */
function block(
  id: string, title: string, bullets: (string | null | undefined)[], lead?: string,
  extra: Partial<Pick<PostingBlock, 'gruppen' | 'nachsatz' | 'herkunft'>> = {},
): PostingBlock | null {
  const gefuellt = bullets.filter((item): item is string => Boolean(item && item.trim()));
  const gruppen = (extra.gruppen ?? []).filter(g => g.bullets.length > 0);
  if (!gefuellt.length && !lead && !gruppen.length && !extra.nachsatz) return null;
  return {
    id, title, lead, bullets: gefuellt,
    ...(gruppen.length ? { gruppen } : {}),
    ...(extra.nachsatz ? { nachsatz: extra.nachsatz } : {}),
    ...(extra.herkunft?.length ? { herkunft: [...new Set(extra.herkunft)] } : {}),
  };
}

const texte = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => briefingText(x)).filter(Boolean) : []);
const spanne = (a: unknown, b: unknown) => [a, b].filter(v => typeof v === 'number' && v > 0).map(v => money(v as number)).join(' – ');

/** Die Vergütung, wie Recruiter sie sehen (recruiter_jobs_view: Satz des Spezialisten bzw. Gehalt). */
export function verguetung(job: WorkspaceJob): string | null {
  if (job.employment_type === 'freelance') {
    const s = spanne(job.day_rate_min, job.day_rate_max);
    return s ? tp('money.perDay', { amount: s }) : null;
  }
  const s = spanne(job.salary_min, job.salary_max);
  return s ? tp('money.eur', { amount: s }) : null;
}

function arbeitsort(job: WorkspaceJob): string | null {
  if (job.onsite_days_required != null) {
    return job.onsite_days_required === 0 ? tp('posting.fullyRemote') : tp('posting.onsiteDays', { count: job.onsite_days_required });
  }
  if (job.remote_days_flexible) return tp('posting.homeofficeFree');
  const modell = job.remote_type ? remote(job.remote_type) : null;
  return [modell, job.location].filter(Boolean).join(', ') || null;
}

function eckdatenVon(job: WorkspaceJob): Eckdatum[] {
  const freelance = job.employment_type === 'freelance';
  const geld = verguetung(job);
  const liste: (Eckdatum | null)[] = freelance
    ? [
        geld ? { label: tp('posting.label.dayRate'), wert: tp('posting.plusVat', { amount: geld }) } : null,
        job.utilization_days_per_week ? { label: tp('posting.label.scope'), wert: tp('posting.daysPerWeek', { n: briefingText(job.utilization_days_per_week) }) } : null,
        job.contract_duration_months
          ? { label: tp('posting.label.duration'), wert: tp(job.extension_possible ? 'posting.monthsExtension' : 'posting.months', { n: briefingText(job.contract_duration_months) }) }
          : null,
      ]
    : [
        geld ? { label: tp('posting.label.salary'), wert: geld } : null,
        job.salary_months ? { label: tp('posting.label.salaries'), wert: briefingText(job.salary_months) } : null,
        job.bonus_structure ? { label: tp('posting.label.bonus'), wert: briefingText(job.bonus_structure) } : null,
      ];
  liste.push(
    arbeitsort(job) ? { label: tp('posting.label.location'), wert: arbeitsort(job)! } : null,
    job.experience_level ? { label: tp('posting.label.level'), wert: LEVEL[job.experience_level] ?? job.experience_level } : null,
    !freelance && job.core_hours ? { label: tp('posting.label.coreHours'), wert: briefingText(job.core_hours) } : null,
  );
  return liste.filter((e): e is Eckdatum => Boolean(e && e.wert));
}

export function buildJobPosting(job: WorkspaceJob, kontakt?: Kontakt | null): Posting {
  // KI-Texte ohne Behauptungen, die der Kunde nicht gemacht hat (21.10.2026).
  const formatted = kiInhalt<Formatted>(job as unknown as Record<string, unknown>);
  const anzeige: Anzeige = formatted?.anzeige ?? {};
  const criteria = getRecruiterCriteria(job);
  const freelance = job.employment_type === 'freelance';
  // KI-Texte tragen {VERGUETUNG} statt einer Zahl; eingesetzt wird die Zahl der Recruiter-Sicht.
  const ki = (v: unknown) => setzePlatzhalter(briefingText(v), { verguetung: verguetung(job) });
  const kiListe = (v: unknown) => texte(v).map(t => setzePlatzhalter(t, { verguetung: verguetung(job) }));

  const subtitle = [
    job.industry,
    job.location,
    job.remote_type ? remote(job.remote_type) : null,
    job.employment_type ? employment(job.employment_type) : null,
    briefingText(job.contract_limitation),
  ].filter(Boolean).join(' · ');

  const eckdaten = eckdatenVon(job);

  /* Die Aufgabenverteilung des Kunden wird zur Aufgabenliste -- sie ist das
     Einzige, was schon in Stichpunkten vorliegt. Fehlt sie, formuliert die KI
     die Aufgaben aus dem Anzeigentext. */
  const aufgabenKunde = job.task_breakdown && typeof job.task_breakdown === 'object' && !Array.isArray(job.task_breakdown)
    ? Object.entries(job.task_breakdown as Record<string, unknown>).map(([name, anteil]) => {
        const wert = briefingText(anteil);
        return wert ? `${name} — ${wert}${typeof anteil === 'number' ? ' %' : ''}` : name;
      })
    : [];
  const aufgaben = aufgabenKunde.length ? aufgabenKunde : kiListe(anzeige.aufgaben);
  const alltagKunde = briefingText(job.daily_routine);
  const alltag = alltagKunde || ki(anzeige.arbeitsalltag);

  const einleitung = ki(anzeige.einleitung) || briefingText(formatted?.role_summary);
  const firmaText = ki(anzeige.unternehmen) || briefingText(formatted?.anonymous_company_pitch);

  const zwingendKunde = criteria.required;
  const vorteilKunde = [...criteria.trainable, ...criteria.negotiable];
  const zwingend = zwingendKunde.length ? zwingendKunde : kiListe(anzeige.profil_zwingend);
  const vorteil = vorteilKunde.length ? vorteilKunde : kiListe(anzeige.profil_vorteil);
  /* Nur was NICHT schon oben steht. Sonst erschien "Bilanzbuchhalter IHK"
     zweimal -- einmal als "von Vorteil" und einmal als "Zertifikate", was sich
     wie eine Anforderung liest, obwohl der Kunde es ausdruecklich als
     verhandelbar eingestuft hat. */
  const zertifikate = (() => {
    // Enthalten statt gleich: „Steuerberaterexamen von Vorteil“ nennt das Zertifikat schon (21.10.2026).
    const genannt = [...zwingend, ...vorteil].map(schluessel);
    const offen = list(job.required_certifications).filter(z => !genannt.some(g => g.includes(schluessel(z))));
    return offen.length ? tp('posting.certificates', { list: offen.join(' · ') }) : null;
  })();

  // Vorteile als einzelne Punkte, Benefits nur, wenn sie dort nicht schon stehen;
  // das Karrierebeispiel als Beleg darunter (Doppelungen raus, 21.10.2026).
  const vorteilePunkte = ohneDubletten(list(job.position_advantages).flatMap(v => v.split(/\s·\s/)).map(v => v.trim()).filter(Boolean));
  const benefitsZeile = nichtSchonGenannt(ohneDubletten(list(job.benefits)), vorteilePunkte).join(' · ');
  const angebotKunde = [...vorteilePunkte, ...(benefitsZeile ? [benefitsZeile] : [])];
  // Besonderheiten der Firma ohne das, was schon im Angebot oder bei den Aufgaben steht (21.10.2026).
  const usps = nichtSchonGenannt(list(job.unique_selling_points).flatMap(u => u.split(/\s·\s/)).map(u => u.trim()).filter(Boolean),
    [...angebotKunde, ...aufgaben]);
  const firmaKunde = [usps.join(' · '), briefingText(job.company_culture)].filter(Boolean);
  const karriereBeleg = briefingText(job.career_example) || briefingText(job.career_path);
  const angebotKi = angebotKunde.length ? [] : kiListe(anzeige.angebot);
  // Contracting: was für jeden Einsatz über Matchunt gilt.
  const angebotSystem = freelance
    ? [tp('posting.selfEmployed'), zahlungKandidat(candidateLanguage())]
    : [];

  const teamKunde = [
    job.team_size != null && Number(job.team_size) > 0 ? tp('posting.teamOf', { n: briefingText(job.team_size) }) : null,
    briefingText(job.reports_to) ? tp(freelance ? 'posting.professionalLead' : 'posting.reportsTo', { name: briefingText(job.reports_to) }) : null,
  ];

  // Der Ablauf erscheint erst mit der neuen Anzeige: vorher gab es ihn nicht,
  // und ohne Angaben des Kunden wäre er reine Floskel.
  const neueAnzeige = Boolean(formatted?.anzeige);
  const ablaufKi = kiListe(anzeige.ablauf);
  const vertragstage = briefingText(job.contract_creation_days) ? tp('posting.contractDays', { n: briefingText(job.contract_creation_days) }) : null;
  const ablauf = neueAnzeige
    ? [tp('posting.stepCall'), ...(ablaufKi.length ? ablaufKi : [tp('posting.stepIntro'), tp('posting.stepMeet')]), vertragstage]
    : [vertragstage];

  const blocks = [
    block('ueber', tp('posting.block.about'),
      [briefingText(job.task_focus) ? tp('posting.focus', { text: briefingText(job.task_focus) }) : null],
      einleitung || undefined,
      { herkunft: [einleitung ? 'ki' : null, job.task_focus ? 'kunde' : null].filter(Boolean) as Herkunft[] }),

    block('unternehmen', tp('posting.block.company'), firmaKunde, firmaText || undefined,
      { herkunft: [firmaText ? 'ki' : null, firmaKunde.length ? 'kunde' : null].filter(Boolean) as Herkunft[] }),

    block('aufgaben', tp('posting.block.tasks'), aufgaben, undefined, {
      nachsatz: alltag ? `${tp('posting.dailyLabel')}: ${alltag}` : undefined,
      herkunft: [aufgabenKunde.length || alltagKunde ? 'kunde' : null, (!aufgabenKunde.length && aufgaben.length) || (!alltagKunde && alltag) ? 'ki' : null].filter(Boolean) as Herkunft[],
    }),

    block('profil', tp('posting.block.profile'), [zertifikate], briefingText(formatted?.ideal_candidate) || undefined, {
      gruppen: [{ titel: tp('posting.block.required'), bullets: zwingend }, { titel: tp('posting.block.plus'), bullets: vorteil }],
      herkunft: [zwingendKunde.length || vorteilKunde.length ? 'kunde' : null, (!zwingendKunde.length && zwingend.length) || (!vorteilKunde.length && vorteil.length) || formatted?.ideal_candidate ? 'ki' : null].filter(Boolean) as Herkunft[],
    }),

    block('angebot', tp(freelance ? 'posting.block.offerProject' : 'posting.block.offerUs'), [...angebotKunde, ...angebotKi, ...angebotSystem], undefined, {
      nachsatz: karriereBeleg ? `${tp('posting.exampleLabel')}: ${karriereBeleg}` : undefined,
      herkunft: [angebotKunde.length ? 'kunde' : null, angebotKi.length ? 'ki' : null, angebotSystem.length ? 'system' : null].filter(Boolean) as Herkunft[],
    }),

    block('team', tp('posting.block.team'), teamKunde, ki(anzeige.team) || undefined, {
      herkunft: [teamKunde.some(Boolean) ? 'kunde' : null, anzeige.team ? 'ki' : null].filter(Boolean) as Herkunft[],
    }),

    block('ablauf', tp('posting.block.process'), ablauf, undefined, {
      herkunft: [neueAnzeige ? 'system' : null, ablaufKi.length ? 'ki' : null, vertragstage ? 'kunde' : null].filter(Boolean) as Herkunft[],
    }),
  ].filter((item): item is PostingBlock => item !== null);

  return {
    title: job.title ?? tp('posting.position'),
    subtitle,
    facts: eckdaten.map(e => (e.label === tp('posting.label.dayRate') ? verguetung(job)! : e.wert)),
    eckdaten,
    blocks,
    ...(kontakt ? { kontakt } : {}),
  };
}

export function kontaktZeile(kontakt: Kontakt | null | undefined): string | null {
  if (!kontakt?.name) return null;
  return [kontakt.name, kontakt.email, kontakt.phone, kontakt.linkedin].filter(Boolean).join(' · ');
}

/**
 * Was nicht schon in `schon` steckt: ein Punkt gilt als genannt, wenn er ein
 * langes Wort (ab 9 Buchstaben) mit einem Punkt dort teilt oder darin enthalten ist
 * („Gleitzeit ohne Kernzeit“ in „Gleitzeit ohne Kernzeit und 2 Tage Homeoffice“,
 * „Übernahme der Kosten für das Steuerberaterexamen“ neben „Steuerberaterexamen komplett bezahlt“).
 */
export function nichtSchonGenannt(werte: string[], schon: string[]): string[] {
  const klein = schon.map(t => t.toLocaleLowerCase('de-DE'));
  const lang = new Set(klein.flatMap(t => t.split(/[^\p{L}]+/u).filter(w => w.length >= 9)));
  // Gemeinsame Folge aus drei Wörtern zählt auch: „… zum Head of Tax“ ↔ „Perspektive Head of Tax …“.
  const dreier = (t: string) => { const w = t.split(/[^\p{L}\d]+/u).filter(Boolean); return w.slice(2).map((_, i) => w.slice(i, i + 3).join(' ')); };
  const folgen = new Set(klein.flatMap(dreier));
  return werte.filter(w => {
    const k = w.toLocaleLowerCase('de-DE');
    if (klein.some(t => t.includes(k))) return false;
    if (dreier(k).some(f => folgen.has(f))) return false;
    return !k.split(/[^\p{L}]+/u).some(x => x.length >= 9 && lang.has(x));
  });
}

/** Dieselbe Anzeige als Fliesstext -- zum Einfügen in Mail oder Chat. Ohne Herkunfts-Etiketten. */
export function postingAsText(posting: Posting): string {
  const zeilen = [posting.title, posting.subtitle, ''];
  if (posting.eckdaten.length) zeilen.push(posting.eckdaten.map(e => `${e.label}: ${e.wert}`).join('  ·  '), '');
  for (const b of posting.blocks) {
    zeilen.push(b.title.toUpperCase());
    if (b.lead) zeilen.push(b.lead);
    for (const bullet of b.bullets) zeilen.push(`• ${bullet}`);
    for (const g of b.gruppen ?? []) {
      zeilen.push(`${g.titel}:`);
      for (const bullet of g.bullets) zeilen.push(`• ${bullet}`);
    }
    if (b.nachsatz) zeilen.push(b.nachsatz);
    zeilen.push('');
  }
  const kontakt = kontaktZeile(posting.kontakt);
  if (kontakt) zeilen.push(tp('posting.contact').toUpperCase(), kontakt, '');
  return zeilen.join('\n').trim();
}

/** Trennzeile vor der Anzeige in der E-Mail („— Die ausführliche Beschreibung —“). */
export const anspracheTrenner = () => tp('ansprache.divider');

export type AnspracheTexte = {
  linkedin: string;
  email: { betreff: string; text: string };
  telefon: { einstieg: string; argumente: string[]; fragen: string[]; konditionen: string | null; naechster: string };
};

/**
 * Die Kurzansprachen für LinkedIn, E-Mail und Telefon. Stammen sie noch nicht
 * von der KI (Stellen vor dem 29.09.2026), baut das System schlichte Texte
 * aus den Angaben -- lieber nüchtern als erfunden.
 */
export function buildAnsprache(job: WorkspaceJob, posting: Posting, vorname?: string | null): AnspracheTexte {
  const formatted = kiInhalt<Formatted>(job as unknown as Record<string, unknown>);
  const s = formatted?.ansprache ?? {};
  const geld = verguetung(job);
  const setze = (t: string) => setzePlatzhalter(t, { vorname, verguetung: geld });
  const titel = job.title ?? tp('ansprache.aPosition');
  const branche = briefingText(job.industry);
  const ort = [briefingText(job.location), job.remote_type ? remote(job.remote_type) : null].filter(Boolean).join(', ');

  const linkedin = setze(briefingText(s.linkedin) || [
    tp(branche ? 'ansprache.linkedinIndustry' : 'ansprache.linkedinClient', { industry: branche, title: titel, place: ort ? ` (${ort})` : '' }),
    geld ? tp('ansprache.pay') : null,
    tp('ansprache.fit'),
  ].filter(Boolean).join(' '));

  const gruss = [tp('ansprache.regards'), posting.kontakt?.name, [posting.kontakt?.phone, posting.kontakt?.email].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
  const emailKern = setze(briefingText(s.email_text) || [
    tp('ansprache.mailHello'),
    tp(branche ? 'ansprache.mailIntroIndustry' : 'ansprache.mailIntro', { title: titel, industry: branche }),
    tp('ansprache.mailMore'),
  ].join('\n'));

  const argumente = texte(s.telefon?.argumente).length
    ? texte(s.telefon?.argumente)
    : [...list(job.unique_selling_points), ...texte(formatted?.highlights)].slice(0, 3);
  const fragen = texte(s.telefon?.fragen).length
    ? texte(s.telefon?.fragen)
    : getRecruiterCriteria(job).required.slice(0, 3).map(k => tp('ansprache.question', { item: k }));

  return {
    linkedin,
    email: {
      betreff: setze(briefingText(s.email_betreff) || titel),
      text: [emailKern, '', gruss, '', anspracheTrenner(), '', postingAsText(posting)].join('\n'),
    },
    telefon: {
      einstieg: setze(briefingText(s.telefon?.einstieg) || tp('ansprache.phoneOpening', { title: titel })),
      argumente: argumente.map(setze),
      fragen: fragen.map(setze),
      konditionen: geld ? (job.employment_type === 'freelance' ? tp('posting.plusVat', { amount: geld }) : geld) : null,
      naechster: tp('ansprache.nextStep'),
    },
  };
}

/**
 * Der Aufhänger des Headhunters („5 Jahre WP-Gesellschaft“) als Satz nach der
 * Anrede; eine allgemeine Floskel wie „spannendes Profil!“ ersetzt er (21.10.2026).
 */
export function mitAufhaenger(text: string, aufhaenger: string | null | undefined): string {
  const a = (aufhaenger ?? '').trim();
  if (!a) return text;
  const satz = tp('ansprache.hook', { hook: a });
  // Anrede der Ansprache: „Hallo …,“ bzw. „Hej …!“ in der Sprache des Headhunters.
  const gruss = text.match(new RegExp(`^(${tp('ansprache.greeting')}[^,!\\n]*[,!])(\\s*)`));
  if (!gruss) return `${satz.charAt(0).toUpperCase()}${satz.slice(1)} ${text}`;
  const ohneFloskel = text.slice(gruss[0].length).replace(/^(spannendes|interessantes|tolles|starkes|beeindruckendes) Profil!?\s*/i, '');
  // Nach dem eingefügten Satz beginnt ein neuer: groß („ich bin …“ -> „Ich bin …“).
  const rest = ohneFloskel.charAt(0).toUpperCase() + ohneFloskel.slice(1);
  return gruss[2].includes('\n')
    ? `${gruss[1]}${gruss[2]}${satz.charAt(0).toUpperCase()}${satz.slice(1)} ${rest}`
    : `${gruss[1]} ${satz} ${rest}`;
}
