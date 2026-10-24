import type { BesetzungItem } from '@/lib/besetzungApi';

/**
 * Anzeige einer Besetzung (Etappe 2, 25.10.2026): Etikett, Schritte und Eckdaten
 * für Karte und Fenster – an einer Stelle, damit beide dasselbe sagen.
 */

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';
export interface Step { label: string; state: 'done' | 'now' | 'next' | 'bad' }
export interface Fact { label: string; value: string; tone?: Tone }

const DAY = 86_400_000;
export const todayKey = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
export const dateDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');
export const dayMonth = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '–');
export const eur = (cents: number | null | undefined) => (cents == null ? '–' : `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(cents / 100))} €`);
export const eurYear = (v: number | null | undefined) => (v == null ? '–' : `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v)} €`);
export const first = (name: string) => (name.startsWith('PR-') ? name : name.split(' ')[0]);

/** „in 38 Tagen“, „heute“, „vor 4 Tagen“ */
export function relDays(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = Math.round((Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) - Date.parse(`${todayKey()}T12:00:00Z`)) / DAY);
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d === -1) return 'gestern';
  return d > 0 ? `in ${d} Tagen` : `vor ${-d} Tagen`;
}

export function packageLabel(i: BesetzungItem): string {
  const p = i.package;
  const short = p.key === 'core' ? 'Core' : p.key === 'continuity_90' ? 'Continuity 90' : p.key === 'continuity_180' ? 'Continuity 180' : p.name;
  return `${short} · ${String(p.pct).replace('.', ',')} %${p.continuityDays ? '' : ' · ohne Continuity'}`;
}

const startOf = (i: BesetzungItem) => i.placement?.startDate ?? i.offer?.startDate ?? null;
const startPassed = (i: BesetzungItem) => !!i.placement && i.placement.state === 'agreed' && !!i.placement.startDate && i.placement.startDate <= todayKey();

/** Etikett oben rechts */
export function statusOf(i: BesetzungItem): { text: string; tone: Tone } {
  const who = first(i.name);
  if (i.group === 'angebot') {
    const o = i.offer!;
    if (o.status === 'countered') return { text: 'Gegenwunsch', tone: 'bad' };
    if (o.overdue) return { text: 'Antwortfrist abgelaufen', tone: 'bad' };
    if (o.status === 'considering') return { text: `${who} überlegt`, tone: 'warn' };
    return { text: `V${o.version} beim Headhunter`, tone: 'warn' };
  }
  if (i.group === 'start') {
    if (!i.placement) {
      const s = i.contract?.status ?? 'preparing';
      if (s === 'sent_self') return { text: `Vertrag liegt bei ${who}`, tone: 'warn' };
      if (s === 'sent_digital') return { text: 'Unterschrift läuft', tone: 'warn' };
      if (s === 'company_signed') return { text: `${who} unterschreibt`, tone: 'warn' };
      if (s === 'reported' || s === 'signed') return { text: 'Unterschrift gemeldet', tone: 'warn' };
      if (s === 'declined') return { text: 'Vertrag abgelehnt', tone: 'bad' };
      return { text: 'Vertrag noch nicht verschickt', tone: 'bad' };
    }
    if (startPassed(i)) return { text: `Start war am ${dayMonth(i.placement.startDate)}`, tone: 'warn' };
    return { text: 'unterschrieben', tone: 'good' };
  }
  if (i.group === 'haus') {
    if (i.placement?.claim && ['submitted', 'in_review'].includes(i.placement.claim.status)) return { text: 'Continuity-Fall gemeldet', tone: 'warn' };
    return i.package.continuityDays ? { text: 'Continuity läuft', tone: 'good' } : { text: 'Core', tone: 'neutral' };
  }
  if (i.placement?.nonStartReportedAt) return { text: 'nicht angetreten', tone: 'neutral' };
  if (i.placement?.departure) return { text: 'ausgeschieden', tone: 'neutral' };
  return { text: 'abgeschlossen', tone: 'neutral' };
}

/** Wer ist dran? (Aufgaben des Kunden haben Vorrang) */
export function dranOf(i: BesetzungItem, hasTask: boolean): { text: string; tone: Tone } | null {
  if (hasTask || i.dran === 'client' || startPassed(i)) return { text: 'Sie', tone: 'bad' };
  if (i.dran === 'recruiter') return { text: 'Headhunter', tone: 'neutral' };
  if (i.dran === 'candidate') return { text: first(i.name), tone: 'neutral' };
  return null;
}

export function stepsOf(i: BesetzungItem): Step[] {
  const p = i.placement;
  const start = startOf(i);
  if (i.group === 'angebot') return [{ label: `Angebot V${i.offer?.version ?? 1}`, state: 'done' }, { label: 'Antwort', state: 'now' }, { label: 'Zusage', state: 'next' }, { label: 'Vertrag', state: 'next' }];
  if (i.group === 'start' && !p) {
    const s = i.contract?.status ?? 'preparing';
    const contract: Step = s === 'sent_self' ? { label: 'Vertrag selbst verschickt', state: 'now' }
      : s === 'sent_digital' || s === 'company_signed' ? { label: 'Unterschrift läuft', state: 'now' }
        : s === 'reported' || s === 'signed' ? { label: 'Unterschrift gemeldet', state: 'now' }
          : s === 'declined' ? { label: 'Vertrag abgelehnt', state: 'bad' } : { label: 'Vertrag schicken', state: 'now' };
    return [{ label: 'Zusage', state: 'done' }, contract, { label: 'Unterschrift', state: 'next' }, { label: start ? `Start ${dateDe(start)}` : 'Start', state: 'next' }];
  }
  if (i.group === 'start') {
    const passed = startPassed(i);
    return [{ label: 'Zusage', state: 'done' }, { label: 'Unterschrieben', state: 'done' }, { label: start ? `Start ${dateDe(start)}` : 'Start noch offen', state: passed ? 'done' : 'now' }, { label: 'Antritt bestätigen', state: passed ? 'now' : 'next' }];
  }
  if (i.group === 'haus') {
    const open = p?.claim && ['submitted', 'in_review'].includes(p.claim.status);
    return [{ label: 'Unterschrieben', state: 'done' }, { label: p?.startDate ? `Angefangen ${dayMonth(p.startDate)}` : 'Angefangen', state: 'done' },
      open ? { label: 'Continuity-Fall gemeldet', state: 'now' }
        : p?.continuityEnd ? { label: `Continuity bis ${dateDe(p.continuityEnd)}`, state: 'now' } : { label: `Im Haus bis ${dateDe(p?.coreUntil)}`, state: 'now' }];
  }
  if (p?.nonStartReportedAt) return [{ label: 'Unterschrieben', state: 'done' }, { label: 'Nicht angetreten', state: 'bad' }];
  if (p?.departure) return [{ label: p.startDate ? `Angefangen ${dayMonth(p.startDate)}` : 'Angefangen', state: 'done' }, { label: `Ausgeschieden ${dateDe(p.departure.lastDay)}`, state: 'bad' }];
  return [{ label: p?.startDate ? `Angefangen ${dayMonth(p.startDate)}` : 'Angefangen', state: 'done' }, { label: i.package.continuityDays ? 'Continuity vorbei' : '6 Monate im Haus', state: 'done' }];
}

export function invoiceFact(i: BesetzungItem): Fact {
  const inv = i.invoice;
  if (!i.placement) return { label: 'Rechnung', value: 'nach der Unterschrift' };
  if (!inv || inv.status === 'draft' || !inv.number) return { label: 'Rechnung', value: 'wird von Matchunt erstellt' };
  if (inv.status === 'paid') return { label: 'Rechnung', value: `${inv.number} · bezahlt ${dateDe(inv.paidAt)}`, tone: 'good' };
  if (inv.reportedPaidOn) return { label: 'Rechnung', value: `${inv.number} · Zahlung wird geprüft` };
  return { label: 'Rechnung', value: `${inv.number} · ${eur(inv.totalCents)} · ${inv.overdue ? 'überfällig seit' : 'offen bis'} ${dateDe(inv.dueDate)}`, tone: inv.overdue ? 'bad' : 'warn' };
}

/** Eckdaten: die ersten vier stehen auf der Karte, alle im Fenster. */
export function factsOf(i: BesetzungItem): Fact[] {
  const p = i.placement;
  const start = startOf(i);
  const fee: Fact = { label: 'Honorar', value: i.feeCents == null ? '–' : `${p ? '' : 'ca. '}${eur(i.feeCents)} netto` };
  const pkg: Fact = { label: 'Paket', value: packageLabel(i) };
  if (i.group === 'angebot') {
    const o = i.offer!;
    return [
      { label: 'Angebot', value: `${eurYear(o.salary)}${o.variable ? ` + ${eurYear(o.variable)}` : ''} · Version ${o.version}` },
      { label: 'Start laut Angebot', value: dateDe(o.startDate) },
      { label: 'Antwort bis', value: dateDe(o.responseDue), tone: o.overdue ? 'bad' : undefined },
      fee, pkg,
    ];
  }
  const out: Fact[] = [];
  if (i.group === 'start') out.push({ label: 'Erster Arbeitstag', value: start ? `${dateDe(start)} · ${relDays(start)}` : 'noch offen', tone: startPassed(i) ? 'warn' : undefined });
  else if (p) out.push({ label: 'Angefangen', value: p.startDate ? `${dateDe(p.startDate)}${p.startConfirmedAt ? ' · bestätigt' : ''}` : p.startConfirmedAt ? `bestätigt am ${dateDe(p.startConfirmedAt)}` : 'ja' });
  out.push(pkg);
  if (i.group === 'haus' && p?.continuityEnd) out.push({ label: 'Continuity bis', value: `${dateDe(p.continuityEnd)} · ${relDays(p.continuityEnd)} · melden bis ${dateDe(p.reportUntil)}` });
  else if (i.group === 'haus' && p?.coreUntil) out.push({ label: 'Bleibt hier bis', value: dateDe(p.coreUntil) });
  else out.push(fee);
  out.push(invoiceFact(i));
  // nur im Fenster
  if (i.group === 'haus' || i.group === 'ab') out.push(fee);
  if (i.grossCents != null) out.push({ label: p ? 'Bruttojahresziel' : 'Gehalt laut Zusage', value: eur(i.grossCents) });
  if (p) out.push({ label: 'Bestellnummer', value: p.purchaseOrder ? `${p.purchaseOrder}${p.costCenter ? ` · Kostenstelle ${p.costCenter}` : ''}` : p.costCenter ? `– · Kostenstelle ${p.costCenter}` : '–' });
  if (i.offer?.probationMonths && start) out.push({ label: 'Probezeit (Info)', value: `${i.offer.probationMonths} Monate laut Angebot` });
  if (p?.nonStartReportedAt) out.push({ label: 'Erklärung der Person', value: p.nonStartDocument ? 'liegt vor' : 'fehlt noch', tone: p.nonStartDocument ? 'good' : 'warn' });
  if (p?.departure) out.push({ label: 'Ausgeschieden', value: `${p.departure.label ?? 'Grund angegeben'} · letzter Tag ${dateDe(p.departure.lastDay)}` });
  if (p?.claim) out.push({ label: 'Continuity-Fall', value: p.claim.status === 'accepted' ? 'anerkannt, erneute Suche läuft' : p.claim.status === 'rejected' ? 'abgelehnt' : 'Matchunt prüft' });
  return out;
}

export const INTRO: Record<string, string> = {
  angebot: 'Alle mit laufendem Angebot, bis zur Zusage.',
  start: 'Nach der Zusage bis zum ersten Arbeitstag: Vertrag, Unterschrift, Start.',
  haus: 'Seit dem ersten Arbeitstag. Mit Continuity bis zum Fristende, mit Core 6 Monate.',
  ab: 'Fertig: nach Continuity bzw. 6 Monaten, nicht angetreten oder ausgeschieden. Nur zum Nachsehen.',
};
