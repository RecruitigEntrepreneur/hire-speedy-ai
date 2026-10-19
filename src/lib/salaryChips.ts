// Gehalt per Klick statt drei Zahlen tippen. Vorschläge nur relativ zu dem, was
// der Kandidat selbst genannt hat; nie geschätzt. Die Untergrenze einer Spanne
// wird nie automatisch zur Schmerzgrenze.

import type { DossierForm } from '@/lib/candidateDossier';
import type { RoleFamily } from '@/lib/roleFamily';

/** Unter 100k auf 1.000, bis 250k auf 5.000, darüber auf 10.000. */
export function roundSalary(n: number): number {
  const step = n < 100_000 ? 1_000 : n <= 250_000 ? 5_000 : 10_000;
  return Math.round(n / step) * step;
}

export const kLabel = (n: number) => `${Math.round(n / 1000)}k`;

export interface SalaryChip { value: number; label: string }

/** Wunschgehalt: aktuelles Gehalt +10/+15/+20 % (Geschäftsführung +5/+10/+15 %). */
export function wishChips(current: number | null, family: RoleFamily): SalaryChip[] {
  if (!current || current < 15_000) return [];
  const steps = family === 'clevel' ? [0.05, 0.1, 0.15] : [0.1, 0.15, 0.2];
  const out: SalaryChip[] = [];
  for (const s of steps) {
    const v = roundSalary(current * (1 + s));
    if (v <= current || out.some((c) => c.value === v)) continue;
    out.push({ value: v, label: `${kLabel(v)} (+${Math.round(((v - current) / current) * 100)} %)` });
  }
  return out;
}

/** Schmerzgrenze: Wunsch −5 %, Wunsch −10 %, wie heute. */
export function minimumChips(wish: number | null, current: number | null): SalaryChip[] {
  const out: SalaryChip[] = [];
  const add = (v: number, label: string) => { if (v > 0 && !out.some((c) => c.value === v)) out.push({ value: v, label }); };
  if (wish) {
    add(roundSalary(wish * 0.95), `${kLabel(roundSalary(wish * 0.95))} (−5 %)`);
    add(roundSalary(wish * 0.9), `${kLabel(roundSalary(wish * 0.9))} (−10 %)`);
  }
  if (current) add(current, `${kLabel(current)} (wie heute)`);
  return out;
}

/** Hinweise nur bei Unstimmigem, z. B. Monatsgehalt statt Jahresgehalt. */
export function salaryWarnings(f: Pick<DossierForm, 'current_salary' | 'expected_salary' | 'salary_minimum'>): string[] {
  const out: string[] = [];
  const { current_salary: cur, expected_salary: wish, salary_minimum: min } = f;
  const monthly = [cur, wish, min].some((v) => v != null && v >= 1_500 && v < 15_000);
  if (monthly) out.push('Sieht nach Monatsgehalt aus. Bitte als Jahresgehalt eintragen (×12 oder ×13).');
  if (cur && wish && wish < cur) out.push('Wunschgehalt liegt unter dem heutigen Gehalt. Gewollt?');
  if (wish && min && min > wish) out.push('Schmerzgrenze liegt über dem Wunschgehalt. Vertauscht?');
  if (cur && wish && wish > cur * 1.4) out.push('Mehr als 40 % über heute. Fix und Gesamt vermischt?');
  return out;
}
