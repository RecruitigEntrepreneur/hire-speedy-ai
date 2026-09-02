import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { hashKey } from '../_shared/tokens.ts';
import { serviceClient, resolveDraft, touchDraft, logEvent } from '../_shared/intake-core.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';

/**
 * intake-packages — die drei Pakete zeigen und eines auswaehlen. Ohne Login.
 *
 * Loest intake-terms ab. Es gibt genau drei Pakete, keine Verhandlung, keinen
 * Slider und keinen Knopf "individuelle Konditionen anfragen". Die alte
 * Aktion request_discussion entfaellt ersatzlos.
 *
 * Die Auswahl kommt NACH der Aufnahme und nach der Firmenpruefung. Vorher
 * kennen wir die Firma nicht gut genug, um ein Angebot zu machen.
 *
 * Die Auswahl des Kunden ist sein ANGEBOT, nicht der Vertragsschluss.
 * Matchunt nimmt gesondert an und schickt danach den Vertrag zur Unterschrift.
 * Andernfalls waere Matchunt an jeden gebunden, der das Formular ausfuellt.
 *
 * Gezeigt werden ausschliesslich Honorarsatz, Dauer und Fristen. Recruiter-
 * Anteil, Marge, Einbehalt und Auslobung erreichen den Browser nie -- die
 * Funktion liest dafuer commercial_packages_public, nicht die Basistabelle.
 */

/** Bruttojahreszielgehalt aus der Aufnahme, in Cent. */
function estimateBasisCents(built: Record<string, any> | null): number | null {
  if (!built) return null;
  const c = built.compensation ?? built.salary ?? {};
  const min = Number(c.salary_min ?? c.min ?? c.annual_min ?? 0);
  const max = Number(c.salary_max ?? c.max ?? c.annual_max ?? 0);
  const mid = min && max ? Math.round((min + max) / 2) : (min || max);
  if (!mid || !Number.isFinite(mid) || mid <= 0) return null;
  // Plausibilitaet: unter 10.000 ist es eher ein Monatsgehalt oder ein Tippfehler.
  if (mid < 10_000 || mid > 10_000_000) return null;
  return Math.round(mid * 100);
}

const euros = (cents: number) => (cents / 100).toLocaleString('de-DE', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
});

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action === 'select' ? 'select' : 'get';

    const supabase = serviceClient();
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;

    const found = await resolveDraft(supabase, body?.draft_token);
    if (!found.ok) return fail(found.reason!, found.message!);
    const draft = found.draft!;

    // Die kundenseitige View. Sie fuehrt die Innenaufteilung nicht -- damit
    // kann sie hier auch nicht versehentlich mitgeschickt werden.
    const { data: packages, error } = await supabase
      .from('commercial_packages_public')
      .select('*')
      .order('sort_order');

    if (error || !packages?.length) {
      return fail('not_deployed',
        'Die Pakete sind noch nicht hinterlegt. Bitte melden Sie sich bei Ihrem Ansprechpartner.');
    }

    const basisCents = draft.estimate_basis_cents ?? estimateBasisCents(draft.built);

    const withEstimate = packages.map((p: Record<string, any>) => ({
      key: p.package_key,
      version: p.version,
      name: p.public_name,
      summary: p.summary,
      bullets: p.bullets ?? [],
      fee_percent: Number(p.client_fee_pct),
      continuity_days: p.continuity_days,
      claim_notice_days: p.claim_notice_days,
      payment_terms_days: p.payment_terms_days,
      // Unverbindliche Schaetzung. Abgerechnet wird nach dem unterzeichneten
      // Arbeitsvertrag -- das steht so auch auf der Karte.
      estimate_cents: basisCents
        ? Math.round((basisCents * Number(p.client_fee_pct)) / 100)
        : null,
      estimate_label: basisCents
        ? euros(Math.round((basisCents * Number(p.client_fee_pct)) / 100))
        : null,
    }));

    // ------------------------------------------------------------------- get
    if (action === 'get') {
      if (draft.commercial_state === 'not_started') {
        await touchDraft(supabase, draft.id, {
          commercial_state: 'presented',
          estimate_basis_cents: basisCents,
        });
        await logEvent(supabase, {
          type: 'terms_presented', linkId: draft.link_id, draftId: draft.id, ipHash,
          meta: { packages: withEstimate.length, basis_cents: basisCents },
        });
      }

      return json({
        packages: withEstimate,
        suggested_key: null,
        selected: draft.selected_package_key
          ? { key: draft.selected_package_key, version: draft.selected_package_version,
              selected_at: draft.package_selected_at }
          : null,
        basis: basisCents
          ? { cents: basisCents, label: euros(basisCents), source: 'intake_estimate' }
          : null,
        agb_url: `${getPublicAppUrl()}/agb`,
        // Was als Naechstes passiert. Steht hier und nicht erst hinterher.
        notice: 'Ihre Auswahl ist eine Anfrage, noch kein Vertrag. Wir prüfen sie '
              + 'und senden Ihnen anschließend den Vertrag zur digitalen Unterschrift. '
              + 'Erst nach beidseitiger Unterschrift starten wir die Suche.',
        estimate_notice: basisCents
          ? 'Unverbindliche Schätzung auf Basis Ihrer Gehaltsangabe. Abgerechnet wird '
          + 'nach dem Bruttojahreszielgehalt aus dem unterzeichneten Arbeitsvertrag.'
          : 'Sobald das Zielgehalt feststeht, zeigen wir Ihnen den Betrag.',
        commercial_state: draft.commercial_state === 'not_started' ? 'presented' : draft.commercial_state,
      });
    }

    // ---------------------------------------------------------------- select
    if (draft.review_state === 'accepted') {
      return fail('conflict',
        'Der Auftrag ist bereits angenommen. Bitte wenden Sie sich an Ihren Ansprechpartner.');
    }

    const key = String(body?.package_key ?? '');
    const chosen = withEstimate.find((p) => p.key === key);
    if (!chosen) {
      // Kein viertes Paket, auch nicht ueber einen manipulierten Aufruf.
      return fail('invalid_request', 'Bitte wählen Sie eines der drei angebotenen Pakete.');
    }

    await touchDraft(supabase, draft.id, {
      selected_package_key: chosen.key,
      selected_package_version: chosen.version,
      package_selected_at: new Date().toISOString(),
      estimate_basis_cents: basisCents,
      commercial_state: 'confirmed',
    });

    await logEvent(supabase, {
      type: 'terms_confirmed', linkId: draft.link_id, draftId: draft.id, ipHash,
      meta: { package_key: chosen.key, package_version: chosen.version,
              fee_percent: chosen.fee_percent, basis_cents: basisCents },
    });

    return json({
      ok: true,
      selected: { key: chosen.key, version: chosen.version, name: chosen.name },
      commercial_state: 'confirmed',
    });
  } catch (e) {
    console.error('[intake-packages]', e);
    return fail('internal_error', 'Die Pakete konnten nicht geladen werden.');
  }
});
