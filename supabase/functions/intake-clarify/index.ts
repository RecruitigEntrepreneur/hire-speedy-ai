import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { generateToken, hashToken, hashKey } from '../_shared/tokens.ts';
import { serviceClient, logEvent, touchDraft, inDays } from '../_shared/intake-core.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';
import { intakeClarifyUrl } from '../_shared/app-url.ts';

/**
 * intake-clarify — Rueckfragen des Admins an den Kunden.
 *
 * Die Aktionen 'ask', 'list' und 'resolve' verlangen Admin-Rechte. 'open' und
 * 'answer' laufen ohne Login ueber den Rueckfrage-Token.
 *
 * Der Antwortlink hat ENGEN UMFANG: er gibt die Felder aus scope_fields frei,
 * nicht den gesamten Entwurf. Das ist der Unterschied zu einem
 * Fortsetzungs-Token -- eine Rueckfrage zur Umsatzsteuernummer soll nicht das
 * Gehaltsband wieder aufmachen.
 *
 * Vom Token wird nur der Hash gespeichert, wie ueberall in der Aufnahme. Wer
 * die Datenbank liest, kann damit keine Rueckfrage oeffnen.
 *
 * verify_jwt bleibt aus, weil der Kunde keinen Login hat. Die Admin-Aktionen
 * pruefen die Rolle deshalb selbst und serverseitig.
 */

const CLARIFY_DAYS = 14;

/** Nur diese Felder darf eine Rueckfrage freigeben. Alles andere ist entweder
 *  unser Innenleben oder gehoert in eine neue Aufnahme. */
const ERLAUBTE_FELDER = new Set([
  'company_legal_name', 'company_street', 'company_postal_code', 'company_city',
  'company_country', 'company_vat_id', 'company_registration_number',
  'company_website', 'company_industry', 'company_size',
  'contact_name', 'contact_phone', 'contact_role', 'billing_email',
]);

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const supabase = serviceClient();
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;

    // ======================================================================
    // Admin: Rueckfrage stellen
    // ======================================================================
    if (action === 'ask') {
      const admin = await requireAdmin(req, supabase);
      if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');

      const draftId = String(body?.draft_id ?? '');
      const question = String(body?.question ?? '').trim().slice(0, 2000);
      if (!draftId || !question) return fail('invalid_request', 'draft_id und question sind erforderlich.');

      const scope = (Array.isArray(body?.scope_fields) ? body.scope_fields : [])
        .map((f: unknown) => String(f))
        .filter((f: string) => ERLAUBTE_FELDER.has(f));

      const { data: draft } = await supabase
        .from('intake_drafts').select('*').eq('id', draftId).maybeSingle();
      if (!draft) return fail('not_found', 'Die Aufnahme wurde nicht gefunden.');
      if (!draft.contact_email) {
        return fail('conflict', 'Ohne Kontakt-E-Mail lässt sich keine Rückfrage stellen.');
      }

      const token = generateToken();
      const { data: rf, error } = await supabase.from('intake_clarifications').insert({
        draft_id: draft.id,
        question,
        scope_fields: scope,
        token_hash: await hashToken(token),
        expires_at: inDays(CLARIFY_DAYS),
        asked_by: admin.userId!,
      }).select('*').single();
      if (error) return fail('internal_error', error.message);

      // Der Entwurf geht auf 'changes_requested'. Damit taucht er in der
      // Nachfassliste auf statt in der Pruefliste zu bleiben -- sonst wartet
      // der Admin auf sich selbst.
      await touchDraft(supabase, draft.id, { review_state: 'changes_requested' });

      const url = intakeClarifyUrl(token);
      const mail = await sendIntakeMail(supabase, {
        to: draft.contact_email,
        subject: 'Rückfrage zu Ihrer Anfrage',
        template: 'intake_clarification',
        meta: { draft_id: draft.id, clarification_id: rf.id },
        html: layout({
          heading: 'Eine kurze Rückfrage',
          body: `
            <p style="margin:0 0 16px 0;">Guten Tag ${esc(draft.contact_name ?? '')},</p>
            <p style="margin:0 0 16px 0;">
              zu Ihrer Anfrage für <strong>${esc(draft.title ?? 'die Position')}</strong>
              haben wir eine Rückfrage:
            </p>
            <blockquote style="margin:0 0 20px 0;padding:12px 16px;border-left:3px solid #d1d5db;color:#374151;">
              ${esc(question)}
            </blockquote>
            <p style="margin:0 0 24px 0;">
              Über den folgenden Link können Sie direkt antworten. Er ist
              ${CLARIFY_DAYS} Tage gültig und öffnet ausschließlich diese Rückfrage.
            </p>`,
          cta: { label: 'Rückfrage beantworten', url },
        }),
      });

      await logEvent(supabase, {
        type: 'clarification_requested', linkId: draft.link_id, draftId: draft.id,
        actorUserId: admin.userId, meta: { scope, mail_sent: mail.sent },
      });

      // Der Link kommt im Ergebnis zurueck: scheitert der Mailversand, kann der
      // Admin ihn selbst weitergeben, statt vor einer stummen Rueckfrage zu
      // sitzen. Das ist die einzige Stelle, an der das Klartext-Token
      // ueberhaupt existiert.
      return json({
        ok: true,
        clarification: { id: rf.id, question: rf.question, scope_fields: rf.scope_fields,
                         expires_at: rf.expires_at },
        url,
        mail_sent: mail.sent,
        mail_error: mail.sent ? null : mail.error ?? null,
      });
    }

    // ======================================================================
    // Admin: als erledigt markieren
    // ======================================================================
    if (action === 'resolve') {
      const admin = await requireAdmin(req, supabase);
      if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');

      const { data, error } = await supabase.from('intake_clarifications')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(),
                  resolved_by: admin.userId! })
        .eq('id', String(body?.id ?? '')).select('*').single();
      if (error) return fail('conflict', error.message);
      return json({ ok: true, clarification: data });
    }

    if (action === 'withdraw') {
      const admin = await requireAdmin(req, supabase);
      if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
      const { data, error } = await supabase.from('intake_clarifications')
        .update({ status: 'withdrawn' }).eq('id', String(body?.id ?? '')).select('*').single();
      if (error) return fail('conflict', error.message);
      return json({ ok: true, clarification: data });
    }

    // ======================================================================
    // Gast: Rueckfrage oeffnen
    // ======================================================================
    if (action === 'open' || action === 'answer') {
      const token = String(body?.token ?? '');
      if (!token) return fail('invalid_request', 'Der Link ist unvollständig.');

      const { data: rf } = await supabase.from('intake_clarifications')
        .select('*').eq('token_hash', await hashToken(token)).maybeSingle();

      // Bewusst dieselbe Meldung fuer "gibt es nicht" und "abgelaufen": ein
      // Unterschied waere ein Orakel, mit dem sich gueltige Token erraten
      // liessen.
      if (!rf) return fail('not_found', 'Dieser Link ist nicht mehr gültig.');
      if (new Date(rf.expires_at) < new Date()) {
        if (rf.status === 'open') {
          await supabase.from('intake_clarifications').update({ status: 'expired' }).eq('id', rf.id);
        }
        return fail('expired', 'Dieser Link ist abgelaufen. Bitte wenden Sie sich an Ihren Ansprechpartner.');
      }
      if (['withdrawn', 'resolved'].includes(rf.status)) {
        return fail('conflict', 'Diese Rückfrage ist bereits erledigt.');
      }

      const { data: draft } = await supabase.from('intake_drafts')
        .select('*').eq('id', rf.draft_id).maybeSingle();
      if (!draft) return fail('not_found', 'Dieser Link ist nicht mehr gültig.');

      // Nur die Felder im Umfang. Der Rest des Entwurfs verlaesst den Server
      // nicht -- der Link oeffnet die Rueckfrage, nicht die Aufnahme.
      const felder: Record<string, unknown> = {};
      for (const f of rf.scope_fields ?? []) {
        if (ERLAUBTE_FELDER.has(f)) felder[f] = draft[f] ?? null;
      }

      if (action === 'open') {
        if (!rf.opened_at) {
          await supabase.from('intake_clarifications')
            .update({ opened_at: new Date().toISOString() }).eq('id', rf.id);
        }
        return json({
          clarification: {
            id: rf.id, question: rf.question, scope_fields: rf.scope_fields,
            status: rf.status, answer: rf.answer, expires_at: rf.expires_at,
          },
          fields: felder,
          position: { title: draft.title, company: draft.company_name },
        });
      }

      // ---- answer ----------------------------------------------------------
      const answer = String(body?.answer ?? '').trim().slice(0, 4000);
      if (!answer) return fail('invalid_request', 'Bitte geben Sie eine Antwort ein.');

      // Feldkorrekturen, aber nur innerhalb des Umfangs.
      const updates: Record<string, unknown> = {};
      const eingereicht = (body?.fields ?? {}) as Record<string, unknown>;
      for (const [k, v] of Object.entries(eingereicht)) {
        if ((rf.scope_fields ?? []).includes(k) && ERLAUBTE_FELDER.has(k)) {
          updates[k] = typeof v === 'string' ? v.trim().slice(0, 300) || null : null;
        }
      }
      if (Object.keys(updates).length) {
        await touchDraft(supabase, draft.id, updates);
        // Geaenderte Firmenangaben entwerten die bisherige Pruefung.
        if (Object.keys(updates).some((k) => k.startsWith('company_'))) {
          await touchDraft(supabase, draft.id, { company_state: 'not_checked' });
        }
      }

      const { data: updated, error } = await supabase.from('intake_clarifications')
        .update({ status: 'answered', answer, answered_at: new Date().toISOString() })
        .eq('id', rf.id).select('*').single();
      if (error) return fail('internal_error', error.message);

      await logEvent(supabase, {
        type: 'clarification_answered', linkId: draft.link_id, draftId: draft.id, ipHash,
        meta: { fields_changed: Object.keys(updates) },
      });

      return json({ ok: true, clarification: { id: updated.id, status: updated.status } });
    }

    return fail('invalid_request', `Unbekannte Aktion "${action}".`);
  } catch (e) {
    console.error('[intake-clarify]', e);
    return fail('internal_error', 'Die Rückfrage konnte nicht verarbeitet werden.');
  }
});
