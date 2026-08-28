import type { BewerberItem, BewerberTab, BewerberTone } from '@/hooks/useBewerber';

// Job-Zustand: ein Wort + Farbe, gleiche Tonsprache wie die Bewerber-StatePills.
// Status (aktiv/pausiert/besetzt/geschlossen) ist bewusst vom Funnel getrennt —
// Kandidaten/Interviews sind Mengen, keine Lebenszyklus-Schritte.
export type JobStateKey = 'aktiv' | 'pausiert' | 'geschlossen' | 'besetzt';

export interface JobState {
  key: JobStateKey; // i18n: jobdetail.state.<key>
  tone: BewerberTone;
}

export function computeJobState(status: string | null, pausedAt: string | null): JobState {
  if (status === 'closed') return { key: 'geschlossen', tone: 'neutral' };
  if (status === 'filled') return { key: 'besetzt', tone: 'ok' };
  if (pausedAt) return { key: 'pausiert', tone: 'neutral' };
  return { key: 'aktiv', tone: 'ok' };
}

// Engpass-Diagnose: ersetzt den Vier-Faktoren-Health-Score. Regel-Kaskade über
// die computeState-Ergebnisse der Bewerber — erste zutreffende Regel gewinnt.
// Ausgabe ist immer ein Satz + höchstens EINE Aktion.
export type DiagnoseTone = BewerberTone | 'accent';

export type DiagnoseActionType = 'inbox' | 'detail' | 'edit' | 'resume' | 'none';

export interface JobDiagnose {
  key: string; // i18n: jobdetail.banner.<key>
  tone: DiagnoseTone;
  params?: Record<string, string | number>;
  action: {
    labelKey: string; // i18n: jobdetail.banner_action.<labelKey>
    type: DiagnoseActionType;
    submissionId?: string;
    tab?: BewerberTab; // gezielter Inbox-Deeplink (Default: alle)
  };
}

const isFeedback = (i: BewerberItem) =>
  i.state.key === 'feedback' || i.state.key === 'feedback_nodate';

export const severity = (i: BewerberItem) =>
  i.state.tone === 'crit' ? 3 : i.state.tone === 'warn' ? 2 : 1;

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export function diagnoseJob(
  items: BewerberItem[],
  opts: { pausedAt: string | null; liveSince: string; status?: string | null }
): JobDiagnose {
  // Terminalzustände zuerst: eine geschlossene/besetzte Stelle bekommt keinen
  // Live-Banner ("noch kein Vorschlag", "Ihre Stelle ist live") mehr.
  if (opts.status === 'closed') {
    return { key: 'geschlossen', tone: 'neutral', action: { labelKey: '', type: 'none' } };
  }
  if (opts.status === 'filled') {
    return { key: 'besetzt', tone: 'ok', action: { labelKey: '', type: 'none' } };
  }

  if (opts.pausedAt) {
    return {
      key: 'pausiert',
      tone: 'neutral',
      params: { date: new Date(opts.pausedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) },
      action: { labelKey: 'reaktivieren', type: 'resume' },
    };
  }

  const active = items.filter((i) => i.tab !== 'archiv');
  const mine = [...active.filter((i) => i.isMyTurn)].sort(
    (a, b) => severity(b) - severity(a) || b.hoursWaiting - a.hoursWaiting
  );

  const crit = mine.filter((i) => i.state.tone === 'crit');
  if (crit.length > 0) {
    if (crit.every(isFeedback)) {
      const first = crit[0];
      return crit.length === 1
        ? {
            key: first.state.params?.date ? 'feedback_single' : 'feedback_single_nodate',
            tone: 'crit',
            params: { date: String(first.state.params?.date ?? '') },
            action: { labelKey: 'feedback', type: 'detail', submissionId: first.submissionId },
          }
        : {
            key: 'feedback_plural',
            tone: 'crit',
            params: { count: crit.length },
            action: { labelKey: 'feedback', type: 'inbox', tab: 'interview' },
          };
    }
    // "seit über 21 Tagen" nur behaupten, wenn es wirklich Wartezeit-Eskalationen
    // sind — Absagen/abgelehnte Angebote sind ebenfalls rot, aber anders begründet.
    const allWaiting = crit.every((i) => i.state.key === 'wait_crit');
    return crit.length === 1
      ? {
          key: allWaiting ? 'ueberfaellig_single' : 'dringend_single',
          tone: 'crit',
          action: { labelKey: 'entscheiden', type: 'detail', submissionId: crit[0].submissionId },
        }
      : {
          key: allWaiting ? 'ueberfaellig_plural' : 'dringend_plural',
          tone: 'crit',
          params: { count: crit.length },
          action: { labelKey: 'entscheiden', type: 'inbox' },
        };
  }

  const feedback = mine.filter(isFeedback);
  if (feedback.length > 0) {
    const first = feedback[0];
    return feedback.length === 1
      ? {
          key: first.state.params?.date ? 'feedback_single' : 'feedback_single_nodate',
          tone: 'warn',
          params: { date: String(first.state.params?.date ?? '') },
          action: { labelKey: 'feedback', type: 'detail', submissionId: first.submissionId },
        }
      : {
          key: 'feedback_plural',
          tone: 'warn',
          params: { count: feedback.length },
          action: { labelKey: 'feedback', type: 'inbox', tab: 'interview' },
        };
  }

  const warns = mine.filter((i) => i.state.tone === 'warn');
  if (warns.length > 0) {
    return warns.length === 1
      ? {
          key: 'antwort_single',
          tone: 'warn',
          action: { labelKey: 'antworten', type: 'detail', submissionId: warns[0].submissionId },
        }
      : {
          key: 'antwort_plural',
          tone: 'warn',
          params: { count: warns.length },
          action: { labelKey: 'antworten', type: 'inbox' },
        };
  }

  if (mine.length > 0) {
    return mine.length === 1
      ? {
          key: 'aktion_single',
          tone: 'accent',
          action: { labelKey: 'pruefen', type: 'detail', submissionId: mine[0].submissionId },
        }
      : {
          key: 'aktion_plural',
          tone: 'accent',
          params: { count: mine.length },
          action: { labelKey: 'pruefen', type: 'inbox' },
        };
  }

  const liveDays = daysSince(opts.liveSince);
  if (active.length === 0) {
    if (liveDays > 14) {
      return {
        key: 'leer_lang',
        tone: 'warn',
        params: { days: liveDays },
        action: { labelKey: 'briefing', type: 'edit' },
      };
    }
    return { key: 'frisch', tone: 'neutral', action: { labelKey: '', type: 'none' } };
  }

  // Alles in Arbeit bei anderen (Recruiter/Kandidat) — bewusst keine Aktion.
  const lastSubmitted = active
    .map((i) => i.submittedAt)
    .sort()
    .at(-1);
  const days = lastSubmitted ? daysSince(lastSubmitted) : 0;
  if (days === 0) return { key: 'laeuft_heute', tone: 'ok', action: { labelKey: '', type: 'none' } };
  if (days === 1) return { key: 'laeuft_one', tone: 'ok', action: { labelKey: '', type: 'none' } };
  return { key: 'laeuft', tone: 'ok', params: { days }, action: { labelKey: '', type: 'none' } };
}

// Welche Funnel-Segmente tragen den "Sie sind am Zug"-Punkt?
export function myTurnTabs(items: BewerberItem[]): Set<BewerberTab> {
  const set = new Set<BewerberTab>();
  for (const i of items) {
    if (i.tab !== 'archiv' && i.isMyTurn) set.add(i.tab);
  }
  return set;
}
