import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Datenzugriff der login-freien Jobaufnahme.
 *
 * Alles läuft über Edge Functions mit Service-Role — es gibt bewusst keine
 * anon-Policy auf intake_links/intake_drafts. Das ausgelieferte Bundle enthält
 * den anon-Key; ein clientseitiger Filter schützt nichts.
 *
 * Der Entwurfs-Token liegt in localStorage, damit ein Reload oder ein
 * versehentlich geschlossener Tab die Arbeit nicht verliert. Er steht nie in
 * der URL-Query — dort landet er in Browserverläufen, Referrer-Headern und
 * Server-Logs.
 */

const STORAGE_PREFIX = 'matchunt.intake.';

export type FailureReason =
  | 'invalid_request' | 'not_found' | 'expired' | 'revoked' | 'exhausted'
  | 'rate_limited' | 'not_allowed' | 'conflict' | 'upstream_error'
  | 'not_deployed' | 'internal_error';

export interface IntakeFailure {
  reason: FailureReason;
  message: string;
  missing?: string[];
}

export interface IntakeTerms {
  fee_percentage: number;
  fee_basis: string;
  payment_terms_days: number;
  guarantee_days: number | null;
  refund_rule: string | null;
  vat_note: string | null;
  requires_signature: boolean;
  body_md: string;
  template_id: string;
  template_version: number;
  agb_version: string;
  label: string;
  agb_url?: string;
  signature_notice?: string | null;
}

export interface IntakeLinkInfo {
  id: string;
  link_type: 'personal' | 'campaign' | 'public';
  label: string;
  owner_name: string | null;
  allow_freemail: boolean;
  prefill: Record<string, string | null>;
}

export interface GuestDraft {
  id: string;
  contract_type: 'full-time' | 'freelance';
  built: Record<string, any> | null;
  answers: Record<string, any> | null;
  dyn: Record<string, any> | null;
  freelance: Record<string, any> | null;
  flexibility: Record<string, any> | null;
  reveal_setup: Record<string, any> | null;
  skill_requirements: any[] | null;
  completeness: number;
  title: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_role: string | null;
  company_name: string | null;
  company_legal_name: string | null;
  company_domain: string | null;
  company_website: string | null;
  company_street: string | null;
  company_postal_code: string | null;
  company_city: string | null;
  company_country: string | null;
  company_vat_id: string | null;
  company_registration_number: string | null;
  company_size: string | null;
  company_industry: string | null;
  billing_email: string | null;
  states: {
    capture: 'started' | 'in_progress' | 'complete';
    identity: 'anonymous' | 'contact_provided' | 'email_verified';
    commercial: 'not_started' | 'presented' | 'confirmed' | 'discussion_requested' | 'declined';
    review: 'not_submitted' | 'pending_admin' | 'accepted' | 'changes_requested' | 'rejected';
  };
  submitted_at: string | null;
  rejection_reason: string | null;
  purge_after: string | null;
}

/** Ein einzelner Aufruf. Fehler kommen als Wert zurück, nicht als Exception —
 *  ein abgelaufener Link ist kein Programmfehler, sondern ein Zustand. */
async function call<T>(fn: string, body: Record<string, unknown>): Promise<T | IntakeFailure> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body });

    // supabase-js verpackt 4xx/5xx in error und legt den Rumpf in
    // error.context — ohne das Auslesen wäre jede Absage "Edge Function
    // returned a non-2xx status code" und der echte Grund unsichtbar.
    if (error) {
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const payload = await ctx.json();
          if (payload?.reason) {
            return { reason: payload.reason, message: payload.message ?? 'Es ist ein Fehler aufgetreten.', missing: payload.missing };
          }
        } catch { /* Rumpf nicht lesbar — unten der Sammelfall */ }
      }

      // FunctionsFetchError heißt: der Aufruf kam gar nicht an. In der Praxis
      // ist das fast immer eine noch nicht deployte Function — der Preflight
      // läuft dann in einen 404 und scheitert an CORS. Das als
      // "Verbindungsfehler" zu melden wäre irreführend: es liegt nicht am
      // Netz des Kunden, und erneutes Versuchen hilft nicht.
      if ((error as { name?: string })?.name === 'FunctionsFetchError') {
        return {
          reason: 'not_deployed',
          message:
            'Die Jobaufnahme ist gerade nicht erreichbar. Bitte melden Sie sich kurz bei Ihrem Ansprechpartner — wir kümmern uns sofort darum.',
        };
      }
      return { reason: 'internal_error', message: 'Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.' };
    }

    if (data && typeof data === 'object' && 'reason' in (data as any)) {
      return data as IntakeFailure;
    }
    return data as T;
  } catch {
    return { reason: 'internal_error', message: 'Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen.' };
  }
}

export const isFailure = (value: unknown): value is IntakeFailure =>
  Boolean(value && typeof value === 'object' && 'reason' in (value as Record<string, unknown>));

/** Pseudonym des Browsers für den Funnel. Kein Personenbezug ohne den Entwurf. */
function anonymousId(): string {
  const key = `${STORAGE_PREFIX}anon`;
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const tokenKey = (linkToken: string) => `${STORAGE_PREFIX}draft.${linkToken.slice(0, 12)}`;

const readStored = (key: string): string | null => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeStored = (key: string, value: string) => {
  try { localStorage.setItem(key, value); } catch { /* privates Fenster */ }
};

export interface GuestIntakeState {
  status: 'loading' | 'ready' | 'failed';
  failure: IntakeFailure | null;
  link: IntakeLinkInfo | null;
  terms: IntakeTerms | null;
  draft: GuestDraft | null;
  draftToken: string | null;
  locked: boolean;
  saving: boolean;
  saveError: string | null;
  lastSavedAt: Date | null;
}

/**
 * @param linkToken   Token aus /start/:token — beginnt eine neue Aufnahme
 * @param draftToken  Token aus /aufnahme/:token — setzt eine bestehende fort
 */
export function useGuestIntake(linkToken?: string, resumeToken?: string) {
  const [state, setState] = useState<GuestIntakeState>({
    status: 'loading', failure: null, link: null, terms: null,
    draft: null, draftToken: null, locked: false,
    saving: false, saveError: null, lastSavedAt: null,
  });

  const tokenRef = useRef<string | null>(null);
  /** Für welche Token-Kombination bereits geladen wurde. Ein bloßes
   *  boolean-Flag hätte einen Wechsel der Route-Parameter verschluckt: der
   *  Effekt liefe erneut, bräche aber sofort ab, und die Seite zeigte weiter
   *  die alte Aufnahme. */
  const loadedFor = useRef<string | null>(null);

  // ---- Einstieg -----------------------------------------------------------
  useEffect(() => {
    const key = `${linkToken ?? ''}|${resumeToken ?? ''}`;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    setState((s) => ({ ...s, status: 'loading', failure: null }));

    (async () => {
      // Fortsetzen aus einer Mail hat immer Vorrang.
      const existing = resumeToken ?? (linkToken ? readStored(tokenKey(linkToken)) : null);

      if (existing) {
        const res = await call<{ draft: GuestDraft; link: IntakeLinkInfo | null; terms: IntakeTerms | null; locked: boolean }>(
          'intake-draft', { draft_token: existing, action: 'get' },
        );
        if (!isFailure(res)) {
          tokenRef.current = existing;
          if (linkToken) writeStored(tokenKey(linkToken), existing);
          setState((s) => ({
            ...s, status: 'ready', failure: null,
            draft: res.draft, link: res.link, terms: res.terms, draftToken: existing, locked: res.locked,
          }));
          return;
        }
        // Abgelaufen oder gelöscht: mit einem Link im Rücken beginnen wir neu,
        // ohne einen sind wir am Ende.
        if (!linkToken) {
          setState((s) => ({ ...s, status: 'failed', failure: res }));
          return;
        }
      }

      if (!linkToken) {
        setState((s) => ({
          ...s, status: 'failed',
          failure: { reason: 'not_found', message: 'Dieser Zugriffslink ist unbekannt.' },
        }));
        return;
      }

      const res = await call<{
        link: IntakeLinkInfo; terms: IntakeTerms | null; draft_token: string; draft: GuestDraft;
      }>('intake-start', { token: linkToken, anonymous_id: anonymousId() });

      if (isFailure(res)) {
        setState((s) => ({ ...s, status: 'failed', failure: res }));
        return;
      }

      tokenRef.current = res.draft_token;
      writeStored(tokenKey(linkToken), res.draft_token);
      setState((s) => ({
        ...s, status: 'ready', failure: null,
        link: res.link, terms: res.terms, draft: res.draft, draftToken: res.draft_token, locked: false,
      }));
    })();
  }, [linkToken, resumeToken]);

  // ---- Autosave -----------------------------------------------------------
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const flush = useCallback(async () => {
    if (!tokenRef.current || inFlight.current) return;
    const patch = pending.current;
    if (Object.keys(patch).length === 0) return;

    pending.current = {};
    inFlight.current = true;
    setState((s) => ({ ...s, saving: true }));

    const res = await call<{ draft: GuestDraft; terms: IntakeTerms | null; locked: boolean }>(
      'intake-draft', { draft_token: tokenRef.current, action: 'patch', patch },
    );
    inFlight.current = false;

    if (isFailure(res)) {
      // Nicht schlucken: der Kunde muss erfahren, dass nichts gespeichert wurde.
      // Die Eingaben bleiben in der Warteschlange und gehen beim nächsten
      // Versuch mit.
      pending.current = { ...patch, ...pending.current };
      setState((s) => ({ ...s, saving: false, saveError: res.message }));
      return;
    }

    setState((s) => ({
      ...s, saving: false, saveError: null, lastSavedAt: new Date(),
      draft: res.draft, terms: res.terms ?? s.terms, locked: res.locked,
    }));
  }, []);

  /** Sammelt Änderungen und schreibt sie gebündelt — 1,2 s nach der letzten
   *  Eingabe. Sofort schreiben hieße ein Aufruf je Tastenanschlag. */
  const save = useCallback((patch: Record<string, unknown>, immediate = false) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    if (immediate) void flush();
    else timer.current = setTimeout(() => { void flush(); }, 1200);
  }, [flush]);

  // Beim Verlassen der Seite noch offene Änderungen wegschreiben.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  // ---- Aktionen -----------------------------------------------------------
  const withToken = <T,>(fn: string, body: Record<string, unknown>) =>
    call<T>(fn, { ...body, draft_token: tokenRef.current });

  const sendCode = useCallback(
    (email: string) => withToken<{ sent: boolean; masked_email: string; expires_in_minutes: number }>(
      'intake-verify-email', { action: 'send', email }),
    [],
  );

  const confirmCode = useCallback(
    async (code: string) => {
      const res = await withToken<{ verified: boolean; known_company: { name: string } | null; draft: GuestDraft | null }>(
        'intake-verify-email', { action: 'confirm', code });
      if (!isFailure(res) && res.draft) setState((s) => ({ ...s, draft: res.draft! }));
      return res;
    },
    [],
  );

  const loadTerms = useCallback(
    () => withToken<{ terms: IntakeTerms; mandate: any; commercial_state: string }>('intake-terms', { action: 'get' }),
    [],
  );

  const requestTermsDiscussion = useCallback(
    async (note: string) => {
      const res = await withToken<{ ok: boolean; message: string }>('intake-terms', {
        action: 'request_discussion', note,
      });
      if (!isFailure(res)) {
        setState((s) => (s.draft ? { ...s, draft: { ...s.draft, states: { ...s.draft.states, commercial: 'discussion_requested' } } } : s));
      }
      return res;
    },
    [],
  );

  const submit = useCallback(
    async (signerName: string) => {
      await flush();
      const res = await withToken<{
        ok: boolean; review_state: string; mandate_number: string;
        confirmation_sent: boolean; requires_signature: boolean; draft: GuestDraft;
      }>('intake-submit', { accept_terms: true, accept_agb: true, signer_name: signerName });
      if (!isFailure(res) && res.draft) {
        setState((s) => ({ ...s, draft: res.draft, locked: true }));
      }
      return res;
    },
    [flush],
  );

  const forward = useCallback(
    (toEmail: string, toName: string, message: string) =>
      withToken<{ ok: boolean; message: string }>('intake-forward', {
        to_email: toEmail, to_name: toName, message,
      }),
    [],
  );

  const askAi = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await withToken<Record<string, any>>('intake-ai', {
        op: 'questions', payload,
      });
      if (isFailure(res)) throw new Error(res.message);
      return res;
    },
    [],
  );

  const parseText = useCallback(
    (jobText: string) => withToken<{ success?: boolean; data?: any }>('intake-ai', {
      op: 'parse_text', payload: { jobText },
    }),
    [],
  );

  const parseUrl = useCallback(
    (jobUrl: string) => withToken<{ success?: boolean; data?: any }>('intake-ai', {
      op: 'parse_url', payload: { jobUrl },
    }),
    [],
  );

  return { state, save, flush, sendCode, confirmCode, loadTerms, requestTermsDiscussion, submit, forward, askAi, parseText, parseUrl };
}

/** „Später fortsetzen" per Mail — braucht keinen Entwurfs-Token. */
export async function requestResumeLink(email: string) {
  return call<{ ok: boolean; message: string }>('intake-resume', { email });
}
