import { briefingText, getRecruiterCriteria } from './recruiterBriefing';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';
import { setzePlatzhalter, type Ansprache, type Anzeige } from '../../supabase/functions/_shared/recruiter-anzeige.ts';
import { ZAHLUNG_KANDIDAT } from './recruiterContracting';

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
  role_summary?: unknown;
  ideal_candidate?: unknown;
  anonymous_company_pitch?: unknown;
  highlights?: unknown;
  anzeige?: Anzeige | null;
  ansprache?: Ansprache | null;
};

const EMPLOYMENT: Record<string, string> = {
  'full-time': 'Vollzeit', 'part-time': 'Teilzeit', freelance: 'Freiberuflich', contract: 'Befristet',
};
const LEVEL: Record<string, string> = {
  junior: 'Junior', mid: 'Mid-Level', senior: 'Senior', lead: 'Lead', principal: 'Principal',
};
const REMOTE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'Vor Ort' };

const money = (value: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value);

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
    return s ? `${s} € pro Tag` : null;
  }
  const s = spanne(job.salary_min, job.salary_max);
  return s ? `${s} €` : null;
}

function arbeitsort(job: WorkspaceJob): string | null {
  if (job.onsite_days_required != null) {
    return job.onsite_days_required === 0 ? 'Vollständig remote' : `${job.onsite_days_required} Tage vor Ort`;
  }
  if (job.remote_days_flexible) return 'Homeoffice frei wählbar';
  const modell = job.remote_type ? REMOTE[job.remote_type] ?? job.remote_type : null;
  return [modell, job.location].filter(Boolean).join(', ') || null;
}

function eckdatenVon(job: WorkspaceJob): Eckdatum[] {
  const freelance = job.employment_type === 'freelance';
  const geld = verguetung(job);
  const liste: (Eckdatum | null)[] = freelance
    ? [
        geld ? { label: 'Tagessatz', wert: `${geld}, zzgl. USt` } : null,
        job.utilization_days_per_week ? { label: 'Umfang', wert: `${briefingText(job.utilization_days_per_week)} Tage / Woche` } : null,
        job.contract_duration_months
          ? { label: 'Laufzeit', wert: `${briefingText(job.contract_duration_months)} Monate${job.extension_possible ? ', Verlängerung möglich' : ''}` }
          : null,
      ]
    : [
        geld ? { label: 'Gehalt', wert: geld } : null,
        job.salary_months ? { label: 'Monatsgehälter', wert: briefingText(job.salary_months) } : null,
        job.bonus_structure ? { label: 'Bonus', wert: briefingText(job.bonus_structure) } : null,
      ];
  liste.push(
    arbeitsort(job) ? { label: 'Arbeitsort', wert: arbeitsort(job)! } : null,
    job.experience_level ? { label: 'Level', wert: LEVEL[job.experience_level] ?? job.experience_level } : null,
    !freelance && job.core_hours ? { label: 'Kernzeit', wert: briefingText(job.core_hours) } : null,
  );
  return liste.filter((e): e is Eckdatum => Boolean(e && e.wert));
}

export function buildJobPosting(job: WorkspaceJob, kontakt?: Kontakt | null): Posting {
  const formatted = (job.formatted_content ?? null) as Formatted | null;
  const anzeige: Anzeige = formatted?.anzeige ?? {};
  const criteria = getRecruiterCriteria(job);
  const freelance = job.employment_type === 'freelance';
  // KI-Texte tragen {VERGUETUNG} statt einer Zahl; eingesetzt wird die Zahl der Recruiter-Sicht.
  const ki = (v: unknown) => setzePlatzhalter(briefingText(v), { verguetung: verguetung(job) });
  const kiListe = (v: unknown) => texte(v).map(t => setzePlatzhalter(t, { verguetung: verguetung(job) }));

  const subtitle = [
    job.industry,
    job.location,
    job.remote_type ? REMOTE[job.remote_type] ?? job.remote_type : null,
    job.employment_type ? EMPLOYMENT[job.employment_type] ?? job.employment_type : null,
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
  const firmaKunde = [briefingText(job.unique_selling_points), briefingText(job.company_culture)].filter(Boolean);

  const zwingendKunde = criteria.required;
  const vorteilKunde = [...criteria.trainable, ...criteria.negotiable];
  const zwingend = zwingendKunde.length ? zwingendKunde : kiListe(anzeige.profil_zwingend);
  const vorteil = vorteilKunde.length ? vorteilKunde : kiListe(anzeige.profil_vorteil);
  /* Nur was NICHT schon oben steht. Sonst erschien "Bilanzbuchhalter IHK"
     zweimal -- einmal als "von Vorteil" und einmal als "Zertifikate", was sich
     wie eine Anforderung liest, obwohl der Kunde es ausdruecklich als
     verhandelbar eingestuft hat. */
  const zertifikate = (() => {
    const genannt = new Set([...zwingend, ...vorteil].map(schluessel));
    const offen = list(job.required_certifications).filter(z => !genannt.has(schluessel(z)));
    return offen.length ? `Zertifikate: ${offen.join(' · ')}` : null;
  })();

  const angebotKunde = [
    briefingText(job.career_path),
    briefingText(job.position_advantages),
    ohneDubletten(list(job.benefits)).join(' · ') || null,
  ].filter((v): v is string => Boolean(v));
  const angebotKi = angebotKunde.length ? [] : kiListe(anzeige.angebot);
  // Contracting: was für jeden Einsatz über Matchunt gilt.
  const angebotSystem = freelance
    ? ['Vertrag als selbstständige Subunternehmerin / selbstständiger Subunternehmer mit Matchunt', ZAHLUNG_KANDIDAT]
    : [];

  const teamKunde = [
    job.team_size != null && Number(job.team_size) > 0 ? `Team aus ${briefingText(job.team_size)} Personen` : null,
    briefingText(job.reports_to) ? `${freelance ? 'Fachliche Führung' : 'Berichtet an'}: ${briefingText(job.reports_to)}` : null,
  ];

  // Der Ablauf erscheint erst mit der neuen Anzeige: vorher gab es ihn nicht,
  // und ohne Angaben des Kunden wäre er reine Floskel.
  const neueAnzeige = Boolean(formatted?.anzeige);
  const ablaufKi = kiListe(anzeige.ablauf);
  const vertragstage = briefingText(job.contract_creation_days) ? `Vom Ja bis zum Vertrag: ca. ${briefingText(job.contract_creation_days)} Tage` : null;
  const ablauf = neueAnzeige
    ? ['Kurzes Gespräch mit mir', ...(ablaufKi.length ? ablaufKi : ['Vorstellung beim Kunden', 'Kennenlernen mit dem Kunden']), vertragstage]
    : [vertragstage];

  const blocks = [
    block('ueber', 'Worum es geht',
      [briefingText(job.task_focus) ? `Schwerpunkt: ${briefingText(job.task_focus)}` : null],
      einleitung || undefined,
      { herkunft: [einleitung ? 'ki' : null, job.task_focus ? 'kunde' : null].filter(Boolean) as Herkunft[] }),

    block('unternehmen', 'Das Unternehmen', firmaKunde, firmaText || undefined,
      { herkunft: [firmaText ? 'ki' : null, firmaKunde.length ? 'kunde' : null].filter(Boolean) as Herkunft[] }),

    block('aufgaben', 'Deine Aufgaben', aufgaben, undefined, {
      nachsatz: alltag ? `Arbeitsalltag: ${alltag}` : undefined,
      herkunft: [aufgabenKunde.length || alltagKunde ? 'kunde' : null, (!aufgabenKunde.length && aufgaben.length) || (!alltagKunde && alltag) ? 'ki' : null].filter(Boolean) as Herkunft[],
    }),

    block('profil', 'Das bringst du mit', [zertifikate], briefingText(formatted?.ideal_candidate) || undefined, {
      gruppen: [{ titel: 'Zwingend', bullets: zwingend }, { titel: 'Von Vorteil', bullets: vorteil }],
      herkunft: [zwingendKunde.length || vorteilKunde.length ? 'kunde' : null, (!zwingendKunde.length && zwingend.length) || (!vorteilKunde.length && vorteil.length) || formatted?.ideal_candidate ? 'ki' : null].filter(Boolean) as Herkunft[],
    }),

    block('angebot', freelance ? 'Das Projekt bietet' : 'Das bieten wir', [...angebotKunde, ...angebotKi, ...angebotSystem], undefined, {
      herkunft: [angebotKunde.length ? 'kunde' : null, angebotKi.length ? 'ki' : null, angebotSystem.length ? 'system' : null].filter(Boolean) as Herkunft[],
    }),

    block('team', 'Team & Zusammenarbeit', teamKunde, ki(anzeige.team) || undefined, {
      herkunft: [teamKunde.some(Boolean) ? 'kunde' : null, anzeige.team ? 'ki' : null].filter(Boolean) as Herkunft[],
    }),

    block('ablauf', 'So läuft es ab', ablauf, undefined, {
      herkunft: [neueAnzeige ? 'system' : null, ablaufKi.length ? 'ki' : null, vertragstage ? 'kunde' : null].filter(Boolean) as Herkunft[],
    }),
  ].filter((item): item is PostingBlock => item !== null);

  return {
    title: job.title ?? 'Position',
    subtitle,
    facts: eckdaten.map(e => (e.label === 'Tagessatz' ? verguetung(job)! : e.wert)),
    eckdaten,
    blocks,
    ...(kontakt ? { kontakt } : {}),
  };
}

export function kontaktZeile(kontakt: Kontakt | null | undefined): string | null {
  if (!kontakt?.name) return null;
  return [kontakt.name, kontakt.email, kontakt.phone, kontakt.linkedin].filter(Boolean).join(' · ');
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
  if (kontakt) zeilen.push('DEINE ANSPRECHPERSON', kontakt, '');
  return zeilen.join('\n').trim();
}

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
  const formatted = (job.formatted_content ?? null) as Formatted | null;
  const s = formatted?.ansprache ?? {};
  const geld = verguetung(job);
  const setze = (t: string) => setzePlatzhalter(t, { vorname, verguetung: geld });
  const titel = job.title ?? 'eine Position';
  const branche = briefingText(job.industry);
  const ort = [briefingText(job.location), job.remote_type ? REMOTE[job.remote_type] ?? job.remote_type : null].filter(Boolean).join(', ');

  const linkedin = setze(briefingText(s.linkedin) || [
    `Hallo {VORNAME}, ich suche für ${branche ? `ein Unternehmen aus der Branche ${branche}` : 'einen Kunden'} Verstärkung als ${titel}${ort ? ` (${ort})` : ''}.`,
    geld ? `Vergütung: {VERGUETUNG}.` : null,
    'Passt das gerade zu dir? Ich erzähle dir gern mehr.',
  ].filter(Boolean).join(' '));

  const gruss = ['Viele Grüße', posting.kontakt?.name, [posting.kontakt?.phone, posting.kontakt?.email].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
  const emailKern = setze(briefingText(s.email_text) || [
    'Hallo {VORNAME},',
    `ich betreue eine Stelle als ${titel}${branche ? ` in der Branche ${branche}` : ''} und denke dabei an dich.`,
    'Die ausführliche Beschreibung findest du unten. Hast du diese Woche 15 Minuten für ein kurzes Gespräch?',
  ].join('\n'));

  const argumente = texte(s.telefon?.argumente).length
    ? texte(s.telefon?.argumente)
    : [...list(job.unique_selling_points), ...texte(formatted?.highlights)].slice(0, 3);
  const fragen = texte(s.telefon?.fragen).length
    ? texte(s.telefon?.fragen)
    : getRecruiterCriteria(job).required.slice(0, 3).map(k => `Bringst du ${k} mit?`);

  return {
    linkedin,
    email: {
      betreff: setze(briefingText(s.email_betreff) || titel),
      text: [emailKern, '', gruss, '', '— Die ausführliche Beschreibung —', '', postingAsText(posting)].join('\n'),
    },
    telefon: {
      einstieg: setze(briefingText(s.telefon?.einstieg) || `Ich rufe wegen einer Stelle als ${titel} an – hast du zwei Minuten?`),
      argumente: argumente.map(setze),
      fragen: fragen.map(setze),
      konditionen: geld ? (job.employment_type === 'freelance' ? `${geld}, zzgl. USt` : geld) : null,
      naechster: 'Profil anonym beim Kunden vorstellen',
    },
  };
}
