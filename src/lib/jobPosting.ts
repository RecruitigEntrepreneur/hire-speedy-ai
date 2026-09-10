import { briefingText, getRecruiterCriteria } from './recruiterBriefing';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';

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
 */

export type PostingBlock = { id: string; title: string; lead?: string; bullets: string[] };
export type Posting = {
  title: string;
  subtitle: string;
  facts: string[];
  blocks: PostingBlock[];
};

type Formatted = { role_summary?: unknown; ideal_candidate?: unknown; anonymous_company_pitch?: unknown };

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
function block(id: string, title: string, bullets: (string | null | undefined)[], lead?: string): PostingBlock | null {
  const gefuellt = bullets.filter((item): item is string => Boolean(item && item.trim()));
  if (!gefuellt.length && !lead) return null;
  return { id, title, lead, bullets: gefuellt };
}

export function buildJobPosting(job: WorkspaceJob): Posting {
  const formatted = (job.formatted_content ?? null) as Formatted | null;
  const criteria = getRecruiterCriteria(job);
  const freelance = job.employment_type === 'freelance';

  const subtitle = [
    job.industry,
    job.location,
    job.remote_type ? REMOTE[job.remote_type] ?? job.remote_type : null,
    job.employment_type ? EMPLOYMENT[job.employment_type] ?? job.employment_type : null,
    briefingText(job.contract_limitation),
  ].filter(Boolean).join(' · ');

  const facts = [
    freelance
      ? (job.day_rate_min || job.day_rate_max
          ? `${[job.day_rate_min, job.day_rate_max].filter(Boolean).map(v => money(v as number)).join(' – ')} € pro Tag`
          : null)
      : (job.salary_min || job.salary_max
          ? `${[job.salary_min, job.salary_max].filter(Boolean).map(v => money(v as number)).join(' – ')} €`
          : null),
    !freelance && job.salary_months ? `${briefingText(job.salary_months)} Monatsgehälter` : null,
    !freelance && job.bonus_structure ? `Bonus ${briefingText(job.bonus_structure)}` : null,
    job.onsite_days_required != null
      ? (job.onsite_days_required === 0 ? 'Vollständig remote' : `${job.onsite_days_required} Tage vor Ort`)
      : null,
    job.remote_days_flexible ? 'Homeoffice frei wählbar' : null,
    job.experience_level ? LEVEL[job.experience_level] ?? job.experience_level : null,
    job.core_hours ? briefingText(job.core_hours) : null,
  ].filter((item): item is string => Boolean(item));

  /* Die Aufgabenverteilung des Kunden wird zur Aufgabenliste -- sie ist das
     Einzige, was schon in Stichpunkten vorliegt. Der Arbeitsalltag steht als
     Fliesstext darunter, weil ihn zu zerhacken seinen Wert nimmt. */
  const aufgaben = job.task_breakdown && typeof job.task_breakdown === 'object' && !Array.isArray(job.task_breakdown)
    ? Object.entries(job.task_breakdown as Record<string, unknown>).map(([name, anteil]) => {
        const wert = briefingText(anteil);
        return wert ? `${name} — ${wert}${typeof anteil === 'number' ? ' %' : ''}` : name;
      })
    : [];

  const blocks = [
    block('ueber', 'Über die Position',
      [briefingText(job.task_focus) ? `Schwerpunkt: ${briefingText(job.task_focus)}` : null,
       briefingText(job.reports_to) ? `Berichtet an ${briefingText(job.reports_to)}` : null,
       job.team_size != null && Number(job.team_size) > 0 ? `Team aus ${briefingText(job.team_size)} Personen` : null],
      briefingText(formatted?.role_summary) || undefined),

    block('aufgaben', 'Deine Aufgaben', aufgaben, briefingText(job.daily_routine) || undefined),

    block('profil', 'Das bringst du mit', [
      criteria.required.length ? `Zwingend: ${criteria.required.join(' · ')}` : null,
      [...criteria.trainable, ...criteria.negotiable].length
        ? `Von Vorteil: ${[...criteria.trainable, ...criteria.negotiable].join(' · ')}` : null,
      /* Nur was NICHT schon oben steht. Sonst erschien "Bilanzbuchhalter IHK"
         zweimal -- einmal als "von Vorteil" und einmal als "Zertifikate",
         was sich wie eine Anforderung liest, obwohl der Kunde es
         ausdruecklich als verhandelbar eingestuft hat. */
      (() => {
        const genannt = new Set([...criteria.required, ...criteria.trainable, ...criteria.negotiable].map(schluessel));
        const offen = list(job.required_certifications).filter(z => !genannt.has(schluessel(z)));
        return offen.length ? `Zertifikate: ${offen.join(' · ')}` : null;
      })(),
    ], briefingText(formatted?.ideal_candidate) || undefined),

    block('angebot', 'Das bieten wir', [
      briefingText(job.career_path),
      briefingText(job.position_advantages),
      ohneDubletten(list(job.benefits)).join(' · ') || null,
      briefingText(job.contract_creation_days) ? `Vom Ja bis zum Vertrag: ${briefingText(job.contract_creation_days)} Tage` : null,
    ]),

    block('unternehmen', 'Das Unternehmen', [
      briefingText(job.unique_selling_points),
      briefingText(job.company_culture),
    ], briefingText(formatted?.anonymous_company_pitch) || undefined),
  ].filter((item): item is PostingBlock => item !== null);

  return { title: job.title ?? 'Position', subtitle, facts, blocks };
}

/** Dieselbe Anzeige als Fliesstext -- zum Einfügen in Mail oder Chat. */
export function postingAsText(posting: Posting): string {
  const zeilen = [posting.title, posting.subtitle, ''];
  if (posting.facts.length) zeilen.push(posting.facts.join('  ·  '), '');
  for (const b of posting.blocks) {
    zeilen.push(b.title.toUpperCase());
    if (b.lead) zeilen.push(b.lead);
    for (const bullet of b.bullets) zeilen.push(`• ${bullet}`);
    zeilen.push('');
  }
  return zeilen.join('\n').trim();
}
