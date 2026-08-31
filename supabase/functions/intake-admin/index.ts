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
    if (action === 'mark_contract_sent') {
      const mandate = await currentMandate();
      if (!mandate) return fail('not_found', 'Keine Vereinbarung vorhanden.');
      if (mandate.signature_status === 'signed') {
        return fail('conflict', 'Der Vertrag ist bereits unterzeichnet.');
      }
      const { data, error } = await supabase
        .from('commercial_mandates')
        .update({
          signature_status: 'sent',
          signature_sent_at: new Date().toISOString(),
          signature_sent_by: adminId,
          signature_envelope_id: String(body?.envelope_id ?? '').trim().slice(0, 200) || null,
          signature_note: String(body?.note ?? '').trim().slice(0, 1000) || null,
        })
        .eq('id', mandate.id)
        .select('*')
        .single();
      if (error) return fail('internal_error', error.message);

      await logEvent(supabase, {
        type: 'contract_sent', linkId: draft.link_id, draftId, actorUserId: adminId,
        meta: { mandate: mandate.mandate_number, envelope: data.signature_envelope_id },
      });
      return json({ ok: true, mandate: data });
    }

    if (action === 'mark_contract_signed') {
      const mandate = await currentMandate();
      if (!mandate) return fail('not_found', 'Keine Vereinbarung vorhanden.');
      if (mandate.status !== 'accepted') {
        return fail('conflict',
          'Der Auftrag muss zuerst angenommen werden, bevor eine Unterschrift vermerkt werden kann.');
      }

      const signedAt = body?.signed_at ? new Date(body.signed_at).toISOString() : new Date().toISOString();
      const { data, error } = await supabase
        .from('commercial_mandates')
        .update({
          signature_status: 'signed',
          signature_signed_at: signedAt,
          signature_recorded_by: adminId,
          signature_signer_name: String(body?.signer_name ?? mandate.client_confirmed_name ?? '').slice(0, 120) || null,
          signature_envelope_id:
            String(body?.envelope_id ?? mandate.signature_envelope_id ?? '').trim().slice(0, 200) || null,
          signed_document_path: String(body?.document_path ?? '').trim().slice(0, 500) || null,
          signature_note: String(body?.note ?? mandate.signature_note ?? '').slice(0, 1000) || null,
        })
        .eq('id', mandate.id)
        .select('*')
        .single();
      if (error) return fail('internal_error', error.message);

      // Der Vertrag ist die Voraussetzung fuer die Veroeffentlichung. Also
      // muss der Admin es erfahren, ohne die Liste zu beobachten.
      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(10);
      const recipients = new Set<string>((admins ?? []).map((a) => a.user_id));
      if (draft.owner_user_id) recipients.add(draft.owner_user_id);
      if (recipients.size > 0 && draft.job_id) {
        await supabase.from('notifications').insert(
          [...recipients].map((user_id) => ({
            user_id,
            type: 'mandate_signed',
            title: 'Vertrag unterzeichnet — Stelle freigebbar',
            message: `${summary.company} · ${summary.title} (${mandate.mandate_number}) kann jetzt veröffentlicht werden.`,
            related_type: 'job',
            related_id: draft.job_id,
          })),
        );
      }

      await logEvent(supabase, {
        type: 'contract_signed', linkId: draft.link_id, draftId, actorUserId: adminId,
        meta: { mandate: mandate.mandate_number },
      });
      return json({ ok: true, mandate: data });
    }

    // ============================================= neue Konditionsversion
    if (action === 'propose_new_terms') {
      const previous = await currentMandate();
      if (!previous) return fail('not_found', 'Keine Vereinbarung vorhanden.');
      if (previous.signature_status === 'signed') {
        return fail('conflict',
          'Der Vertrag ist unterzeichnet. Eine Änderung erfordert eine Aufhebung außerhalb des Systems.');
      }

      let link: Record<string, any> | null = null;
      if (draft.link_id) {
        const { data } = await supabase.from('intake_links').select('*').eq('id', draft.link_id).maybeSingle();
        link = data ?? null;
      }
      const template = await resolveTemplate(supabase, body?.template_id ?? link?.terms_template_id);
      if (!template) return fail('not_found', 'Konditionsvorlage nicht gefunden.');

      const overrides = {
        fee_percentage: body?.fee_percentage != null ? Number(body.fee_percentage) : null,
        recruiter_fee_percentage:
          body?.recruiter_fee_percentage != null ? Number(body.recruiter_fee_percentage) : null,
      };

      // Auch der Admin bleibt in der veroeffentlichten Bandbreite.
      const min = template.min_fee_percentage, max = template.max_fee_percentage;
      if (overrides.fee_percentage != null &&
          ((min != null && overrides.fee_percentage < Number(min)) ||
           (max != null && overrides.fee_percentage > Number(max)))) {
        return fail('invalid_request',
          `Das Honorar muss zwischen ${min} % und ${max} % liegen — das ist die veröffentlichte Regel.`);
      }

      const t = effectiveTerms(template, { ...link, ...overrides } as Record<string, any>);
      const now = new Date().toISOString();
      const snapshot = {
        ...(previous.snapshot as Record<string, any>),
        captured_at: now,
        revision_of: previous.mandate_number,
        terms: {
          template_id: template.id,
          template_key: template.key,
          template_version: template.version,
          label: template.label,
          body_md: template.body_md,
          body_sha256: template.body_sha256,
          fee_percentage: t.fee_percentage,
          fee_basis: t.fee_basis,
          payment_terms_days: t.payment_terms_days,
          guarantee_days: t.guarantee_days,
          refund_rule: t.refund_rule,
          vat_note: t.vat_note,
          requires_signature: t.requires_signature,
        },
      };

      // Erst die alte Zeile schliessen: der partielle Unique-Index laesst nur
      // ein offenes bzw. ein lebendes Angebot je Entwurf zu.
      await supabase.from('commercial_mandates')
        .update({ status: 'superseded' }).eq('id', previous.id);

      const { data: next, error } = await supabase
        .from('commercial_mandates')
        .insert({
          draft_id: draftId,
          job_id: draft.job_id ?? null,
          organization_id: draft.organization_id ?? null,
          client_user_id: draft.client_user_id ?? null,
          template_id: template.id,
          template_version: template.version,
          fee_percentage: t.fee_percentage,
          recruiter_fee_percentage: t.recruiter_fee_percentage,
          fee_basis: t.fee_basis,
          contracting_margin_percentage: t.contracting_margin_percentage,
          payment_terms_days: t.payment_terms_days,
          guarantee_days: t.guarantee_days,
          refund_rule: t.refund_rule,
          snapshot,
          snapshot_sha256: await contentHash(JSON.stringify(snapshot)),
          agb_version: template.agb_version,
          agb_sha256: template.agb_sha256 ?? null,
          status: 'proposed',
          supersedes_id: previous.id,
          proposed_by: adminId,
          signature_status: t.requires_signature ? 'pending' : 'not_required',
        })
        .select('*')
        .single();

      if (error) {
        // Rollback der Statusaenderung, sonst steht der Vorgang ohne Angebot da.
        await supabase.from('commercial_mandates').update({ status: previous.status }).eq('id', previous.id);
        return fail('internal_error', error.message);
      }

      // Der Job darf ohne erneute Bestaetigung nicht live gehen.
      if (draft.job_id) {
        await supabase.from('jobs')
          .update({ mandate_id: next.id, status: 'pending_client_terms' })
          .eq('id', draft.job_id);
      }
      await supabase.from('intake_drafts')
        .update({ commercial_state: 'presented', last_activity_at: now }).eq('id', draftId);

      let resumeUrl: string | null = null;
      if (draft.contact_email) {
        const issued = await issueDraftToken(supabase, {
          draftId, origin: 'admin', recipientEmail: draft.contact_email, createdBy: adminId,
        });
        if (!('error' in issued)) resumeUrl = intakeResumeUrl(issued.token);

        const html = layout({
          preheader: 'Angepasste Konditionen zu Ihrer Anfrage.',
          heading: 'Angepasste Konditionen',
          body: `
            <p style="margin:0 0 16px 0;">Guten Tag ${esc(draft.contact_name ?? '')},</p>
            <p style="margin:0 0 16px 0;">
              wie besprochen erhalten Sie angepasste Konditionen für <strong>${esc(summary.title)}</strong>.
              Die bisherige Fassung ${esc(previous.mandate_number)} ist damit hinfällig.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:18px 0;">
              <tr><td style="padding:6px 0;color:#6b7280;width:45%;">Neue Vorgangsnummer</td><td style="padding:6px 0;font-weight:600;">${esc(next.mandate_number)}</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Erfolgshonorar</td><td style="padding:6px 0;font-weight:600;">${esc(t.fee_percentage)} %</td></tr>
              <tr><td style="padding:6px 0;color:#6b7280;">Zahlungsziel</td><td style="padding:6px 0;">${esc(t.payment_terms_days)} Tage netto</td></tr>
            </table>
            <p style="margin:0;">Bitte bestätigen Sie die neuen Konditionen — erst danach starten wir.</p>`,
          cta: resumeUrl ? { label: 'Konditionen ansehen', url: resumeUrl } : undefined,
        });
        await sendIntakeMail(supabase, {
          to: draft.contact_email,
          subject: `Angepasste Konditionen — ${next.mandate_number}`,
          html, template: 'intake_terms_revised', replyTo: admin.email,
          meta: { draft_id: draftId, mandate_id: next.id, supersedes: previous.mandate_number },
        });
      }

      await logEvent(supabase, {
        type: 'terms_presented', linkId: draft.link_id, draftId, actorUserId: adminId,
        meta: { mandate: next.mandate_number, supersedes: previous.mandate_number, fee: t.fee_percentage },
      });

      return json({ ok: true, mandate: next });
    }

    // ================================================================ assign
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
