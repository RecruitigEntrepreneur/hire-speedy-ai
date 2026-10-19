import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { recentConsoleErrors } from './consoleBuffer';
import { pageContext } from './pageContext';
import { recentNetworkErrors, recentTrail } from './sessionTrail';
import type { MarkElement } from './elements';
import type { FeedbackKind, FeedbackSeverity, FeedbackStatus } from './labels';

export * from './labels';

/** Rahmen als Anteil am Bild (0..1), damit er bei jeder Anzeigegröße passt. */
export interface FeedbackMark {
  x: number;
  y: number;
  w: number;
  h: number;
  element?: MarkElement | null;
}

export interface SubmitFeedbackInput {
  message: string;
  kind: FeedbackKind | null;
  severity: FeedbackSeverity | null;
  marks: FeedbackMark[];
  blackoutCount: number;
  /** Bild mit eingebrannten Schwärzungen */
  screenshot: string | null;
  /** Ausschnitte der Rahmen, für die KI */
  crops: string[];
  screenshotNote: string | null;
  routePattern: string | null;
  sourceFile: string | null;
  /** Nur auf Aufnahme-Links: der Token aus dem Pfad. */
  guestToken: string | null;
}

/** Was automatisch mitgeht — auch für die Anzeige „Automatisch dabei“. */
export function automaticContext() {
  return {
    ...pageContext(),
    console_errors: recentConsoleErrors(),
    network_errors: recentNetworkErrors(),
    breadcrumbs: recentTrail(),
  };
}

export async function submitFeedback(input: SubmitFeedbackInput, fallbackError: string): Promise<{ ticketNo: number | null }> {
  const { data, error } = await supabase.functions.invoke('product-feedback', {
    body: {
      action: 'submit',
      message: input.message,
      kind: input.kind,
      severity: input.severity,
      marks: input.marks,
      blackout_count: input.blackoutCount,
      screenshot: input.screenshot,
      crops: input.crops,
      screenshot_note: input.screenshotNote,
      route_pattern: input.routePattern,
      source_file: input.sourceFile,
      guest_token: input.guestToken,
      ...automaticContext(),
    },
  });
  if (!error) return { ticketNo: typeof data?.ticket_no === 'number' ? data.ticket_no : null };

  // Nur unsere eigenen Meldungen zeigen; fremde (z. B. „Requested function was
  // not found“, solange die Function nicht deployed ist) ersetzt ein deutscher Satz.
  let message = fallbackError;
  try {
    const context = (error as { context?: Response }).context;
    const body = context ? await context.json() : null;
    if (body?.reason && typeof body.message === 'string') message = body.message;
  } catch {
    /* Text bleibt allgemein */
  }
  throw new Error(message);
}

/** Schalter aus Admin › Feedback (Notaus). Ohne Tabelle (Migration offen) bleibt die Lasche aus. */
export function useFeedbackEnabled() {
  return useQuery({
    queryKey: ['feedback-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feedback_settings').select('enabled').eq('id', 1).maybeSingle();
      if (error) return false;
      return data?.enabled === true;
    },
    staleTime: 5 * 60_000,
  });
}

export interface MyFeedback {
  ticket_no: number;
  summary: string;
  status: FeedbackStatus;
  created_at: string;
}

/** „Ihre Meldungen“ im Feedback-Fenster — nur Nummer, eigener Text, Status. */
export function useMyFeedback(enabled: boolean) {
  return useQuery({
    queryKey: ['my-feedback'],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_feedback');
      if (error) return [] as MyFeedback[];
      return (data ?? []) as MyFeedback[];
    },
    staleTime: 30_000,
  });
}
