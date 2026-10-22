import { anonymFunde, brancheAllgemein, ersetzeFunde, groesseWort, regionAus, type Region } from '../../supabase/functions/_shared/linkedin-anonym';
import { kopfFakten } from './stellenKopf';
import { nichtSchonGenannt } from './jobPosting';
import { briefingText, getRecruiterCriteria, list } from './recruiterBriefing';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';

/**
 * Der LinkedIn-Beitrag zu einer Stelle (21.10.2026): nur Angaben des Kunden,
 * öffentlich anonym (Region statt Stadt, Branche allgemein, keine Zahl der
 * Mitarbeitenden, kein Firmenname) und mit dem Buchungslink des Headhunters.
 * Drei feste Töne ohne KI; der Headhunter kann danach frei ändern.
 */
export type Ton = 'sachlich' | 'persoenlich' | 'kurz';
export const TOENE: { id: Ton; label: string }[] = [
  { id: 'sachlich', label: 'Sachlich' },
  { id: 'persoenlich', label: 'Persönlich' },
  { id: 'kurz', label: 'Kurz' },
];

export const BEITRAG_MAX = 3000;
const ORIGIN = 'https://matchunt.ai';

export interface BeitragsOptionen {
  ton: Ton;
  gehalt: boolean;
  /** Slug der Terminseite; ohne: „Schreib mir hier auf LinkedIn“. */
  slug?: string | null;
  /** Vom Headhunter geänderte Region. */
  region?: string | null;
}

export interface Beitrag {
  text: string;
  hashtags: string[];
  region: Region;
  link: string | null;
  vorteile: string[];
  gehalt: string | null;
  titel: string;
}

const schluss = (t: string) => t.trim().replace(/[.;:,]+$/, '');
const kurzTitel = (t: string) => t.replace(/\s*\((?:m\/w\/d|w\/m\/d|m\/f\/d|d\/m\/w|all genders?)\)\s*/i, ' ').replace(/\s+/g, ' ').trim();

export function jobSlug(job: Pick<WorkspaceJob, 'id' | 'title'>): string {
  const basis = kurzTitel(job.title).split(/\s[–-]\s/)[0]
    .toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${basis || 'stelle'}-${job.id.replace(/-/g, '').slice(0, 6)}`;
}

export function buchungsLink(slug: string, job: Pick<WorkspaceJob, 'id' | 'title'>): string {
  return `${ORIGIN}/t/${slug}/${jobSlug(job)}`;
}

/** Die stärksten Vorteile: erst „Vorteile der Position“, dann Benefits, die dort nicht schon stehen. */
export function staerksteVorteile(job: WorkspaceJob, n = 3): string[] {
  const vorteile = list(job.position_advantages).flatMap(v => v.split(/\s·\s/)).map(schluss).filter(Boolean);
  const benefits = nichtSchonGenannt(list(job.benefits).map(schluss).filter(Boolean), vorteile);
  return [...vorteile, ...benefits].filter(v => v.length <= 90).slice(0, n);
}

/** Muss-Kriterien, die in einen Satz passen. */
function mussKurz(job: WorkspaceJob): string[] {
  return getRecruiterCriteria(job).required.map(schluss).filter(m => m.length <= 40).slice(0, 3);
}

const aufzaehlung = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} und ${xs[xs.length - 1]}`);

function hashtagsFuer(job: WorkspaceJob, region: string): string[] {
  const tag = (s: string) => '#' + s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const titel = kurzTitel(job.title).split(/\s[–-]\s/);
  const out = [titel[0], titel[1], briefingText(job.industry) ? brancheAllgemein(job.industry)?.name : null, region !== 'Deutschland' ? region : null]
    .filter((s): s is string => !!s && s.length <= 30).map(tag);
  return [...new Set(out)].filter(h => h.length > 2).slice(0, 4);
}

export function baueBeitrag(job: WorkspaceJob, opt: BeitragsOptionen): Beitrag {
  const roh = job as unknown as Record<string, unknown>;
  const region = regionAus(job.location, job.remote_type);
  const regionText = opt.region?.trim() || region.text;
  const titel = job.title.trim();
  const geld = opt.gehalt ? kopfFakten(job).find(f => f.symbol === 'geld')?.text ?? null : null;
  const vor = kopfFakten(job).find(f => f.symbol === 'ort')?.text;
  const branche = brancheAllgemein(job.industry);
  const groesse = groesseWort(roh.company_headcount, job.company_size_band);
  const firma = ['ein', groesse, 'Unternehmen'].filter(Boolean).join(' ') + (branche ? ` ${branche.aus}` : '');
  const vorteile = staerksteVorteile(job);
  const muss = mussKurz(job);
  const link = opt.slug ? buchungsLink(opt.slug, job) : null;
  const hashtags = hashtagsFuer(job, regionText);
  const punkte = [...vorteile, ...(geld ? [geld] : [])].map(v => `✓ ${v}`);
  const cta = link ? `15 Minuten, vertraulich: Such dir direkt einen Termin bei mir aus.\n→ ${link}` : 'Interesse? Schreib mir hier auf LinkedIn, vertraulich.';

  let text: string;
  if (opt.ton === 'kurz') {
    text = [
      `${kurzTitel(titel)} · ${regionText}${geld ? ` · ${geld}` : ''}`,
      vorteile.slice(0, 2).map(v => `✓ ${v}`).join('\n'),
      link ? `Termin, 15 Min., vertraulich: ${link}` : 'Interesse? Schreib mir, vertraulich.',
      hashtags.join(' '),
    ].filter(Boolean).join('\n\n');
  } else if (opt.ton === 'persoenlich') {
    const erster = vorteile[0] ? ` Was mich daran überzeugt: ${vorteile[0].charAt(0).toLowerCase()}${vorteile[0].slice(1)}.` : '';
    text = [
      `Für ${firma} (${regionText}) suche ich gerade vertraulich: ${titel}.${erster}`,
      [...vorteile.slice(1), ...(geld ? [geld] : []), ...(vor ? [vor] : [])].map(v => `✓ ${v}`).join('\n'),
      muss.length ? `Wenn du ${aufzaehlung(muss)} mitbringst, lass uns sprechen.` : '',
      cta,
      hashtags.join(' '),
    ].filter(Boolean).join('\n\n');
  } else {
    text = [
      `Vertrauliche Suche: ${titel}, ${regionText}`,
      `Für ${firma} besetze ich diese Position vertraulich.`,
      punkte.join('\n'),
      muss.length ? `Du bringst ${aufzaehlung(muss)} mit?` : '',
      cta,
      hashtags.join(' '),
    ].filter(Boolean).join('\n\n');
  }
  // Sicherheitsnetz: steht in den Angaben doch etwas, das den Kunden verrät, fliegt es raus.
  const funde = anonymFunde(text, {
    firma: job.company_name, redList: roh.red_list,
    domains: [roh.company_website as string | null],
    region: { ...region, text: regionText },
    mitarbeitende: Number(roh.company_headcount) || null,
  });
  if (funde.length) text = ersetzeFunde(text, funde);
  return { text: text.slice(0, BEITRAG_MAX), hashtags, region: { ...region, text: regionText }, link, vorteile, gehalt: geld, titel };
}
