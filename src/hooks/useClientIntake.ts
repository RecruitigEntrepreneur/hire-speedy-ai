import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { emptyCapture, captureBriefingText, type CaptureState } from '@/components/intake/guest/CaptureStep';
import type { CompanyDraft, Anreicherung } from '@/components/intake/guest/CompanyBlock';
import type { IntakeFailure } from '@/hooks/useGuestIntake';
import { buildIntakePayload } from '@/lib/intakeMapping';
import { ladeFirmendaten, joinAddress, firmendatenVollstaendig, type Firmendaten } from '@/lib/firmendaten';
import { resolveIntakeSubmitTarget, notifyApproversOfIntake, type IntakeSubmitTarget } from '@/lib/intakeApproval';
// Dieselbe Abbildung Entwurf -> Stelle wie beim Link (/start). Liegt in
// _shared, weil Deno nicht aus src/ importieren kann; umgekehrt geht es.
import { draftToJobRow } from '../../supabase/functions/_shared/intake-mapping';

/**
 * Die Jobaufnahme fuer angemeldete Kunden.
 *
 * Dieselben Bausteine wie der Link-Ablauf (CaptureStep und alles darunter),
 * nur ein anderer Unterbau: kein Entwurfs-Token, keine E-Mail-Bestaetigung,
 * sondern das Konto. Gespeichert wird als `jobs`-Zeile mit Status `draft` --
 * das ist der Ort, an dem Kunden ihre Entwuerfe schon heute finden.
 *
 * Offen (braucht Backend, siehe RAHMENVERTRAG_PROZESS_PLAN.md P3):
 *   - HR/Admin koennen den Rahmenvertrag per RLS nicht lesen (nur Inhaber).
 *   - Der Konditionen-Snapshot je Position (commercial_mandates) kann vom
 *     Browser nicht geschrieben werden. Bis create_position_snapshot existiert,
 *     steht die gewaehlte Kondition in intake_payload.commercial.
 */

export interface ClientFramework {
  id: string;
  agreement_number: string;
  package_key: string;
  fee_percent: number;
  name: string;
  continuity_days: number | null;
  agreed_at: string | null;
}

export interface PublicPackage {
  package_key: string;
  version: number;
  public_name: string;
  summary: string | null;
  bullets: string[] | null;
  sort_order: number | null;
  client_fee_pct: number;
  continuity_days: number | null;
  claim_notice_days: number | null;
}

export interface CommercialChoice {
  package_key: string;
  /** Hoeher als im Rahmenvertrag -- nur fuer diese Position. */
  upgraded: boolean;
}

const EMPTY_COMPANY: Partial<CompanyDraft> = {};

/**
 * Schreibt eine Stelle und laesst Spalten weg, die es live (noch) nicht gibt.
 *
 * OHNE `.select()` nach dem INSERT: RETURNING prueft die SELECT-Policy
 * (can_access_job), und die sieht die eben eingefuegte Zeile im selben
 * Statement noch nicht -- das INSERT scheitert dann mit 42501, obwohl die
 * INSERT-Policy erfuellt ist (live nachgestellt am 24.09.2026). Deshalb
 * erzeugt der Browser die ID selbst.
 */
async function writeJob(id: string | null, row: Record<string, unknown>) {
  const newId = id ? null : crypto.randomUUID();
  const payload = { ...row, ...(newId ? { id: newId } : {}) };
  const dropped: string[] = [];
  for (let i = 0; i < 12; i++) {
    const res = id
      ? await supabase.from('jobs').update(payload as any, { count: 'exact' }).eq('id', id)
      : await supabase.from('jobs').insert(payload as any);
    if (!res.error) {
      if (id && res.count === 0) {
        return { id: null, error: new Error('Keine Berechtigung für diesen Entwurf') };
      }
      if (dropped.length) console.warn('[useClientIntake] Spalten fehlen live, weggelassen:', dropped);
      return { id: id ?? newId, error: null };
    }
    const m = /Could not find the '([^']+)' column/.exec(res.error.message ?? '');
    if (m && m[1] in payload) {
      delete payload[m[1]];
      dropped.push(m[1]);
      continue;
    }
    return { id: null, error: res.error };
  }
  return { id: null, error: new Error('Zu viele fehlende Spalten') };
}

export function useClientIntake(jobIdParam?: string) {
  const { user } = useAuth();
  const [capture, setCapture] = useState<CaptureState | null>(jobIdParam ? null : emptyCapture('full-time'));
  const [company, setCompany] = useState<Partial<CompanyDraft>>(EMPTY_COMPANY);
  const [jobId, setJobId] = useState<string | null>(jobIdParam ?? null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const jobIdRef = useRef<string | null>(jobIdParam ?? null);
  /** Status der geladenen Stelle. Autosave behaelt ihn -- eine eingereichte
   *  oder aktive Stelle faellt beim Vervollstaendigen nicht auf 'draft' zurueck. */
  const [status, setStatus] = useState<string>('draft');
  const statusRef = useRef('draft');
  const dirty = useRef(false);
  const inFlight = useRef<Promise<unknown> | null>(null);
  const captureRef = useRef(capture);
  const companyRef = useRef(company);
  captureRef.current = capture;
  companyRef.current = company;

  // ---- Stammdaten ----------------------------------------------------------

  // Firmendaten aus dem Konto -- dieselbe Quelle wie die Einstellungen.
  const { data: konto } = useQuery({
    queryKey: ['client-intake-firma', user?.id],
    enabled: !!user,
    staleTime: 300_000,
    queryFn: () => ladeFirmendaten(user!.id),
  });
  const profile = konto?.profile ?? null;
  const firma: Firmendaten | null = konto?.firma ?? null;

  const { data: target } = useQuery({
    queryKey: ['client-intake-target', user?.id],
    enabled: !!user,
    staleTime: 300_000,
    queryFn: (): Promise<IntakeSubmitTarget> => resolveIntakeSubmitTarget(user!.id),
  });

  /** Der aktive Rahmenvertrag mit Paket. Lesbar nur fuer den Inhaber (RLS). */
  const { data: framework, isLoading: frameworkLoading } = useQuery({
    queryKey: ['client-intake-framework', user?.id],
    enabled: !!user,
    staleTime: 300_000,
    queryFn: async (): Promise<ClientFramework | null> => {
      const { data } = await (supabase as any)
        .from('client_framework_agreements')
        .select('id, agreement_number, status, package_key, pricing_snapshot, package_selected_at, countersigned_at, organization_id')
        .eq('status', 'active');
      const rows = ((data ?? []) as any[]).filter((r) => r.package_key);
      const rv = rows.find((r) => r.organization_id) ?? rows[0];
      if (!rv) return null;
      return {
        id: rv.id,
        agreement_number: rv.agreement_number,
        package_key: rv.package_key,
        fee_percent: Number(rv.pricing_snapshot?.clientFeePct ?? 0),
        name: rv.pricing_snapshot?.publicName ?? rv.package_key,
        continuity_days: rv.pricing_snapshot?.continuityDays ?? null,
        agreed_at: rv.package_selected_at ?? rv.countersigned_at ?? null,
      };
    },
  });

  const { data: packages = [] } = useQuery({
    queryKey: ['client-intake-packages'],
    staleTime: 600_000,
    queryFn: async (): Promise<PublicPackage[]> => {
      const { data } = await (supabase as any)
        .from('commercial_packages_public')
        .select('package_key, version, public_name, summary, bullets, sort_order, client_fee_pct, continuity_days, claim_notice_days')
        .order('sort_order', { ascending: true });
      return (data ?? []) as PublicPackage[];
    },
  });

  // Die Firma kommt aus dem Konto und ueberschreibt, was ein Entwurf mitbringt:
  // ein verifizierter Kunde traegt sie nicht je Position neu ein.
  useEffect(() => {
    if (!firma) return;
    setCompany({
      company_name: firma.company_name || firma.legal_name,
      company_legal_name: firma.legal_name,
      company_website: firma.website,
      company_industry: firma.industry,
      company_street: firma.street,
      company_postal_code: firma.postal_code,
      company_city: firma.city,
      company_vat_id: firma.vat_id,
      company_registration_number: firma.registration_number,
    });
  }, [firma]);

  // ---- Entwurf laden (Fortsetzen) -----------------------------------------

  useEffect(() => {
    if (!jobIdParam || !user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', jobIdParam).maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLoadError('Dieser Entwurf konnte nicht geladen werden.');
        setCapture(emptyCapture('full-time'));
        return;
      }
      const row = data as Record<string, any>;
      statusRef.current = row.status ?? 'draft';
      setStatus(statusRef.current);
      const ds = row.intake_payload?.draft_state;
      const type = (ds?.type ?? row.employment_type) === 'freelance' ? 'freelance' : 'full-time';
      const base = emptyCapture(type);
      setCapture(
        ds
          ? {
              type,
              built: ds.built ?? null,
              answers: ds.answers ?? {},
              dyn: { ...base.dyn, ...(ds.dyn ?? {}), available: null, tensionFlags: [] },
              freelance: ds.freelance ?? base.freelance,
              flexibility: ds.flexibility ?? {},
              revealSetup: ds.revealSetup ?? base.revealSetup,
            }
          : base,
      );
    })();
    return () => { cancelled = true; };
  }, [jobIdParam, user]);

  // ---- Speichern -----------------------------------------------------------

  const buildRow = useCallback(
    (c: CaptureState, co: Partial<CompanyDraft>, extra?: Record<string, unknown>) => {
      if (!c.built) return null;
      const intakePayload = buildIntakePayload({
        source: 'studio',
        state: {
          type: c.type, built: c.built, answers: c.answers, freelance: c.freelance,
          flexibility: c.flexibility, revealSetup: c.revealSetup, dyn: c.dyn,
        },
        briefingText: captureBriefingText(c.answers),
      });
      const row = draftToJobRow({
        contract_type: c.type,
        title: c.built.title,
        built: c.built,
        dyn: c.dyn,
        answers: c.answers,
        freelance: c.freelance,
        flexibility: c.flexibility,
        reveal_setup: c.revealSetup,
        skill_requirements: c.dyn.skillRequirements,
        company_name: co.company_name,
        company_legal_name: co.company_legal_name,
        company_industry: co.company_industry,
        intake_payload: intakePayload,
      } as any) as Record<string, any>;
      row.intake_payload = {
        ...(row.intake_payload ?? {}),
        source: 'dashboard_intake',
        company: co,
        // Anders als beim Link bleibt der Zustand in der Stelle: sie IST hier
        // der Entwurf, und HR setzt eine zur Freigabe geschickte Aufnahme fort.
        draft_state: {
          type: c.type, built: c.built, answers: c.answers, freelance: c.freelance,
          flexibility: c.flexibility, revealSetup: c.revealSetup, dyn: { ...c.dyn, tensionFlags: [] },
        },
        ...(extra ?? {}),
      };
      return row;
    },
    [],
  );

  const persist = useCallback(
    async (status: string, extra?: Record<string, unknown>) => {
      const c = captureRef.current;
      if (!c?.built?.title?.trim() || !user) return { id: jobIdRef.current, error: null };
      const row = buildRow(c, companyRef.current, extra);
      if (!row) return { id: jobIdRef.current, error: null };
      const full = { ...row, status, ...(jobIdRef.current ? {} : { client_id: user.id }) };
      const res = await writeJob(jobIdRef.current, full);
      if (res.id && !jobIdRef.current) {
        jobIdRef.current = res.id;
        setJobId(res.id);
        // Den Query-Teil behalten (z. B. ?vorschau=rv), sonst faellt er beim
        // naechsten Neuladen weg.
        window.history.replaceState(window.history.state, '', `/dashboard/aufnahme/${res.id}${window.location.search}`);
      }
      return res;
    },
    [buildRow, user],
  );

  const saveDraft = useCallback(async () => {
    if (inFlight.current) await inFlight.current;
    if (!dirty.current) return true;
    dirty.current = false;
    setSaving(true);
    const p = persist(statusRef.current);
    inFlight.current = p;
    const res = await p;
    inFlight.current = null;
    setSaving(false);
    if (res.error) {
      dirty.current = true;
      setSaveError('Speichern fehlgeschlagen.');
      console.error('[useClientIntake] Speichern:', res.error);
      return false;
    }
    setSaveError(null);
    // "Gespeichert" nur, wenn es eine Zeile gibt. Ohne Titel wird nichts
    // geschrieben -- vorher stand trotzdem "Gespeichert" da.
    if (res.id) setLastSavedAt(new Date());
    return true;
  }, [persist]);

  // Fortlaufend sichern, 1,5 s nach der letzten Aenderung.
  useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(() => { void saveDraft(); }, 1500);
    return () => window.clearTimeout(t);
  }, [capture, company, saveDraft]);

  const updateCapture = useCallback((updater: (prev: CaptureState) => CaptureState) => {
    setCapture((prev) => {
      if (!prev) return prev;
      dirty.current = true;
      return updater(prev);
    });
  }, []);

  const updateCompany = useCallback((patch: Partial<CompanyDraft>) => {
    dirty.current = true;
    setCompany((c) => ({ ...c, ...patch }));
  }, []);

  // ---- Gleichnamiger Entwurf -------------------------------------------------
  /**
   * Wer dieselbe Anzeige zweimal einliest, bekommt zwei Entwuerfe -- im Test
   * stand "Leiter Instandhaltung" dreimal unter "Weitermachen". Nur bei einer
   * NEUEN Aufnahme gefragt; wer einen Entwurf fortsetzt, weiss, welchen.
   */
  const titel = capture?.built?.title?.trim() ?? '';
  const [doppeltVerworfen, setDoppeltVerworfen] = useState(false);
  const { data: doppelt = null } = useQuery({
    queryKey: ['client-intake-doppelt', user?.id, titel, jobIdParam ?? null],
    enabled: !!user && !jobIdParam && titel.length > 2,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('jobs')
        .select('id, updated_at')
        .eq('status', 'draft')
        .eq('title', titel)
        .order('updated_at', { ascending: false })
        .limit(3);
      const andere = ((data ?? []) as { id: string; updated_at: string }[])
        .filter((r) => r.id !== jobIdRef.current);
      return andere[0] ?? null;
    },
  });

  /** Zum vorhandenen Entwurf wechseln -- der gerade angelegte faellt weg. */
  const zumVorhandenen = useCallback(async () => {
    if (!doppelt) return null;
    if (jobIdRef.current && statusRef.current === 'draft') {
      await supabase.from('jobs').delete().eq('id', jobIdRef.current).eq('status', 'draft');
    }
    dirty.current = false;
    return doppelt.id;
  }, [doppelt]);

  // ---- KI und Parser: dieselben Functions, mit dem JWT des Kunden ----------

  const fail = (message: string): IntakeFailure => ({ reason: 'invalid_request' as any, message });

  const askAi = useCallback(async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('intake-questions', { body: payload });
    if (error) throw error;
    return data as Record<string, any>;
  }, []);

  const parseText = useCallback(async (jobText: string) => {
    const { data, error } = await supabase.functions.invoke('parse-job-url', { body: { jobText } });
    if (error) return fail('Die Anzeige konnte gerade nicht gelesen werden.');
    return data;
  }, []);

  const parseUrl = useCallback(async (jobUrl: string) => {
    const { data, error } = await supabase.functions.invoke('parse-job-url', { body: { jobUrl } });
    if (error) return fail('Der Link konnte nicht gelesen werden. Fügen Sie den Text der Anzeige ein.');
    return data;
  }, []);

  const parsePdf = useCallback(async (file: File) => {
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.pdf`;
    const up = await supabase.storage.from('job-documents').upload(path, file);
    if (up.error) return fail('Die Datei konnte nicht hochgeladen werden.');
    const { data, error } = await supabase.functions.invoke('parse-job-pdf', { body: { pdfPath: path } });
    if (error) return fail('Die PDF konnte nicht gelesen werden. Fügen Sie den Text ein.');
    return data;
  }, []);

  const enrichCompany = useCallback(async (domain?: string): Promise<Anreicherung | IntakeFailure> => {
    const d = domain || companyRef.current.company_website;
    if (!d) return fail('Keine Website hinterlegt.');
    const { data, error } = await supabase.functions.invoke('enrich-company-from-domain', { body: { domain: d } });
    if (error) return fail('Die Website konnte nicht gelesen werden.');
    return ((data as any)?.data ?? {}) as Anreicherung;
  }, []);

  // ---- Einreichen ----------------------------------------------------------

  const submit = useCallback(
    async (choice: CommercialChoice | null) => {
      if (!user) return { ok: false as const, message: 'Nicht angemeldet.' };
      const t = target ?? (await resolveIntakeSubmitTarget(user.id));
      const commercial = choice
        ? {
            commercial: {
              framework_agreement_id: framework?.id ?? null,
              agreement_number: framework?.agreement_number ?? null,
              framework_package_key: framework?.package_key ?? null,
              package_key: choice.package_key,
              upgraded: choice.upgraded,
              confirmed_at: new Date().toISOString(),
              confirmed_by_user_id: user.id,
              // Bis create_position_snapshot existiert, ist das hier die einzige
              // Stelle, an der die Kondition der Position steht.
              provisional: true,
            },
          }
        : undefined;
      if (inFlight.current) await inFlight.current;
      const res = await persist(t.status, commercial);
      if (res.error || !res.id) {
        const msg = String((res.error as any)?.message ?? '');
        return {
          ok: false as const,
          message: /row-level security|permission/i.test(msg)
            ? 'Ihre Rolle darf keine Positionen einreichen. Bitte wenden Sie sich an Ihren Admin.'
            : 'Die Position konnte nicht eingereicht werden.',
        };
      }
      dirty.current = false;
      statusRef.current = t.status;
      setStatus(t.status);
      // Kriterien fuer den Matcher, wie im alten Studio.
      const reqs = captureRef.current?.dyn.skillRequirements ?? [];
      if (reqs.length) {
        const seen = new Set<string>();
        const rows = reqs
          .filter((s) => s.skill && !seen.has(s.skill.toLowerCase()) && seen.add(s.skill.toLowerCase()))
          .map((s) => ({ job_id: res.id, skill_name: s.skill, type: s.kind, weight: s.kind === 'must' ? 1.0 : 0.5 }));
        await supabase.from('job_skill_requirements').upsert(rows as any, { onConflict: 'job_id,skill_name', ignoreDuplicates: true });
      }
      if (t.status === 'pending_client_approval' && t.organizationId) {
        await notifyApproversOfIntake(t.organizationId, res.id, captureRef.current?.built?.title ?? 'Position', user.id);
      }
      return { ok: true as const, jobId: res.id, status: t.status };
    },
    [user, target, framework, persist],
  );

  return {
    doppelt: doppeltVerworfen ? null : doppelt,
    verwerfeDoppelt: () => setDoppeltVerworfen(true),
    zumVorhandenen,
    capture, company, jobId, status, saving, lastSavedAt, saveError, loadError,
    profile, target, framework, frameworkLoading, packages,
    /** Feste Firmenzeile, wenn das Konto vollstaendige Firmendaten hat. */
    firmaFest: firma && firmendatenVollstaendig(firma)
      ? {
          zeile: [firma.legal_name, joinAddress(firma), firma.registration_number, firma.vat_id].filter(Boolean).join(' · '),
          verifiziertAm: firma.verified_at,
        }
      : null,
    updateCapture, updateCompany, saveDraft, submit,
    askAi, parseText, parseUrl, parsePdf, enrichCompany,
  };
}
