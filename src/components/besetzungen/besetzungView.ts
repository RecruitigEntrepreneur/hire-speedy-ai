import type { BesetzungItem } from '@/lib/besetzungApi';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';

// Texte in der Sprache der Oberfläche (clientPlacements), gelesen beim Aufruf (README Regel 7).
const tb = (key: string, options?: Record<string, unknown>): string => i18n.t(`clientPlacements:${key}`, options);
const loc = () => intlLocale(i18n.language);

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
export const dateDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '–');
export const dayMonth = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', timeZone: 'UTC' }) : '–');
export const eur = (cents: number | null | undefined) => (cents == null ? '–' : `${new Intl.NumberFormat(loc(), { maximumFractionDigits: 0 }).format(Math.round(cents / 100))} €`);
export const eurExact = (cents: number | null | undefined) => (cents == null ? '–' : `${new Intl.NumberFormat(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)} €`);
export const eurYear = (v: number | null | undefined) => (v == null ? '–' : `${new Intl.NumberFormat(loc(), { maximumFractionDigits: 0 }).format(v)} €`);
export const first = (name: string) => (name.startsWith('PR-') ? name : name.split(' ')[0]);
/** „Cems“, „Max’“ */
export const genitive = (n: string) => (/[sßxz]$/i.test(n) ? `${n}’` : `${n}s`);
/** Genitiv in der Sprache der Oberfläche: „Cems“, englisch „Cem’s“, schwedisch/norwegisch „Cems“ bzw. „Lars“. */
export const genitiveUi = (n: string) => {
  const base = i18n.language.slice(0, 2);
  if (base === 'en') return `${n}’s`;
  if (base === 'sv' || base === 'nb') return /[sxz]$/i.test(n) ? n : `${n}s`;
  return genitive(n);
};

/** „in 38 Tagen“, „heute“, „vor 4 Tagen“ */
export function relDays(iso: string | null | undefined, today = todayKey()): string {
  if (!iso) return '';
  const d = Math.round((Date.parse(`${iso.slice(0, 10)}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY);
  if (d === 0) return tb('rel.today');
  if (d === 1) return tb('rel.tomorrow');
  if (d === -1) return tb('rel.yesterday');
  return d > 0 ? tb('rel.inDays', { count: d }) : tb('rel.daysAgo', { count: -d });
}

/** Kopfzeile: „Mira Stein · Nachbesetzung für Cem“ bei einer Ersatzbesetzung. */
export function titleOf(item: BesetzungItem): string {
  return item.placement?.replaces ? tb('title.replacementFor', { name: item.name, first: first(item.placement.replaces.name) }) : item.name;
}

export function packageLabel(i: BesetzungItem): string {
  const p = i.package;
  if (p.replacement) return tb('pkg.replacement');
  const short = p.key === 'core' ? 'Core' : p.key === 'continuity_90' ? 'Continuity 90' : p.key === 'continuity_180' ? 'Continuity 180' : p.name;
  return `${short} · ${new Intl.NumberFormat(loc(), { maximumFractionDigits: 2 }).format(Number(p.pct))} %`;
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
    if (o.status === 'countered') return { text: tb('status.countered'), tone: 'bad' };
    if (o.overdue) return { text: tb('status.overdue'), tone: 'bad' };
    if (o.status === 'considering') return { text: tb('status.considering', { who }), tone: 'warn' };
    if (o.status === 'accept_reported') return { text: tb('status.acceptReported', { who }), tone: 'warn' };
    return { text: tb('status.withRecruiter', { version: o.version }), tone: 'warn' };
  }
  if (p?.research) {
    const r = p.research;
    if (r.state === 'running') return { text: tb('status.researchRunning'), tone: 'neutral' };
    if (r.state === 'paused') return { text: tb('status.researchPaused'), tone: 'neutral' };
    if (r.state === 'awaiting_position') return { text: tb('status.confirmPosition'), tone: 'warn' };
    if (r.state === 'awaiting_payment') return { text: tb('status.awaitingPayment'), tone: 'neutral' };
    if (r.state === 'succeeded') return { text: tb('status.found'), tone: 'neutral' };
  }
  if (p?.offer?.status === 'open') return { text: tb('status.matchuntOffer'), tone: 'warn' };
  if (p?.end) {
    if (p.claim && ['submitted', 'in_review'].includes(p.claim.status)) return { text: tb('status.matchuntReviews'), tone: 'neutral' };
    return { text: p.end.kind === 'non_start' ? tb('status.notStarted') : tb('status.ended'), tone: 'neutral' };
  }
  if (p?.replaces && i.group !== 'ab') return { text: tb('status.replacement'), tone: 'neutral' };
  if (i.group === 'start') {
    if (!p) {
      const s = i.contract?.status ?? 'preparing';
      if (s === 'sent_self') return { text: tb('status.contractWith', { who }), tone: 'warn' };
      if (s === 'sent_digital') return { text: tb('status.signing'), tone: 'warn' };
      if (s === 'company_signed') return { text: tb('status.whoSigns', { who }), tone: 'warn' };
      if (s === 'reported' || s === 'signed') return { text: tb('status.signatureReported'), tone: 'warn' };
      if (s === 'declined') return { text: tb('status.contractDeclined'), tone: 'bad' };
      return { text: tb('status.contractNotSent'), tone: 'bad' };
    }
    if (p.startReport?.kind === 'started' && !p.startReport.contestedAt) return { text: tb('status.confirmStart'), tone: 'warn' };
    if (startPassed(i, today)) return { text: tb('status.startWas', { date: dayMonth(p.startDate) }), tone: 'warn' };
    return { text: tb('status.signed'), tone: 'good' };
  }
  if (i.group === 'haus') {
    return i.package.continuityDays ? { text: tb('status.replacementPossible'), tone: 'good' } : { text: tb('status.core'), tone: 'neutral' };
  }
  return { text: tb('status.done'), tone: 'neutral' };
}

/** Wer ist dran? (Aufgaben des Kunden haben Vorrang) */
export function dranOf(i: BesetzungItem, hasTask: boolean, today = todayKey()): { text: string; tone: Tone } | null {
  if (hasTask || i.dran === 'client' || startPassed(i, today)) return { text: tb('dran.you'), tone: 'bad' };
  if (i.dran === 'recruiter') return { text: tb('dran.recruiter'), tone: 'neutral' };
  if (i.dran === 'candidate') return { text: first(i.name), tone: 'neutral' };
  return null;
}

export function stepsOf(i: BesetzungItem, today = todayKey()): Step[] {
  const p = i.placement;
  const start = startOf(i);
  if (i.group === 'angebot') return [{ label: tb('steps.offer', { version: i.offer?.version ?? 1 }), state: 'done' }, { label: tb('steps.answer'), state: 'now' }, { label: tb('steps.acceptance'), state: 'next' }, { label: tb('steps.contract'), state: 'next' }];
  if (i.group === 'start' && !p) {
    const s = i.contract?.status ?? 'preparing';
    const contract: Step = s === 'sent_self' ? { label: tb('steps.sentSelf'), state: 'now' }
      : s === 'sent_digital' || s === 'company_signed' ? { label: tb('steps.signing'), state: 'now' }
        : s === 'reported' || s === 'signed' ? { label: tb('steps.signatureReported'), state: 'now' }
          : s === 'declined' ? { label: tb('steps.declined'), state: 'bad' } : { label: tb('steps.sendContract'), state: 'now' };
    return [{ label: tb('steps.acceptance'), state: 'done' }, contract, { label: tb('steps.signature'), state: 'next' }, { label: start ? tb('steps.startOn', { date: dateDe(start) }) : tb('steps.start'), state: 'next' }];
  }
  const started = !!p?.startFixedAt || ['started', 'ended_early', 'completed'].includes(String(p?.state)) || !!p?.startConfirmedAt;
  const signed: Step = { label: tb('steps.signed'), state: 'done' };
  const begun: Step = { label: p?.startDate ? tb('steps.begunOn', { date: dayMonth(p.startDate) }) : tb('steps.begun'), state: 'done' };
  if (p?.end) {
    const ended: Step = { label: p.end.kind === 'non_start' ? tb('steps.notStarted') : p.end.lastDay ? tb('steps.endsOn', { date: dayMonth(p.end.lastDay) }) : tb('steps.ends'), state: 'done' };
    const tail: Step = p.research?.state === 'succeeded' ? { label: tb('steps.found'), state: 'done' }
      : p.research?.state === 'running' || p.research?.state === 'paused' ? { label: tb('steps.researchRunning'), state: 'now' }
        : researchActive(i) ? { label: tb('steps.researchPrepare'), state: 'now' }
          : p.claim && ['submitted', 'in_review'].includes(p.claim.status) ? { label: tb('steps.matchuntReviews'), state: 'now' }
            : p.offer?.status === 'open' ? { label: tb('steps.matchuntOffer'), state: 'now' }
              : { label: tb('steps.reported'), state: 'done' };
    return p.end.kind === 'non_start' ? [signed, ended, tail] : [signed, begun, ended, tail];
  }
  if (i.group === 'start') {
    const passed = startPassed(i, today);
    return [{ label: tb('steps.acceptance'), state: 'done' }, signed, { label: start ? tb('steps.startOn', { date: dateDe(start) }) : tb('steps.startOpen'), state: passed ? 'done' : 'now' }, { label: tb('steps.confirmStart'), state: passed ? 'now' : 'next' }];
  }
  if (i.group === 'haus') {
    return [signed, begun,
      p?.continuityEnd ? { label: tb('steps.replacementUntil', { date: dateDe(p.continuityEnd) }), state: 'now' } : { label: tb('steps.inHouseUntil', { date: dateDe(p?.coreUntil) }), state: 'now' }];
  }
  if (!started) return [signed, { label: tb('steps.completed'), state: 'done' }];
  return [begun, { label: i.package.continuityDays ? tb('steps.replacementOver') : tb('steps.sixMonths'), state: 'done' }];
}

export function invoiceFact(i: BesetzungItem): Fact {
  const inv = i.invoice;
  const label = tb('facts.invoice');
  if (!i.placement) return { label, value: tb('facts.afterSignature') };
  if (i.package.replacement && !inv) return { label, value: tb('facts.noNewInvoice') };
  if (!inv || inv.status === 'draft' || !inv.number) return { label, value: tb('facts.byMatchunt') };
  if (inv.status === 'paid') return { label, value: tb('facts.paid', { number: inv.number, date: dayMonth(inv.paidAt) }) };
  if (inv.reportedPaidOn) return { label, value: tb('facts.checking', { number: inv.number }) };
  const open = inv.openCents ?? inv.totalCents;
  if (inv.overdue) return { label, value: tb('facts.overdue', { number: inv.number, amount: eur(open), date: dayMonth(inv.dueDate) }), tone: 'bad' };
  return { label, value: tb('facts.due', { number: inv.number, amount: eur(open), date: dateDe(inv.dueDate) }) };
}

/** Eckdaten: die ersten vier stehen auf der Karte, alle im Fenster. */
export function factsOf(i: BesetzungItem, today = todayKey()): Fact[] {
  const p = i.placement;
  const start = startOf(i);
  const fee: Fact = { label: tb('facts.fee'), value: i.package.replacement ? (i.feeCents ? tb('facts.feeHigherSalary', { amount: eur(i.feeCents) }) : tb('facts.noNewFee')) : i.feeCents == null ? '–' : tb(p ? 'facts.feeNet' : 'facts.feeApprox', { amount: eur(i.feeCents) }) };
  const pkg: Fact = { label: tb('facts.package'), value: packageLabel(i) };
  if (i.group === 'angebot') {
    const o = i.offer!;
    return [
      { label: tb('facts.offer'), value: o.variable ? tb('facts.offerValueVariable', { salary: eurYear(o.salary), variable: eurYear(o.variable), version: o.version }) : tb('facts.offerValue', { salary: eurYear(o.salary), version: o.version }) },
      { label: tb('facts.startPerOffer'), value: dateDe(o.startDate) },
      { label: tb('facts.answerBy'), value: dateDe(o.responseDue), tone: o.overdue ? 'bad' : undefined },
      fee, pkg,
    ];
  }
  const out: Fact[] = [];
  const started = !!p?.startFixedAt || ['started', 'ended_early', 'completed'].includes(String(p?.state)) || !!p?.startConfirmedAt;
  // p.end.label kommt so vom Server (Grund der Meldung)
  if (p?.end) out.push({ label: p.end.kind === 'non_start' ? tb('facts.notStarted') : tb('facts.ends'), value: p.end.lastDay ? tb('facts.lastDay', { label: p.end.label, date: dateDe(p.end.lastDay) }) : p.end.label });
  if (i.group === 'start' && !p?.end) out.push({ label: tb('facts.firstDay'), value: start ? `${dateDe(start)} · ${relDays(start, today)}` : tb('facts.stillOpen'), tone: startPassed(i, today) ? 'warn' : undefined });
  else if (p && started) out.push({ label: tb('facts.begun'), value: p.startDate ? (p.startFixedAt || p.startConfirmedAt ? tb('facts.confirmed', { date: dateDe(p.startDate) }) : dateDe(p.startDate)) : tb('facts.yes') });
  out.push(pkg);
  if (p?.replaces) out.push({ label: tb('facts.replacementFor'), value: p.replaces.name });
  if (i.group === 'haus' && p?.continuityEnd && !p.end) out.push({ label: tb('facts.replacementUntil'), value: tb('facts.reportUntil', { date: dateDe(p.continuityEnd), until: dayMonth(p.reportUntil) }) });
  else if (i.group === 'haus' && p?.coreUntil && !p.end) out.push({ label: tb('facts.staysUntil'), value: dateDe(p.coreUntil) });
  else out.push(fee);
  out.push(invoiceFact(i));
  // nur im Fenster
  if (i.group === 'haus' && !p?.end) out.push(fee);
  if (i.grossCents != null) out.push({ label: p ? tb('facts.grossTarget') : tb('facts.salaryPerOffer'), value: eur(i.grossCents) });
  if (p) {
    const cc = p.costCenter ? tb('facts.costCenter', { value: p.costCenter }) : '';
    const value = p.purchaseOrder ? `${p.purchaseOrder}${cc}` : p.costCenter ? `–${cc}` : '–';
    out.push({ label: tb('facts.po'), value, action: i.can?.purchaseOrder ? 'po' : undefined });
  }
  if (i.offer?.probationMonths && start && !p?.end) out.push({ label: tb('facts.probation'), value: tb('facts.probationValue', { count: i.offer.probationMonths }) });
  return out;
}

/** Satz über der Liste je Reiter (clientPlacements:intro.<Reiter>). */
export const introOf = (tab: string): string => tb(`intro.${tab}`);

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

const sphereWhy = (reason: string) => (['position_changed', 'offer_withdrawn'].includes(reason) ? tb(`sphere.${reason}`) : tb('sphere.default'));

/** Was nach der Meldung „Besetzung endet“ im Fenster steht; null = keine Meldung, keine Nachbesetzung. */
export function researchPanel(i: BesetzungItem): ResearchPanel | null {
  const p = i.placement;
  if (!p || (!p.end && !p.research)) return null;
  const who = first(i.name);
  const r = p.research;
  const claim = p.claim;
  const offer = p.offer;
  const continuity = !!i.package.continuityDays;
  const nonStartTitle = p.end?.kind === 'non_start' ? tb('panel.notStarted', { who }) : null;

  if (r?.state === 'succeeded') {
    const rep = r.replacement;
    return {
      variant: 'found', title: null,
      rows: [
        { text: tb('panel.advertised'), date: r.startedAt, state: 'done' },
        { text: rep ? tb('panel.foundName', { name: rep.name }) : tb('panel.found'), date: r.endedAt, state: 'done' },
      ],
      lines: [rep ? tb('panel.newCard', { first: first(rep.name), who }) : tb('panel.noNewInvoice')],
    };
  }
  if (r?.state === 'cancelled' || r?.state === 'exhausted') {
    return {
      variant: 'ended', title: nonStartTitle,
      rows: r.startedAt ? [{ text: tb('panel.advertised'), date: r.startedAt, state: 'done' }, { text: tb('panel.researchEnded'), date: r.endedAt, state: 'done' }] : [],
      lines: [r.endReason === 'client_ended' ? tb('panel.clientEnded') : tb('panel.matchuntEnded')],
    };
  }
  if (r?.state === 'running' || r?.state === 'paused') {
    const days = r.days ?? 0;
    const subs = r.fresh > 0 ? tb('panel.freshSubs', { count: r.fresh }) : r.submissions > 0 ? tb('panel.subs', { count: r.submissions }) : tb('panel.noSubs');
    return {
      variant: 'running', title: nonStartTitle,
      rows: [
        { text: tb('panel.advertised'), date: r.startedAt, state: 'done' },
        { text: r.paused ? tb('panel.paused') : (days === 0 ? tb('panel.runningToday') : tb('panel.runningDays', { count: days })), state: 'now' },
      ],
      lines: [
        tb('panel.recruiters', { count: r.recruiters, subs }),
        ...(r.paused ? [tb('panel.pausedHint')] : []),
      ],
    };
  }
  if (r?.state === 'awaiting_payment') {
    const inv = r.kind === 'joker' ? p.researchInvoice : i.invoice;
    const rows: PanelRow[] = r.kind === 'joker'
      ? [{ text: tb('panel.offerAccepted'), date: offer?.answeredAt ?? null, state: 'done' }]
      : [{ text: tb('panel.matchuntChecked'), date: claim?.decidedAt ?? null, state: 'done' }, { text: tb('panel.positionConfirmed'), state: 'done' }];
    rows.push({ text: tb('panel.payThenStart'), date: inv?.dueDate && inv.status !== 'paid' ? inv.dueDate : null, state: 'now' });
    rows.push({ text: tb('panel.runsUntilFilled'), state: 'next' });
    return { variant: 'payment', title: nonStartTitle, rows, lines: [] };
  }
  if (r?.state === 'awaiting_position') {
    const paid = i.invoice?.status === 'paid';
    return {
      variant: 'position', title: nonStartTitle,
      rows: [
        { text: tb('panel.matchuntChecked'), date: claim?.decidedAt ?? null, state: 'done' },
        paid ? { text: tb('panel.invoicePaid'), date: i.invoice?.paidAt ?? null, state: 'done' } : { text: tb('panel.payThenStart'), state: 'next' },
        { text: tb('panel.confirmPosition'), state: 'now' },
      ],
      lines: [tb('panel.confirmAsIs'), tb('panel.higherSalary')],
    };
  }
  if (offer?.status === 'open') {
    const price = eurExact(offer.priceCents);
    return {
      variant: 'offer', title: nonStartTitle ?? tb('panel.ourOffer', { who }), rows: [],
      lines: [
        tb('panel.weOffer'),
        tb('panel.offerText', { price: price.replace(/[.,]00 €$/, ' €') }),
        ...(offer.validUntil ? [tb('panel.offerValid', { date: dateDe(offer.validUntil) })] : []),
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
      lines: [tb('panel.thanks'), tb('panel.sphere', { why: sphereWhy(String(end.reason)) })],
    };
  }
  const corePending = end.kind === 'non_start' && !continuity && !i.package.replacement && !offer && p.state !== 'cancelled' && !sphere;
  if (openCase || corePending) {
    return {
      variant: 'review', title: nonStartTitle,
      rows: [
        { text: tb('panel.reported'), date: end.reportedAt, state: 'done' },
        { text: (claim?.reviewUntil ?? end.reviewUntil) ? tb('panel.reviewingUntil', { date: dayMonth(claim?.reviewUntil ?? end.reviewUntil) }) : tb('panel.reviewing'), state: 'now' },
      ],
      lines: [tb('panel.nothingToDo')],
    };
  }
  if (claim?.status === 'rejected') {
    return {
      variant: 'rejected', title: nonStartTitle, rows: [],
      lines: [tb('panel.thanks'), claim.rejectionReason ? tb('panel.rejectedReason', { reason: claim.rejectionReason }) : tb('panel.rejected')],
    };
  }
  if (continuity && end.outcome === 'late') {
    return { variant: 'late', title: nonStartTitle, rows: [], lines: [tb('panel.thanks'), tb('panel.late')] };
  }
  if (continuity && end.outcome === 'outside') {
    return { variant: 'outside', title: nonStartTitle, rows: [], lines: [tb('panel.thanks'), tb('panel.outside')] };
  }
  // Variante Core (auch: Angebot abgelehnt oder abgelaufen)
  return {
    variant: 'core', title: nonStartTitle, rows: [],
    lines: [tb('panel.thanks'), i.can?.reopenJob ? tb('panel.reopen') : ['published', 'paused'].includes(String(p.jobStatus)) ? tb('panel.stillOpen') : ''].filter(Boolean),
  };
}

/** K5: Gründe je nachdem, ob die Person schon angefangen hat (wie nachbesetzung.ts). */
export function endReasons(started: boolean, who: string): { key: string; label: string }[] {
  const keys = started
    ? ['candidate_resigned', 'performance_conduct', 'mutual_on_request', 'position_changed', 'other']
    : ['declined_before_start', 'no_show', 'offer_withdrawn'];
  return keys.map((key) => ({ key, label: tb(`reasons.${key}`, { who }) }));
}

/** Satz nach dem Melden (K5). */
export function endDoneText(outcome: string, kind: 'non_start' | 'departure', reviewUntil: string | null, reason: string): string {
  if (outcome === 'claim') return reviewUntil ? tb('endDone.claimUntil', { date: dayMonth(reviewUntil) }) : tb('endDone.claim');
  if (outcome === 'client_sphere') return tb('endDone.sphere', { why: sphereWhy(reason) });
  if (outcome === 'late') return tb('endDone.late');
  if (outcome === 'outside') return tb('endDone.outside');
  if (kind === 'non_start' && reason !== 'offer_withdrawn') return reviewUntil ? tb('endDone.nonStartUntil', { date: dayMonth(reviewUntil) }) : tb('endDone.nonStart');
  return tb('endDone.other');
}
