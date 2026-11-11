import type { BesetzungItem } from '@/lib/besetzungApi';

/**
 * Anzeige einer Besetzung (Etappe 2, 25.10.2026; Umbau Nachbesetzung 11.11.2026): Etikett,
 * Schritte, Eckdaten, Knöpfe je Phase (K4) und der Stand der Nachbesetzung (K6, J2/J3) –
 * an einer Stelle, damit Karte und Fenster dasselbe sagen. Reine Funktionen (getestet in
 * src/lib/besetzungView.test.ts).
 */

export type Tone = 'good' | 'warn' | 'bad' | 'neutral';
export interface Step { label: string; state: 'done' | 'now' | 'next' | 'bad' }
/** action: Link hinter dem Wert (z. B. „ergänzen“ bei der Bestellnummer) */
export interface Fact { label: string; value: string; tone?: Tone; action?: 'po' }

const DAY = 86_400_000;
export const todayKey = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
export const dateDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '–');
export const dayMonth = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : '–');
export const eur = (cents: number | null | undefined) => (cents == null ? '–' : `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(Math.round(cents / 100))} €`);
export const eurExact = (cents: number | null | undefined) => (cents == null ? '–' : `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} €`);
export const eurYear = (v: number | null | undefined) => (v == null ? '–' : `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(v)} €`);
export const first = (name: string) => (name.startsWith('PR-') ? name : name.split(' ')[0]);
/** „Cems“, „Max’“ */
export const genitive = (n: string) => (/[sßxz]$/i.test(n) ? `${n}’` : `${n}s`);

/** „in 38 Tagen“, „heute“, „vor 4 Tagen“ */
export function relDays(iso: string | null | undefined, today = todayKey()): string {
  if (!iso) return '';
  const d = Math.round((Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
  if (d === 0) return 'heute';
  if (d === 1) return 'morgen';
  if (d === -1) return 'gestern';
  return d > 0 ? `in ${d} Tagen` : `vor ${-d} Tagen`;
}

/** Kopfzeile: „Mira Stein · Nachbesetzung für Cem“ bei einer Ersatzbesetzung. */
export function titleOf(item: BesetzungItem): string {
  return item.placement?.replaces ? `${item.name} · Nachbesetzung für ${first(item.placement.replaces.name)}` : item.name;
}

export function packageLabel(i: BesetzungItem): string {
  const p = i.package;
  if (p.replacement) return 'Nachbesetzung · kein neues Honorar';
  const short = p.key === 'core' ? 'Core' : p.key === 'continuity_90' ? 'Continuity 90' : p.key === 'continuity_180' ? 'Continuity 180' : p.name;
  return `${short} · ${String(p.pct).replace('.', ',')} %`;
}

const startOf = (i: BesetzungItem) => i.placement?.startDate ?? i.offer?.startDate ?? null;
const startPassed = (i: BesetzungItem, today = todayKey()) => !!i.placement && i.placement.state === 'agreed' && !i.placement.startFixedAt && !i.placement.end && !!i.placement.startDate && i.placement.startDate <= today;
const RESEARCH_ACTIVE = ['awaiting_position', 'awaiting_payment', 'running', 'paused'];
const researchActive = (i: BesetzungItem) => RESEARCH_ACTIVE.includes(String(i.placement?.research?.state ?? ''));

/** Etikett oben rechts */
export function statusOf(i: BesetzungItem, today = todayKey()): { text: string; tone: Tone } {
  const who = first(i.name);
  const p = i.placement;
  if (i.group === 'angebot') {
    const o = i.offer!;
    if (o.status === 'countered') return { text: 'Gegenwunsch', tone: 'bad' };
    if (o.overdue) return { text: 'Antwortfrist abgelaufen', tone: 'bad' };
    if (o.status === 'considering') return { text: `${who} überlegt`, tone: 'warn' };
    if (o.status === 'accept_reported') return { text: `${who} bestätigt die Zusage`, tone: 'warn' };
    return { text: `V${o.version} beim Headhunter`, tone: 'warn' };
  }
  if (p?.research) {
    const r = p.research;
    if (r.state === 'running') return { text: 'Nachbesetzung läuft', tone: 'neutral' };
    if (r.state === 'paused') return { text: 'Nachbesetzung ruht', tone: 'neutral' };
    if (r.state === 'awaiting_position') return { text: 'Position bestätigen', tone: 'warn' };
    if (r.state === 'awaiting_payment') return { text: 'Nachbesetzung startet nach Zahlung', tone: 'neutral' };
    if (r.state === 'succeeded') return { text: 'Ersatz gefunden', tone: 'neutral' };
  }
  if (p?.offer?.status === 'open') return { text: 'Angebot von Matchunt', tone: 'warn' };
  if (p?.end) {
    if (p.claim && ['submitted', 'in_review'].includes(p.claim.status)) return { text: 'Matchunt prüft', tone: 'neutral' };
    return { text: p.end.kind === 'non_start' ? 'nicht angefangen' : 'beendet', tone: 'neutral' };
  }
  if (p?.replaces && i.group !== 'ab') return { text: 'Nachbesetzung', tone: 'neutral' };
  if (i.group === 'start') {
    if (!p) {
      const s = i.contract?.status ?? 'preparing';
      if (s === 'sent_self') return { text: `Vertrag liegt bei ${who}`, tone: 'warn' };
      if (s === 'sent_digital') return { text: 'Unterschrift läuft', tone: 'warn' };
      if (s === 'company_signed') return { text: `${who} unterschreibt`, tone: 'warn' };
      if (s === 'reported' || s === 'signed') return { text: 'Unterschrift gemeldet', tone: 'warn' };
      if (s === 'declined') return { text: 'Vertrag abgelehnt', tone: 'bad' };
      return { text: 'Vertrag noch nicht verschickt', tone: 'bad' };
    }
    if (p.startReport?.kind === 'started' && !p.startReport.contestedAt) return { text: 'Start bestätigen', tone: 'warn' };
    if (startPassed(i, today)) return { text: `Start war am ${dayMonth(p.startDate)}`, tone: 'warn' };
    return { text: 'unterschrieben', tone: 'good' };
  }
  if (i.group === 'haus') {
    return i.package.continuityDays ? { text: 'Nachbesetzung möglich', tone: 'good' } : { text: 'Core', tone: 'neutral' };
  }
  return { text: 'abgeschlossen', tone: 'neutral' };
}

/** Wer ist dran? (Aufgaben des Kunden haben Vorrang) */
export function dranOf(i: BesetzungItem, hasTask: boolean, today = todayKey()): { text: string; tone: Tone } | null {
  if (hasTask || i.dran === 'client' || startPassed(i, today)) return { text: 'Sie', tone: 'bad' };
  if (i.dran === 'recruiter') return { text: 'Headhunter', tone: 'neutral' };
  if (i.dran === 'candidate') return { text: first(i.name), tone: 'neutral' };
  return null;
}

export function stepsOf(i: BesetzungItem, today = todayKey()): Step[] {
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
  const started = !!p?.startFixedAt || ['started', 'ended_early', 'completed'].includes(String(p?.state)) || !!p?.startConfirmedAt;
  const signed: Step = { label: 'Unterschrieben', state: 'done' };
  const begun: Step = { label: p?.startDate ? `Angefangen ${dayMonth(p.startDate)}` : 'Angefangen', state: 'done' };
  if (p?.end) {
    const ended: Step = { label: p.end.kind === 'non_start' ? 'Nicht angefangen' : `Endet${p.end.lastDay ? ` ${dayMonth(p.end.lastDay)}` : ''}`, state: 'done' };
    const tail: Step = p.research?.state === 'succeeded' ? { label: 'Ersatz gefunden', state: 'done' }
      : p.research?.state === 'running' || p.research?.state === 'paused' ? { label: 'Nachbesetzung läuft', state: 'now' }
        : researchActive(i) ? { label: 'Nachbesetzung vorbereiten', state: 'now' }
          : p.claim && ['submitted', 'in_review'].includes(p.claim.status) ? { label: 'Matchunt prüft', state: 'now' }
            : p.offer?.status === 'open' ? { label: 'Angebot von Matchunt', state: 'now' }
              : { label: 'Gemeldet', state: 'done' };
    return p.end.kind === 'non_start' ? [signed, ended, tail] : [signed, begun, ended, tail];
  }
  if (i.group === 'start') {
    const passed = startPassed(i, today);
    return [{ label: 'Zusage', state: 'done' }, signed, { label: start ? `Start ${dateDe(start)}` : 'Start noch offen', state: passed ? 'done' : 'now' }, { label: 'Antritt bestätigen', state: passed ? 'now' : 'next' }];
  }
  if (i.group === 'haus') {
    return [signed, begun,
      p?.continuityEnd ? { label: `Nachbesetzung möglich bis ${dateDe(p.continuityEnd)}`, state: 'now' } : { label: `Im Haus bis ${dateDe(p?.coreUntil)}`, state: 'now' }];
  }
  if (!started) return [signed, { label: 'Abgeschlossen', state: 'done' }];
  return [begun, { label: i.package.continuityDays ? 'Nachbesetzung vorbei' : '6 Monate im Haus', state: 'done' }];
}

export function invoiceFact(i: BesetzungItem): Fact {
  const inv = i.invoice;
  if (!i.placement) return { label: 'Rechnung', value: 'nach der Unterschrift' };
  if (i.package.replacement && !inv) return { label: 'Rechnung', value: 'keine neue Rechnung' };
  if (!inv || inv.status === 'draft' || !inv.number) return { label: 'Rechnung', value: 'wird von Matchunt erstellt' };
  if (inv.status === 'paid') return { label: 'Rechnung', value: `${inv.number} · bezahlt ${dayMonth(inv.paidAt)}` };
  if (inv.reportedPaidOn) return { label: 'Rechnung', value: `${inv.number} · Zahlung wird geprüft` };
  const open = inv.openCents ?? inv.totalCents;
  if (inv.overdue) return { label: 'Rechnung', value: `${inv.number} · ${eur(open)} offen · überfällig seit ${dayMonth(inv.dueDate)}`, tone: 'bad' };
  return { label: 'Rechnung', value: `${inv.number} · ${eur(open)} · fällig ${dateDe(inv.dueDate)}` };
}

/** Eckdaten: die ersten vier stehen auf der Karte, alle im Fenster. */
export function factsOf(i: BesetzungItem, today = todayKey()): Fact[] {
  const p = i.placement;
  const start = startOf(i);
  const fee: Fact = { label: 'Honorar', value: i.package.replacement ? (i.feeCents ? `${eur(i.feeCents)} netto (höheres Gehalt)` : 'kein neues Honorar') : i.feeCents == null ? '–' : `${p ? '' : 'ca. '}${eur(i.feeCents)} netto` };
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
  const started = !!p?.startFixedAt || ['started', 'ended_early', 'completed'].includes(String(p?.state)) || !!p?.startConfirmedAt;
  if (p?.end) out.push({ label: p.end.kind === 'non_start' ? 'Nicht angefangen' : 'Endet', value: `${p.end.label}${p.end.lastDay ? ` · letzter Tag ${dateDe(p.end.lastDay)}` : ''}` });
  if (i.group === 'start' && !p?.end) out.push({ label: 'Erster Arbeitstag', value: start ? `${dateDe(start)} · ${relDays(start, today)}` : 'noch offen', tone: startPassed(i, today) ? 'warn' : undefined });
  else if (p && started) out.push({ label: 'Angefangen', value: p.startDate ? `${dateDe(p.startDate)}${p.startFixedAt || p.startConfirmedAt ? ' · bestätigt' : ''}` : 'ja' });
  out.push(pkg);
  if (p?.replaces) out.push({ label: 'Nachbesetzung für', value: p.replaces.name });
  if (i.group === 'haus' && p?.continuityEnd && !p.end) out.push({ label: 'Nachbesetzung möglich bis', value: `${dateDe(p.continuityEnd)} · melden bis ${dayMonth(p.reportUntil)}` });
  else if (i.group === 'haus' && p?.coreUntil && !p.end) out.push({ label: 'Bleibt hier bis', value: dateDe(p.coreUntil) });
  else out.push(fee);
  out.push(invoiceFact(i));
  // nur im Fenster
  if (i.group === 'haus' && !p?.end) out.push(fee);
  if (i.grossCents != null) out.push({ label: p ? 'Bruttojahresziel' : 'Gehalt laut Zusage', value: eur(i.grossCents) });
  if (p) {
    const value = p.purchaseOrder ? `${p.purchaseOrder}${p.costCenter ? ` · Kostenstelle ${p.costCenter}` : ''}` : p.costCenter ? `– · Kostenstelle ${p.costCenter}` : '–';
    out.push({ label: 'Bestellnummer', value, action: i.can?.purchaseOrder ? 'po' : undefined });
  }
  if (i.offer?.probationMonths && start && !p?.end) out.push({ label: 'Probezeit (Info)', value: `${i.offer.probationMonths} Monate laut Angebot` });
  return out;
}

export const INTRO: Record<string, string> = {
  angebot: 'Alle mit laufendem Angebot, bis zur Zusage.',
  start: 'Nach der Zusage bis zum ersten Arbeitstag: Vertrag, Unterschrift, Start.',
  haus: 'Seit dem ersten Arbeitstag. Mit Continuity, solange eine Nachbesetzung möglich ist, mit Core 6 Monate.',
  ab: 'Fertig: nach der Nachbesetzungs-Frist bzw. 6 Monaten oder beendet. Nur zum Nachsehen.',
};

// ---------------------------------------------------------------------------
// Knöpfe je Phase (K4)
// ---------------------------------------------------------------------------

export type ActionKey =
  | 'contract' | 'startCheck' | 'startConfirm' | 'endConfirm' | 'moveStart' | 'endReport'
  | 'contractPdf' | 'invoice' | 'researchInvoice' | 'profile' | 'endDocument';

/** Knöpfe unter „Aktionen“ in der Reihenfolge des Wireframes K4; der erste ist der Hauptknopf, wo es einen gibt. */
export function actionsOf(i: BesetzungItem): ActionKey[] {
  const p = i.placement;
  const c = i.can;
  const pdf = i.contract?.status === 'final';
  const inv = !!i.invoice?.number && i.invoice.status !== 'draft';
  const tail: ActionKey[] = [...(pdf ? ['contractPdf' as const] : []), ...(inv ? ['invoice' as const] : [])];
  if (i.group === 'angebot') return [];
  if (!p) return [...(i.group === 'start' ? ['contract' as const] : []), 'profile'];
  // Erster Tag da, Antritt offen
  if (c?.answerStart) return ['startConfirm', ...tail];
  if (c?.confirmEnd) return ['endConfirm', ...tail];
  if (c?.startCheck) return ['startCheck', ...tail];
  // Unterschrieben, vor dem Start
  if (c?.moveStart) return ['moveStart', ...(c.endReport ? ['endReport' as const] : []), ...tail, 'profile'];
  // Gemeldet: Fahrplan der Nachbesetzung (K6) mit eigenem Hauptknopf, hier der Rest
  if (p.end) {
    const research: ActionKey[] = p.researchInvoice?.number && p.researchInvoice.status !== 'draft' ? ['researchInvoice'] : [];
    return [...(c?.endDocument && p.end.documents === 0 ? ['endDocument' as const] : []), ...tail, ...research, 'profile'];
  }
  // Im Haus, Garantie läuft
  if (c?.endReport) return ['endReport', ...tail, 'profile'];
  // Garantie vorbei
  return [...tail, 'profile'];
}

// ---------------------------------------------------------------------------
// Stand der Nachbesetzung im Fenster (K6, J2, J3)
// ---------------------------------------------------------------------------

export interface PanelRow { text: string; date?: string | null; state: 'done' | 'now' | 'next' }
export type PanelVariant =
  | 'review' | 'position' | 'payment' | 'running' | 'found' | 'ended'
  | 'offer' | 'core' | 'sphere' | 'rejected' | 'late' | 'outside';
export interface ResearchPanel {
  variant: PanelVariant;
  /** Überschrift, z. B. „Tessa hat nicht angefangen“ */
  title: string | null;
  rows: PanelRow[];
  /** Sätze darunter (der erste ist der Hauptsatz, wo es keine Zeilen gibt) */
  lines: string[];
}

const SPHERE_WHY: Record<string, string> = {
  position_changed: 'die Stelle wegfällt oder umgebaut wird',
  offer_withdrawn: 'Sie das Angebot zurückgezogen haben',
};

/** Was nach der Meldung „Besetzung endet“ im Fenster steht; null = keine Meldung, keine Nachbesetzung. */
export function researchPanel(i: BesetzungItem): ResearchPanel | null {
  const p = i.placement;
  if (!p || (!p.end && !p.research)) return null;
  const who = first(i.name);
  const r = p.research;
  const claim = p.claim;
  const offer = p.offer;
  const continuity = !!i.package.continuityDays;
  const nonStartTitle = p.end?.kind === 'non_start' ? `${who} hat nicht angefangen` : null;

  if (r?.state === 'succeeded') {
    const rep = r.replacement;
    return {
      variant: 'found', title: null,
      rows: [
        { text: 'Für alle Headhunter ausgeschrieben', date: r.startedAt, state: 'done' },
        { text: `Ersatz gefunden${rep ? `: ${rep.name}` : ''}`, date: r.endedAt, state: 'done' },
      ],
      lines: [rep ? `Neue Karte „${first(rep.name)} · Nachbesetzung für ${who}“. Keine neue Rechnung, außer das Gehalt ist höher.` : 'Keine neue Rechnung, außer das Gehalt ist höher.'],
    };
  }
  if (r?.state === 'cancelled' || r?.state === 'exhausted') {
    return {
      variant: 'ended', title: nonStartTitle,
      rows: r.startedAt ? [{ text: 'Für alle Headhunter ausgeschrieben', date: r.startedAt, state: 'done' }, { text: 'Nachbesetzung beendet', date: r.endedAt, state: 'done' }] : [],
      lines: [r.endReason === 'client_ended' ? 'Sie haben die Nachbesetzung beendet. Die Stelle ist für die Headhunter geschlossen.' : 'Matchunt hat die Nachbesetzung beendet.'],
    };
  }
  if (r?.state === 'running' || r?.state === 'paused') {
    const days = r.days ?? 0;
    const subs = r.fresh > 0 ? `${r.fresh} neue ${r.fresh === 1 ? 'Vorstellung' : 'Vorstellungen'}` : r.submissions > 0 ? `${r.submissions} ${r.submissions === 1 ? 'Vorstellung' : 'Vorstellungen'}` : 'noch keine Vorstellung';
    return {
      variant: 'running', title: nonStartTitle,
      rows: [
        { text: 'Für alle Headhunter ausgeschrieben', date: r.startedAt, state: 'done' },
        { text: r.paused ? 'Nachbesetzung ruht' : (days === 0 ? 'Nachbesetzung läuft seit heute' : `Nachbesetzung läuft seit ${days} ${days === 1 ? 'Tag' : 'Tagen'}`), state: 'now' },
      ],
      lines: [
        `${r.recruiters} ${r.recruiters === 1 ? 'Headhunter sucht' : 'Headhunter suchen'} · ${subs}`,
        ...(r.paused ? ['Wir haben die Suche angehalten, bis Sie die offenen Rückmeldungen gegeben haben. Danach geht es sofort weiter.'] : []),
      ],
    };
  }
  if (r?.state === 'awaiting_payment') {
    const inv = r.kind === 'joker' ? p.researchInvoice : i.invoice;
    const rows: PanelRow[] = r.kind === 'joker'
      ? [{ text: 'Angebot angenommen', date: offer?.answeredAt ?? null, state: 'done' }]
      : [{ text: 'Matchunt hat geprüft', date: claim?.decidedAt ?? null, state: 'done' }, { text: 'Position bestätigt', state: 'done' }];
    rows.push({ text: 'Rechnung bezahlen, dann startet die Suche', date: inv?.dueDate && inv.status !== 'paid' ? inv.dueDate : null, state: 'now' });
    rows.push({ text: 'Nachbesetzung läuft, bis die Stelle besetzt ist', state: 'next' });
    return { variant: 'payment', title: nonStartTitle, rows, lines: [] };
  }
  if (r?.state === 'awaiting_position') {
    const paid = i.invoice?.status === 'paid';
    return {
      variant: 'position', title: nonStartTitle,
      rows: [
        { text: 'Matchunt hat geprüft', date: claim?.decidedAt ?? null, state: 'done' },
        paid ? { text: 'Rechnung bezahlt', date: i.invoice?.paidAt ?? null, state: 'done' } : { text: 'Rechnung bezahlen, dann startet die Suche', state: 'next' },
        { text: 'Position bestätigen', state: 'now' },
      ],
      lines: ['Bestätigen Sie die Stelle so, wie sie ist, oder passen Sie sie vorher an.', 'Liegt das Gehalt höher, berechnen wir nur den Unterschied.'],
    };
  }
  if (offer?.status === 'open') {
    const price = eurExact(offer.priceCents);
    return {
      variant: 'offer', title: nonStartTitle ?? `${who}: unser Angebot`, rows: [],
      lines: [
        'Wir bieten Ihnen eine Nachbesetzung an',
        `Wir schreiben die Stelle neu für alle Headhunter aus, bis sie besetzt ist. Sie zahlen dafür einmalig ${price.replace(',00 €', ' €')} netto, kein neues Honorar.`,
        ...(offer.validUntil ? [`Angebot gültig bis ${dateDe(offer.validUntil)}`] : []),
      ],
    };
  }
  const end = p.end;
  if (!end) return null;
  const openCase = !!claim && ['submitted', 'in_review'].includes(claim.status);
  const sphere = end.outcome === 'client_sphere' || !!claim?.clientSphere;
  if (sphere && continuity) {
    return {
      variant: 'sphere', title: nonStartTitle, rows: [],
      lines: ['Gemeldet, danke.', `Eine Nachbesetzung ist hier nicht vorgesehen, weil ${SPHERE_WHY[String(end.reason)] ?? 'der Grund auf Ihrer Seite liegt'} (Rahmenvertrag § 9 Abs. 4).`],
    };
  }
  const corePending = end.kind === 'non_start' && !continuity && !i.package.replacement && !offer && p.state !== 'cancelled' && !sphere;
  if (openCase || corePending) {
    return {
      variant: 'review', title: nonStartTitle,
      rows: [
        { text: 'Gemeldet', date: end.reportedAt, state: 'done' },
        { text: `Matchunt prüft Ihre Meldung${(claim?.reviewUntil ?? end.reviewUntil) ? ` bis ${dayMonth(claim?.reviewUntil ?? end.reviewUntil)}` : ''}`, state: 'now' },
      ],
      lines: ['Für Sie ist nichts zu tun.'],
    };
  }
  if (claim?.status === 'rejected') {
    return {
      variant: 'rejected', title: nonStartTitle, rows: [],
      lines: ['Gemeldet, danke.', `Matchunt kann die Meldung nicht als Nachbesetzung anerkennen${claim.rejectionReason ? `: ${claim.rejectionReason}` : '.'}`],
    };
  }
  if (continuity && end.outcome === 'late') {
    return { variant: 'late', title: nonStartTitle, rows: [], lines: ['Gemeldet, danke.', 'Die Meldefrist von 14 Tagen war schon abgelaufen. Eine Nachbesetzung ist deshalb nicht mehr möglich.'] };
  }
  if (continuity && end.outcome === 'outside') {
    return { variant: 'outside', title: nonStartTitle, rows: [], lines: ['Gemeldet, danke.', 'Das Ende liegt nach dem Zeitraum der Nachbesetzung.'] };
  }
  // Variante Core (auch: Angebot abgelehnt oder abgelaufen)
  return {
    variant: 'core', title: nonStartTitle, rows: [],
    lines: ['Gemeldet, danke.', i.can?.reopenJob ? 'Möchten Sie die Stelle wieder öffnen?' : ['published', 'paused'].includes(String(p.jobStatus)) ? 'Ihre Stelle ist weiter für die Headhunter offen.' : ''].filter(Boolean),
  };
}

/** K5: Gründe je nachdem, ob die Person schon angefangen hat (wie nachbesetzung.ts). */
export function endReasons(started: boolean, who: string): { key: string; label: string }[] {
  return started
    ? [
      { key: 'candidate_resigned', label: `${who} hat selbst gekündigt` },
      { key: 'performance_conduct', label: 'Wir trennen uns wegen Leistung oder Verhalten' },
      { key: 'mutual_on_request', label: `Aufhebung auf Wunsch von ${who}` },
      { key: 'position_changed', label: 'Stelle fällt weg oder wird umgebaut' },
      { key: 'other', label: 'Etwas anderes' },
    ]
    : [
      { key: 'declined_before_start', label: `${who} hat vor dem Start abgesagt` },
      { key: 'no_show', label: `${who} ist nicht erschienen` },
      { key: 'offer_withdrawn', label: 'Wir haben das Angebot zurückgezogen' },
    ];
}

/** Satz nach dem Melden (K5). */
export function endDoneText(outcome: string, kind: 'non_start' | 'departure', reviewUntil: string | null, reason: string): string {
  if (outcome === 'claim') return reviewUntil ? `Gemeldet. Matchunt prüft Ihre Meldung bis ${dayMonth(reviewUntil)} Für Sie ist nichts zu tun.` : 'Gemeldet. Matchunt prüft Ihre Meldung. Für Sie ist nichts zu tun.';
  if (outcome === 'client_sphere') return `Gemeldet, danke. Eine Nachbesetzung ist hier nicht vorgesehen, weil ${SPHERE_WHY[reason] ?? 'der Grund auf Ihrer Seite liegt'} (Rahmenvertrag § 9 Abs. 4).`;
  if (outcome === 'late') return 'Gemeldet. Die Meldefrist von 14 Tagen war schon abgelaufen. Matchunt meldet sich bei Ihnen.';
  if (outcome === 'outside') return 'Gemeldet. Das Ende liegt nach dem Zeitraum der Nachbesetzung.';
  if (kind === 'non_start' && reason !== 'offer_withdrawn') return `Gemeldet, danke. Matchunt meldet sich${reviewUntil ? ` bis ${dayMonth(reviewUntil)}` : ''} bei Ihnen.`;
  return 'Gemeldet, danke. Der Headhunter und Matchunt sind informiert.';
}
