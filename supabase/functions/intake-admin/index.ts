import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { contentHash } from '../_shared/tokens.ts';
import { isPlausibleEmail } from '../_shared/domain.ts';
import { serviceClient, logEvent, resolveTemplate, effectiveTerms, issueDraftToken } from '../_shared/intake-core.ts';
import { draftToJobRow, draftSummary } from '../_shared/intake-mapping.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';
import { getPublicAppUrl, intakeResumeUrl } from '../_shared/app-url.ts';

/**
 * intake-admin — Pruefung, Annahme und Vertragslauf einer Beauftragungsanfrage.
 *
 * Der Vertrag wird derzeit MANUELL ueber DocuSign versendet. Diese Function
 * erzeugt die Grundlage (Vertragsdaten aus dem bestaetigten Snapshot) und
 * fuehrt den Zustand: pending -> sent -> signed. Die Zustaende sind genau die,
 * die eine spaetere DocuSign-Anbindung per Webhook setzen wuerde — der
 * Austausch des manuellen Schritts ist dann kein Umbau.
 */
serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const supabase = serviceClient();
    const admin = await requireAdmin(req, supabase);
    if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
    const adminId = admin.userId!;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const draftId = String(body?.draft_id ?? '');
    if (!draftId) return fail('invalid_request', 'draft_id fehlt.');

    const { data: draft, error: draftErr } = await supabase
      .from('intake_drafts').select('*').eq('id', draftId).maybeSingle();
    if (draftErr) return fail('internal_error', draftErr.message);
    if (!draft) return fail('not_found', 'Aufnahme nicht gefunden.');

    const summary = draftSummary(draft);

    const currentMandate = async () => {
      const { data } = await supabase
        .from('commercial_mandates')
        .select('*')
        .eq('draft_id', draftId)
        .in('status', ['client_confirmed', 'accepted', 'proposed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    };

    // ==================================================================== accept
    if (action === 'accept') {
      if (draft.review_state !== 'pending_admin') {
        return fail('conflict', `Die Aufnahme steht auf "${draft.review_state}".`);
      }

      const mandate = await currentMandate();
      if (!mandate || !mandate.client_confirmed_at) {
        return fail('conflict', 'Es liegt keine vom Kunden bestätigte Vereinbarung vor.');
      }

      // ---- Kundenkonto: bestehendes finden oder anlegen ---------------------
      // Die Adresse ist per Code verifiziert, deshalb email_confirm: true --
      // dasselbe Vorgehen wie in accept-invite/index.ts:101-112.
      let clientUserId: string | null = draft.matched_client_user_id ?? null;
      let accountCreated = false;

      if (!clientUserId) {
        const { data: profile } = await supabase
          .from('profiles').select('user_id').ilike('email', draft.contact_email).maybeSingle();
        clientUserId = profile?.user_id ?? null;
      }

      if (!clientUserId) {
        if (body?.create_account === false) {
          return fail('conflict',
            'Für diese Adresse existiert kein Konto. Ohne Konto kann keine Stelle angelegt werden.');
        }
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email: draft.contact_email,
          email_confirm: true,
          user_metadata: { full_name: draft.contact_name, role: 'client' },
        });
        if (createErr || !created?.user) {
          console.error('[intake-admin] Konto nicht angelegt:', createErr?.message);
          return fail('internal_error', `Konto konnte nicht angelegt werden: ${createErr?.message ?? 'unbekannt'}`);
        }
        clientUserId = created.user.id;
        accountCreated = true;

        // handle_new_user() vergibt die Rolle 'client'. Der Trigger kann je
        // nach Fassung ausbleiben; deshalb hier absichern -- aber nur genau
        // eine Rollenzeile, sonst liefert das maybeSingle() in
        // src/lib/auth.tsx:53-63 einen Fehler und der Login haengt.
        const { data: roles } = await supabase
          .from('user_roles').select('id, role').eq('user_id', clientUserId);
        if (!roles || roles.length === 0) {
          await supabase.from('user_roles').insert({ user_id: clientUserId, role: 'client' });
        }
        const { data: prof } = await supabase
          .from('profiles').select('id').eq('user_id', clientUserId).maybeSingle();
        if (!prof) {
          await supabase.from('profiles').insert({
            user_id: clientUserId,
            email: draft.contact_email,
            full_name: draft.contact_name,
            company_name: draft.company_name,
          });
        }
      }

      // ---- Uebergang, atomar in der Datenbank ------------------------------
      const jobRow = draftToJobRow(draft);
      const { data: jobId, error: rpcErr } = await supabase.rpc('accept_intake_draft', {
        _draft_id: draftId,
        _admin_id: adminId,
        _client_user_id: clientUserId,
        // Eine erkannte Organisation wird NUR uebernommen, wenn der Admin sie
        // ausdruecklich bestaetigt. Eine Domainuebereinstimmung allein vergibt
        // keine Rechte an einer bestehenden Organisation.
        _organization_id: body?.organization_id ?? null,
        _job: jobRow,
        _mandate_id: mandate.id,
      });

      if (rpcErr) {
        console.error('[intake-admin] accept_intake_draft:', rpcErr.message);
        return fail('internal_error', rpcErr.message);
      }

      // ---- Zugangslink ------------------------------------------------------
      // Ein serverseitig angelegtes Konto hat kein Passwort. Ohne diesen Link
      // bekaeme der Kunde eine Zusage und stuende vor einer verschlossenen Tuer:
      // im Projekt existiert keine "Passwort vergessen"-Strecke.
      let accessLink: string | null = null;
      if (accountCreated) {
        const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: draft.contact_email,
          options: { redirectTo: `${getPublicAppUrl()}/passwort` },
        });
        if (linkErr) console.warn('[intake-admin] Zugangslink nicht erzeugt:', linkErr.message);
        accessLink = linkData?.properties?.action_link ?? null;
      }

      // ---- Kunde informieren ------------------------------------------------
      const requiresSignature = mandate.signature_status !== 'not_required';
      const html = layout({
        preheader: 'Wir haben Ihre Beauftragung angenommen.',
        heading: 'Wir haben Ihren Auftrag angenommen',
        body: `
          <p style="margin:0 0 16px 0;">Guten Tag ${esc(draft.contact_name)},</p>
          <p style="margin:0 0 16px 0;">
            wir haben Ihre Anfrage für <strong>${esc(summary.title)}</strong> geprüft und angenommen.
            Vorgangsnummer <strong>${esc(mandate.mandate_number)}</strong>.
          </p>
          ${
            requiresSignature
              ? `<p style="margin:0 0 16px 0;">
                   Sie erhalten in Kürze die Vermittlungsvereinbarung zur digitalen Unterschrift.
                   Sobald sie unterzeichnet vorliegt, geben wir die Position für unsere Recruiter frei
                   und die Suche beginnt.
                 </p>`
              : `<p style="margin:0 0 16px 0;">Wir geben die Position jetzt für unsere Recruiter frei.</p>`
          }
          ${
            accountCreated
              ? `<p style="margin:0 0 16px 0;">
                   Für Sie wurde ein Zugang angelegt (${esc(draft.contact_email)}). Dort sehen Sie
                   jederzeit den Stand Ihrer Position und die eingehenden Kandidaten.
                   ${accessLink ? 'Über den Knopf unten vergeben Sie Ihr Passwort.' : 'Ihr Ansprechpartner sendet Ihnen den Zugangslink zu.'}
                 </p>`
              : ''
          }`,
        cta: accountCreated && accessLink
          ? { label: 'Zugang einrichten', url: accessLink }
          : { label: 'Zum Dashboard', url: `${getPublicAppUrl()}/auth` },
        footnote: accountCreated && accessLink
          ? 'Der Zugangslink ist aus Sicherheitsgründen nur begrenzt gültig. Ist er abgelaufen, melden Sie sich kurz bei uns — wir senden einen neuen.'
          : undefined,
      });

      await sendIntakeMail(supabase, {
        to: draft.contact_email,
        subject: `Auftrag angenommen — ${mandate.mandate_number}`,
        html,
        template: 'intake_accepted',
        meta: { draft_id: draftId, job_id: jobId, mandate_id: mandate.id },
      });

      return json({ ok: true, job_id: jobId, client_user_id: clientUserId, account_created: accountCreated });
    }

    // ================================================== reject / request_changes
    if (action === 'reject' || action === 'request_changes') {
      const reason = String(body?.reason ?? '').trim().slice(0, 2000);
      if (reason.length < 5) return fail('invalid_request', 'Bitte geben Sie einen Grund an.');

      const isReject = action === 'reject';
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('intake_drafts')
        .update({
          review_state: isReject ? 'rejected' : 'changes_requested',
          rejection_reason: reason,
          rejected_at: isReject ? now : null,
          rejected_by: isReject ? adminId : null,
          last_activity_at: now,
        })
        .eq('id', draftId);
      if (error) return fail('internal_error', error.message);

      if (isReject) {
        // Ein offenes Angebot wird zurueckgezogen, damit kein bestaetigter
        // Konditionsstand ohne Auftrag stehen bleibt.
        await supabase
          .from('commercial_mandates')
          .update({ status: 'withdrawn', declined_at: now, declined_by: adminId, decline_reason: reason })
          .eq('draft_id', draftId)
          .in('status', ['proposed', 'client_confirmed']);
      }

      // Bei Rueckfragen bekommt der Kunde einen frischen Zugang -- sein alter
      // Token kann laengst abgelaufen sein.
      let resumeUrl: string | null = null;
      if (!isReject && draft.contact_email) {
        const issued = await issueDraftToken(supabase, {
          draftId, origin: 'admin', recipientEmail: draft.contact_email,
          recipientName: draft.contact_name, createdBy: adminId,
        });
        if (!('error' in issued)) resumeUrl = intakeResumeUrl(issued.token);
      }

      if (draft.contact_email) {
        const html = layout({
          preheader: isReject ? 'Zu Ihrer Anfrage' : 'Wir haben noch eine Rückfrage.',
          heading: isReject ? 'Zu Ihrer Anfrage' : 'Eine Rückfrage zu Ihrer Anfrage',
          body: `
            <p style="margin:0 0 16px 0;">Guten Tag ${esc(draft.contact_name ?? '')},</p>
            <p style="margin:0 0 16px 0;">
              ${
                isReject
                  ? `wir können Ihre Anfrage für <strong>${esc(summary.title)}</strong> derzeit leider nicht annehmen.`
                  : `zu Ihrer Anfrage für <strong>${esc(summary.title)}</strong> haben wir noch eine Rückfrage.`
              }
            </p>
            <div style="margin:0 0 16px 0;padding:14px 16px;background:#f9fafb;border-left:3px solid #d1d5db;">${esc(reason).replace(/\n/g, '<br/>')}</div>
            ${isReject ? '<p style="margin:0;">Für Rückfragen erreichen Sie uns jederzeit über diese Adresse.</p>' : ''}`,
          cta: resumeUrl ? { label: 'Aufnahme ergänzen', url: resumeUrl } : undefined,
        });
        await sendIntakeMail(supabase, {
          to: draft.contact_email,
          subject: isReject ? 'Zu Ihrer Beauftragungsanfrage' : 'Rückfrage zu Ihrer Beauftragungsanfrage',
          html,
          template: isReject ? 'intake_rejected' : 'intake_changes_requested',
          replyTo: admin.email,
          meta: { draft_id: draftId },
        });
      }

      await logEvent(supabase, {
        type: isReject ? 'rejected' : 'changes_requested',
        linkId: draft.link_id, draftId, actorUserId: adminId, meta: { reason_length: reason.length },
      });

      return json({ ok: true, review_state: isReject ? 'rejected' : 'changes_requested' });
    }

    // ======================================================== Vertragszustand
    // ---- Vertragslauf: umgezogen nach contract-admin ------------------------
    // 'mark_contract_sent', 'mark_contract_signed' und 'propose_new_terms'
    // sind am 2026-09-02 entfallen.
    //
    // Die ersten beiden bildeten einen EINSEITIGEN Unterschriftslauf ab: ein
    // signature_status, ein Unterzeichner, kein Gegenzeichner. Seit der
    // Rahmenvertrag existiert, wird in fester Reihenfolge unterschrieben --
    // erst der Kunde, dann Matchunt -- und der Lauf umfasst zwei Dokumente
    // statt einem. Beides liegt jetzt in contract-admin.
    //
    // 'propose_new_terms' erzeugte ein Mandat mit abweichenden Prozentsaetzen.
    // Es gibt drei Pakete und keine individuellen Konditionen; der Trigger
    // commercial_mandates_check_pricing wuerde so ein Mandat ohnehin ablehnen.
    if (['mark_contract_sent', 'mark_contract_signed', 'propose_new_terms'].includes(action)) {
      return fail('gone', action === 'propose_new_terms'
        ? 'Abweichende Konditionen gibt es nicht mehr. Es stehen genau drei Pakete zur Wahl; '
          + 'der Kunde wählt sie selbst.'
        : 'Der Vertragslauf ist nach contract-admin umgezogen und läuft jetzt zweistufig '
          + '(Kunde zuerst, Matchunt zuletzt).');
    }

    if (action === 'assign_owner') {
      const owner = body?.owner_user_id ?? null;
      const { error } = await supabase
        .from('intake_drafts').update({ owner_user_id: owner }).eq('id', draftId);
      if (error) return fail('internal_error', error.message);
      if (draft.job_id) await supabase.from('jobs').update({ owner_user_id: owner }).eq('id', draft.job_id);
      return json({ ok: true });
    }

    if (action === 'link_organization') {
      // Ausdrueckliche Zuordnung zu einer bestehenden Organisation. Bewusst
      // eine Admin-Handlung: eine Domainuebereinstimmung allein darf niemandem
      // Zugriff auf die Stellen einer fremden Organisation geben.
      const orgId = body?.organization_id ?? null;
      const { error } = await supabase
        .from('intake_drafts')
        .update({ matched_organization_id: orgId, match_confidence: orgId ? 'exact_domain' : null })
        .eq('id', draftId);
      if (error) return fail('internal_error', error.message);
      return json({ ok: true });
    }

    if (action === 'note') {
      const note = String(body?.note ?? '').trim().slice(0, 4000);
      const { error } = await supabase.from('intake_drafts').update({ admin_note: note || null }).eq('id', draftId);
      if (error) return fail('internal_error', error.message);
      return json({ ok: true });
    }

    return fail('invalid_request', `Unbekannte Aktion "${action}".`);
  } catch (e) {
    console.error('[intake-admin]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});
