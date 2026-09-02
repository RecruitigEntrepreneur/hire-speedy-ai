import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { serviceClient, touchDraft, logEvent } from '../_shared/intake-core.ts';
import { requireAdmin, isServiceRole } from '../_shared/admin-auth.ts';
import { normalizeDomain, domainFromEmail, isFreemailDomain } from '../_shared/domain.ts';

/**
 * verify-company — automatisierte Pruefung der Firmen- und Kontaktangaben.
 *
 * Liefert einen BERICHT, keine Entscheidung: Ergebnisse, Abweichungen,
 * Quellen, Risikohinweise und eine Empfehlung. Ueber die Annahme entscheidet
 * ein Mensch. Deshalb setzt diese Funktion company_state hoechstens auf
 * 'verified' oder 'needs_review' -- nie auf 'angenommen', und ein 'failed'
 * blockiert die Aufnahme nicht, es markiert sie.
 *
 * Reihenfolge mit Absicht: erst die pruefbaren Fakten, dann das Modell. Ob
 * die Absenderdomain zur Firmendomain passt, ob die USt-IdNr. dem Muster
 * ihres Landes entspricht, ob eine Freemail-Adresse verwendet wurde -- das
 * sind Fragen mit einer richtigen Antwort. Ein Sprachmodell danach zu fragen
 * hiesse, eine sichere Antwort gegen eine wahrscheinliche zu tauschen.
 *
 * An das Modell gehen ausschliesslich FIRMENDATEN. Name, Telefonnummer und
 * Adresse der Kontaktperson bleiben hier -- sie tragen zur Pruefung der Firma
 * nichts bei, und was nicht gesendet wird, kann auch nicht abfliessen.
 */

/** USt-IdNr.-Muster der EU-Laender. Quelle: EU-Kommission, Stand 2026. */
const VAT_PATTERNS: Record<string, RegExp> = {
  DE: /^DE\d{9}$/,               AT: /^ATU\d{8}$/,
  CH: /^CHE\d{9}(MWST|TVA|IVA)?$/, NL: /^NL\d{9}B\d{2}$/,
  FR: /^FR[A-Z0-9]{2}\d{9}$/,    IT: /^IT\d{11}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, BE: /^BE0?\d{9,10}$/,
  PL: /^PL\d{10}$/,              CZ: /^CZ\d{8,10}$/,
  DK: /^DK\d{8}$/,               SE: /^SE\d{12}$/,
  LU: /^LU\d{8}$/,               IE: /^IE\d[A-Z0-9+*]\d{5}[A-Z]{1,2}$/,
};

type Severity = 'info' | 'warning' | 'critical';
interface Deviation { field: string; claimed: string | null; found: string | null; severity: Severity; note: string }

/** Die Pruefungen, die eine richtige Antwort haben. */
function factualChecks(d: Record<string, any>): { deviations: Deviation[]; findings: Record<string, unknown> } {
  const deviations: Deviation[] = [];
  const findings: Record<string, unknown> = {};

  const emailDomain = domainFromEmail(d.contact_email);
  const companyDomain = normalizeDomain(d.company_domain ?? d.company_website);
  findings.email_domain = emailDomain;
  findings.company_domain = companyDomain;

  // (a) Absenderdomain gegen Firmendomain.
  if (emailDomain && isFreemailDomain(emailDomain)) {
    findings.freemail = true;
    deviations.push({
      field: 'contact_email', claimed: emailDomain, found: null, severity: 'warning',
      note: 'Freemail-Adresse statt Firmendomain. Die Zugehoerigkeit zur Firma ist damit nicht belegt.',
    });
  } else if (emailDomain && companyDomain && emailDomain !== companyDomain) {
    // Subdomains und Laenderdomains desselben Hauses sind kein Widerspruch.
    const sameRoot = emailDomain.endsWith(`.${companyDomain}`) || companyDomain.endsWith(`.${emailDomain}`);
    if (!sameRoot) {
      deviations.push({
        field: 'contact_email', claimed: emailDomain, found: companyDomain, severity: 'warning',
        note: 'Die Absenderdomain stimmt nicht mit der angegebenen Firmendomain ueberein.',
      });
    }
  }

  // (b) USt-IdNr. gegen das Muster ihres Landes.
  const vat = String(d.company_vat_id ?? '').toUpperCase().replace(/[\s.-]/g, '');
  if (vat) {
    findings.vat_normalized = vat;
    const land = vat.slice(0, 2);
    const muster = VAT_PATTERNS[land];
    if (!muster) {
      deviations.push({
        field: 'company_vat_id', claimed: vat, found: null, severity: 'info',
        note: `Fuer das Laenderkuerzel ${land} liegt kein Pruefmuster vor.`,
      });
    } else if (!muster.test(vat)) {
      deviations.push({
        // Ein Formatfehler ist ein Tippfehler, kein Widerspruch. 'critical'
        // hiess frueher: der Vertrag geht nicht raus -- fuer eine vertippte
        // Ziffer war das eine Sackgasse.
        field: 'company_vat_id', claimed: vat, found: null, severity: 'warning',
        note: `Die USt-IdNr. entspricht nicht dem Muster fuer ${land}. Bitte pruefen.`,
      });
    } else {
      findings.vat_format_ok = true;
    }
  }

  // (c) Handelsregisternummer, grobe Form.
  const reg = String(d.company_registration_number ?? '').trim();
  if (reg) {
    findings.registration_number = reg;
    if (!/\d/.test(reg)) {
      deviations.push({
        field: 'company_registration_number', claimed: reg, found: null, severity: 'warning',
        note: 'Die Registernummer enthaelt keine Ziffern.',
      });
    }
  }

  // (d) Vollstaendigkeit der Anschrift.
  const fehlend = ['company_legal_name', 'company_street', 'company_postal_code', 'company_city']
    .filter((f) => !String(d[f] ?? '').trim());
  if (fehlend.length) {
    findings.missing_fields = fehlend;
    deviations.push({
      field: fehlend.join(', '), claimed: null, found: null, severity: 'warning',
      note: 'Angaben zur Firmenanschrift fehlen.',
    });
  }

  return { deviations, findings };
}

/** Was das Modell beitragen kann: existiert die Firma, passt das Bild? */
async function modelCheck(firma: Record<string, unknown>): Promise<{
  summary: string; sources: unknown[]; risk_notes: unknown[];
  model_deviations: Deviation[]; confidence: number | null; model: string | null; error: string | null;
}> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  const leer = { summary: '', sources: [], risk_notes: [], model_deviations: [], confidence: null, model: null };
  if (!key) return { ...leer, error: 'LOVABLE_API_KEY ist nicht gesetzt.' };

  const prompt = `Du pruefst die Angaben eines Unternehmens, das sich fuer eine Zusammenarbeit beworben hat.

Angaben:
${JSON.stringify(firma, null, 2)}

Beurteile ausschliesslich anhand dessen, was du ueber das Unternehmen weisst:
1. Existiert ein Unternehmen dieses Namens an dieser Anschrift plausibel?
2. Passen Rechtsform, Registernummer und Anschrift zueinander?
3. Passt die Branche zur Domain und zum Namen?
4. Gibt es Hinweise auf ein Risiko (Insolvenz, Namensgleichheit mit bekannten
   Betrugsfaellen, Briefkastenadresse, sehr junge Gruendung)?

Antworte NUR mit JSON in genau dieser Form:
{
  "summary": "zwei bis drei Saetze auf Deutsch",
  "deviations": [{"field":"...","claimed":"...","found":"...","severity":"info|warning|critical","note":"..."}],
  "risk_notes": [{"topic":"...","note":"...","severity":"info|warning|critical"}],
  "sources": [{"source":"...","note":"..."}],
  "confidence": 0.0
}

Wichtig: Wenn du etwas nicht weisst, schreibe es in "risk_notes" statt zu raten.
Erfinde keine Registernummern, keine Umsaetze und keine Quellen. Eine erfundene
Quelle ist schaedlicher als eine fehlende.`;

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      return { ...leer, error: `Gateway antwortete ${res.status}.` };
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, ''));

    return {
      summary: String(parsed.summary ?? ''),
      sources: Array.isArray(parsed.sources) ? parsed.sources.slice(0, 10) : [],
      risk_notes: Array.isArray(parsed.risk_notes) ? parsed.risk_notes.slice(0, 10) : [],
      model_deviations: Array.isArray(parsed.deviations) ? parsed.deviations.slice(0, 10) : [],
      confidence: typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence)) : null,
      model: 'google/gemini-2.5-flash',
      error: null,
    };
  } catch (e) {
    return { ...leer, error: `Die Pruefung schlug fehl: ${e instanceof Error ? e.message : String(e)}` };
  }
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const supabase = serviceClient();

    // `verify_jwt = true` genuegt hier NICHT: der publishable Key ist selbst
    // ein gueltiges JWT und liegt in jedem Browser. Ohne diese Pruefung koennte
    // jeder mit dem oeffentlichen Schluessel Pruefungen auf fremden Aufnahmen
    // ausloesen -- und am Unterschied zwischen 404 und 200 ablesen, welche
    // draft_id existiert.
    //
    // Zwei Aufrufer sind vorgesehen: unser eigenes Backend (intake-verify-email
    // stoesst die Pruefung nach der Bestaetigung an) und ein angemeldeter Admin.
    if (!isServiceRole(req)) {
      const admin = await requireAdmin(req, supabase);
      if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
    }

    const body = await req.json().catch(() => ({}));
    const draftId = String(body?.draft_id ?? '');
    if (!draftId) return fail('invalid_request', 'draft_id fehlt.');
    const { data: draft } = await supabase.from('intake_drafts').select('*').eq('id', draftId).maybeSingle();
    if (!draft) return fail('not_found', 'Die Aufnahme wurde nicht gefunden.');

    await touchDraft(supabase, draft.id, { company_state: 'checking' });
    await logEvent(supabase, {
      type: 'company_check_started', linkId: draft.link_id, draftId: draft.id,
      meta: { company: draft.company_name },
    });

    const begonnen = Date.now();
    const { deviations, findings } = factualChecks(draft);

    // Nur Firmendaten an das Modell. Kontaktperson bleibt hier.
    const firma = {
      name: draft.company_name,
      legal_name: draft.company_legal_name,
      website: draft.company_website,
      domain: draft.company_domain,
      street: draft.company_street,
      postal_code: draft.company_postal_code,
      city: draft.company_city,
      country: draft.company_country,
      vat_id: draft.company_vat_id,
      registration_number: draft.company_registration_number,
      industry: draft.company_industry,
      size: draft.company_size,
    };
    const m = await modelCheck(firma);

    // Das Modell darf WARNEN, nicht entscheiden. Eine Einschaetzung wie
    // "kein Unternehmen dieses Namens gefunden" ist ein Hinweis, kein Beweis --
    // kleine Firmen, junge Gruendungen und Umfirmierungen sehen genauso aus.
    // Frueher setzte ein 'critical' des Modells den Zustand auf 'failed' und
    // blockierte damit den Vertragsversand.
    const modell = m.model_deviations.map((d) => ({
      ...d,
      severity: d.severity === 'critical' ? ('warning' as Severity) : d.severity,
    }));
    const alle = [...deviations, ...modell];
    const kritisch = alle.filter((d) => d.severity === 'critical').length;
    const warnungen = alle.filter((d) => d.severity === 'warning').length;

    // Die Empfehlung folgt aus den Funden, nicht aus dem Gefuehl des Modells.
    const empfehlung: 'accept' | 'review' | 'reject' =
      kritisch > 0 ? 'reject' : warnungen > 0 || m.error ? 'review' : 'accept';

    // Der Zustand ist absichtlich milder als die Empfehlung: eine automatische
    // Pruefung lehnt nichts endgueltig ab. 'failed' heisst "sieh genau hin",
    // nicht "abgelehnt".
    const zustand = empfehlung === 'accept' ? 'verified'
                  : empfehlung === 'reject' ? 'failed' : 'needs_review';

    const { data: report } = await supabase.from('company_verification_reports').insert({
      draft_id: draft.id,
      claimed: firma,
      findings,
      sources: m.sources,
      deviations: alle,
      risk_notes: m.risk_notes,
      recommendation: empfehlung,
      confidence: m.confidence,
      summary: m.summary || (m.error ? `Automatische Pruefung unvollstaendig: ${m.error}` : null),
      model: m.model,
      prompt_version: 'company-verify-1',
      duration_ms: Date.now() - begonnen,
      error: m.error,
    }).select('id').single();

    await touchDraft(supabase, draft.id, {
      company_state: zustand,
      company_checked_at: new Date().toISOString(),
    });

    await logEvent(supabase, {
      type: zustand === 'verified' ? 'company_verified'
          : zustand === 'failed' ? 'company_failed' : 'company_needs_review',
      linkId: draft.link_id, draftId: draft.id,
      meta: { recommendation: empfehlung, critical: kritisch, warnings: warnungen },
    });

    return json({
      ok: true,
      report_id: report?.id ?? null,
      company_state: zustand,
      recommendation: empfehlung,
      deviations: alle.length,
      critical: kritisch,
    });
  } catch (e) {
    console.error('[verify-company]', e);
    return fail('internal_error', 'Die Firmenpruefung konnte nicht durchgefuehrt werden.');
  }
});
