// Einreichungsweg „Vorstellen“ (09.11.2026): reine Helfer, ohne React, damit testbar.
//
// Ein Fenster, ein Ablauf, egal ob vom Profil oder von der Stelle:
//   Auswahl → (Kundenfrage, nur beim ersten Mal) → Passung → Kundenansicht → Abschicken → Fertig.
// Rechtliche Leitplanke bleibt (DSGVO Art. 22, EU AI Act): Abweichungen sperren nie,
// gesperrt wird nur, was wirklich fehlt (Interview, Lebenslauf, Einwilligung).

import i18n from '@/i18n';
import { languageDef } from '@/i18n/languages';
import { earliestStart, formatEuro, type DossierForm } from '@/lib/candidateDossier';
import { term } from '@/lib/candidateTerms';
import { effectiveJobModel, type FitItem, type FitJob } from '@/lib/fitCheck';
import { candidateLanguage, fmtDate, tFor } from '@/lib/localeFormat';
import type { MatchRequirementRow } from '@/lib/matchV41';

// Texte im Namespace recruiterVorstellen, beim Aufruf gelesen (nie als Konstante auf Modulebene).
const NS = 'recruiterVorstellen';
const tr = (key: string, options?: Record<string, unknown>) => i18n.t(`${NS}:lib.${key}`, options) as string;
/** Texte des Passungs-Checks (recruiterJobs:fitCheck), um dessen Meldungen sprachunabhängig zu erkennen. */
const fitText = (key: string) => i18n.t(`recruiterJobs:fitCheck.${key}`) as string;
/** Nachricht an den Kandidaten: in der Sprache des Headhunters, wie der Rahmen beim Versand. */
const tMail = (key: string, options?: Record<string, unknown>) => tFor(candidateLanguage(), NS)(`mail.${key}`, options) as string;

/** Vorname für Titel und Knöpfe. Testkandidaten heißen „Test Lena Hoffmann“: dann „Lena“. */
export function vorname(fullName: string | null | undefined): string {
  const teile = String(fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return tr('candidateFallback');
  if (teile[0].toLowerCase() === 'test' && teile.length > 1) return teile[1];
  return teile[0];
}

/** Genitiv für „Lenas Sperrliste“ / „Jonas’ Sperrliste“, je Sprache der Oberfläche. */
export function genitiv(name: string): string {
  switch (languageDef(i18n.language).base) {
    case 'en': return /s$/i.test(name) ? `${name}’` : `${name}’s`;
    case 'sv': return /[sxz]$/i.test(name) ? name : `${name}s`;
    case 'nb': return /[sxz]$/i.test(name) ? `${name}'` : `${name}s`;
    default: return /[sßxz]$/i.test(name) ? `${name}’` : `${name}s`;
  }
}

export type ZeilenStatus = 'passt' | 'weicht' | 'info';

export interface PassungsZeile {
  key: string;
  label: string;
  kandidat: string;
  stelle: string;
  status: ZeilenStatus;
  /** Kurz rechts in der Zeile, z. B. „passt“, „über Budget“, „nicht belegt“ */
  urteil: string;
  /** Ganzer Satz für den Tooltip */
  satz?: string;
  /** Harte Warnung, die per Klick bestätigt werden muss (fitCheck „warn“) */
  bestaetigen?: boolean;
}

// Gespeicherte Auswahlwerte (Schlüssel) → Anzeige in der Sprache der Oberfläche
const WORK_KEYS = new Set(['onsite', 'hybrid', 'remote', 'flexible']);
const PERMIT_KEYS = new Set(['citizen', 'permit', 'needs_visa', 'pending']);
const workText = (v: string) => (WORK_KEYS.has(v) ? tr(`work.${v}`) : v);
const permitText = (v: string) => (PERMIT_KEYS.has(v) ? tr(`permit.${v}`) : v);

const budgetText = (job: FitJob) =>
  job.salary_max
    ? job.salary_min ? `${Math.round(job.salary_min / 1000)}–${Math.round(job.salary_max / 1000)}k` : tr('budgetUpTo', { k: Math.round(job.salary_max / 1000) })
    : tr('noBudget');

function stelleArbeit(job: FitJob): string {
  const m = effectiveJobModel(job);
  if (m === 'onsite') return job.onsite_days_required ? tr('onsiteDays', { count: job.onsite_days_required }) : tr('work.onsite');
  if (m === 'hybrid') return job.onsite_days_required ? tr('hybridDays', { count: job.onsite_days_required }) : tr('work.hybrid');
  if (m === 'remote') return tr('work.remote');
  return tr('open');
}

function kurzUrteil(i: FitItem, f: DossierForm): string {
  if (i.status === 'ok') return i.message === fitText('location.relocation') ? tr('verdict.relocation') : tr('verdict.fits');
  switch (i.key) {
    case 'gehalt':
      // Die Schmerzgrenze: Meldung mit Beträgen; ihr fester deutscher Wortlaut steht in `stored`.
      if ((i.stored ?? i.message).startsWith('Die Schmerzgrenze')) return tr('verdict.painOverBudget');
      if (i.message === fitText('salary.wishOverBudget') || i.message === fitText('salary.wishOverBudgetUnknown')) return tr('verdict.overBudget');
      if (i.message === fitText('salary.wishFarBelow')) return tr('verdict.farBelow');
      return tr('open');
    case 'arbeitsmodell': return i.status === 'warn' ? tr('verdict.remoteOnly') : f.remote_preference ? tr('verdict.differs') : tr('open');
    case 'ort': return f.city.trim() ? tr('verdict.otherPlace') : tr('open');
    case 'sprachen': return tr('verdict.missing');
    case 'arbeitserlaubnis': return f.work_permit === 'needs_visa' ? tr('verdict.visaNeeded') : tr('open');
    default: return tr('verdict.check');
  }
}

const MUSS_STATUS: Record<MatchRequirementRow['status'], ZeilenStatus> = {
  met: 'passt',
  partial: 'weicht',
  not_met: 'weicht',
  unknown: 'weicht',
};
const mussUrteil = (s: MatchRequirementRow['status']) => ({ urteil: tr(`must.${s}`), status: MUSS_STATUS[s] });

/**
 * Zeilen „Kandidat gegen Stelle“: Muss-Kriterien aus dem Matching (mit Beleg),
 * dazu Gehalt, Büro, Ort, Sprachen, Erlaubnis aus dem Passungs-Check und der Start.
 */
export function passungsZeilen(f: DossierForm, job: FitJob, fitItems: FitItem[], musts: MatchRequirementRow[], heute: Date = new Date(), mussTexte: string[] = []): PassungsZeile[] {
  // Hat das Matching die Muss-Kriterien nicht ausgewertet, stehen sie trotzdem da: selbst prüfen.
  const ungeprueft: PassungsZeile[] = musts.length ? [] : mussTexte.map((t, i) => ({
    key: `muss-text:${i}`, label: tr('label.must'), kandidat: tr('notAutoChecked'), stelle: t, status: 'info', urteil: tr('checkYourself'),
  }));
  const zeilen: PassungsZeile[] = [...ungeprueft, ...musts.map((m) => ({
    key: `muss:${m.id}`,
    label: tr('label.must'),
    kandidat: m.evidence?.trim() || (m.status === 'not_met' ? tr('noEvidence') : '—'),
    stelle: m.text,
    ...mussUrteil(m.status),
    satz: m.note || undefined,
  }))];
  const item = (key: string) => fitItems.find((i) => i.key === key);
  const add = (key: string, label: string, kandidat: string, stelle: string) => {
    const i = item(key);
    if (!i) return;
    zeilen.push({ key, label, kandidat, stelle, status: i.status === 'ok' ? 'passt' : 'weicht', urteil: kurzUrteil(i, f), satz: i.message, bestaetigen: i.status === 'warn' });
  };
  add('gehalt', tr('label.salary'), f.expected_salary ? formatEuro(f.expected_salary) : tr('open'), budgetText(job));
  add('arbeitsmodell', tr('label.office'), f.remote_preference ? workText(f.remote_preference) : tr('open'), stelleArbeit(job));
  add('ort', tr('label.place'), [f.city.trim() || tr('open'), f.relocation_willing ? tr('relocationWilling') : ''].filter(Boolean).join(', '), job.location || tr('open'));
  const pflichtSprachen = (Array.isArray(job.required_languages) ? job.required_languages : [])
    .map((v) => (typeof v === 'string' ? v : (v as { language?: string } | null)?.language ?? ''))
    .filter(Boolean);
  add('sprachen', tr('label.languages'), f.languages.map((l) => (l.proficiency ? `${term(l.language)} ${term(l.proficiency)}` : term(l.language))).join(', ') || tr('noLanguages'), pflichtSprachen.map(term).join(', '));
  const permit = item('arbeitserlaubnis');
  if (permit && permit.status !== 'ok') add('arbeitserlaubnis', tr('label.permit'), f.work_permit ? permitText(f.work_permit) : tr('open'), '');
  const start = f.availability_date ?? (f.notice_period && f.notice_period !== 'immediate' ? earliestStart(f.notice_period, heute) : null);
  zeilen.push({
    key: 'start',
    label: tr('label.start'),
    kandidat: f.notice_period === 'immediate' ? tr('immediately') : start ? tr('from', { date: fmtDate(start) }) : tr('open'),
    stelle: '',
    status: 'info',
    urteil: '',
  });
  return zeilen;
}

export function passungsZahl(zeilen: PassungsZeile[]): { passt: number; gesamt: number } {
  const bewertet = zeilen.filter((z) => z.status !== 'info');
  return { passt: bewertet.filter((z) => z.status === 'passt').length, gesamt: bewertet.length };
}

/**
 * Text für „Kandidaten Bescheid geben“, ohne Firmennamen (der Kunde ist noch verdeckt).
 * Nachricht an den Kandidaten nach dem Vorstellen (12.11.2026, Marko: „wie von einem Headhunter zu
 * seinem Kandidaten“). Nur der Mittelteil; „Hallo …“, Gruß und Unterschrift setzt der Versand.
 * Kein „ich sage dir Bescheid“: Die Interview-Einladung des Unternehmens kommt von selbst.
 */
export function bescheidText(jobTitle: string, ort: string | null): string {
  return [
    ort ? tMail('body1Place', { job: jobTitle, place: ort }) : tMail('body1', { job: jobTitle }),
    tMail('body2'),
    tMail('body3'),
  ].join('\n\n');
}

/** Betreff dieser Nachricht. */
export const bescheidBetreff = (jobTitle: string) => tMail('subject', { job: jobTitle });
