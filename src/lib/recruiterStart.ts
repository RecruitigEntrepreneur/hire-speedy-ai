/**
 * „Dein Start bei Matchunt“ im Headhunter-Dashboard (Entscheidung 21.09.2026).
 * Ersetzt den alten Kasten „Onboarding erforderlich“, der die Tabelle des
 * früheren Checkbox-Onboardings las. Die Schritte kommen aus echten Daten:
 * Vertrag (wer das Dashboard sieht, hat ihn), Rundgang, Firmendaten und
 * Bankverbindung im Profil.
 */
export type StartStepId = 'contract' | 'tour' | 'company' | 'bank';
export interface StartProfile { company_name?: string | null; company_address?: string | null; tax_id?: string | null; bank_iban?: string | null }
export interface StartStep { id: StartStepId; label: string; done: boolean }

/** Merker im Konto: Die 100-%-Zeile wurde ausgeblendet. */
export const START_HIDDEN_KEY = 'recruiter_start_hidden_at';

const filled = (value?: string | null) => !!value && value.trim().length > 0;

export function startSteps(profile: StartProfile, tourDone: boolean): StartStep[] {
  return [
    { id: 'contract', label: 'Vertrag', done: true },
    { id: 'tour', label: 'Rundgang', done: tourDone },
    { id: 'company', label: 'Firmendaten', done: filled(profile.company_name) && filled(profile.company_address) && filled(profile.tax_id) },
    { id: 'bank', label: 'Bankverbindung', done: filled(profile.bank_iban) },
  ];
}

export const startPercent = (steps: StartStep[]) => Math.round(steps.filter(s => s.done).length / steps.length * 100);

const withArticle: Record<StartStepId, string> = { contract: 'dein Vertrag', tour: 'der Rundgang', company: 'deine Firmendaten', bank: 'deine Bankverbindung' };

/** Ein Satz dazu, was noch fehlt und wofür. Leer, wenn alles erledigt ist. */
export function openSummary(steps: StartStep[]): string {
  const open = steps.filter(s => !s.done);
  if (!open.length) return '';
  const list = open.length === 1 ? withArticle[open[0].id] : `${open.slice(0, -1).map(s => s.label).join(', ')} und ${open[open.length - 1].label}`;
  const money = open.filter(s => s.id === 'company' || s.id === 'bank');
  const why = !money.length ? (open.length === 1 ? 'Er zeigt dir in wenigen Minuten das Wichtigste.' : '')
    : `${money.length === open.length ? 'Die' : money.length === 2 ? 'Firmendaten und Bankverbindung' : money[0].id === 'bank' ? 'Die Bankverbindung' : 'Die Firmendaten'} brauchen wir, bevor wir dir deine erste Provision überweisen.`;
  return `Noch offen: ${list}.${why ? ` ${why}` : ''}`;
}

type CompanyField = 'company_name' | 'company_address' | 'tax_id';
/** Firmendaten aus dem unterschriebenen Vertrag, nur für leere Felder. null, wenn nichts zu ergänzen ist. */
export function contractSuggestion(current: StartProfile, contract: { company?: string; address?: string; contractDetails?: { taxNumber?: string } }): Partial<Record<CompanyField, string>> | null {
  const patch: Partial<Record<CompanyField, string>> = {};
  const fill = (key: CompanyField, value?: string) => { const v = (value ?? '').trim(); if (v && !filled(current[key])) patch[key] = v; };
  fill('company_name', contract.company);
  fill('company_address', contract.address);
  fill('tax_id', contract.contractDetails?.taxNumber);
  return Object.keys(patch).length ? patch : null;
}
