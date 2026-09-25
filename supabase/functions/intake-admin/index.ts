import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { contentHash } from '../_shared/tokens.ts';
import { isPlausibleEmail } from '../_shared/domain.ts';
import { serviceClient, logEvent, resolveTemplate, effectiveTerms, issueDraftToken } from '../_shared/intake-core.ts';
import { draftToJobRow, draftSummary } from '../_shared/intake-mapping.ts';
import { requireAdmin, isServiceRole } from '../_shared/admin-auth.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';
import { intakeResumeUrl } from '../_shared/app-url.ts';
import { accountForEmail, lastAccessMail, notifyAccessProblem, sendClientAccess } from '../_shared/client-access.ts';
import { linkFramework, notifyFrameworkConflict } from '../_shared/framework-link.ts';

type Db = ReturnType<typeof serviceClient>;

/**
 * Die Zugangsmail zum Auftrag (client-access.ts). Sie geht mit der
 * Gegenzeichnung raus, nicht mit der Annahme: erst dann ist der Auftrag
 * wirksam (Entscheidung 25.09.2026). Nimmt der Admin vorher an, folgt sie über
 * `after_countersign`. `force` ist der Admin-Knopf „erneut senden“.
 */
async function deliverAccess(supabase: Db, draft: Record<string, any>, mandate: Record<string, any>,
  userId: string, jobId: string | null, opts: { force?: boolean } = {}) {
  const signed = Boolean(mandate.countersigned_at);
  if (!signed && mandate.signature_status !== 'not_required' && !opts.force) {
    return { sent: false, waiting: 'countersignature' as const };
  }
  // An die Adresse des Kontos: nur für sie öffnet der Link die Anmeldung.
  const { data } = await supabase.auth.admin.getUserById(userId);
  const result = await sendClientAccess(supabase, {
    userId, email: data?.user?.email ?? draft.contact_email, name: draft.contact_name ?? null,
    title: draftSummary(draft).title, mandateNumber: mandate.mandate_number ?? null,
    signed: signed || mandate.signature_status === 'not_required',
    mandateId: mandate.id, draftId: draft.id, jobId,
  }, { resend: opts.force });
  // Automatisch verschickt und gescheitert: sonst merkt es niemand, und der Kunde
  // wartet. Beim Admin-Knopf sieht der Admin den Fehler direkt.
  if (!result.sent && !result.already && !opts.force) {
    await notifyAccessProblem(supabase, draft, { kind: 'failed', error: result.error });
  }
  return result;
}

/** Headhunter-Konto unter der Kundenadresse? Dann nichts still übernehmen. */
async function isRecruiterAccount(supabase: Db, userId: string) {
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  return (data ?? []).some((r: { role: string }) => r.role === 'recruiter');
}
const RECRUITER_ACCOUNT = (email: string) =>
  `Die Adresse ${email} gehört zu einem Headhunter-Konto. Unter „Zugang des Kunden“ als Kunde umstellen, dann geht der Zugang raus.`;

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
    // Zwei Aufrufer: ein angemeldeter Admin, und unser eigenes Backend --
    // die Gegenzeichnung loest die Annahme selbst aus (docusign-apply). Wer
    // gegengezeichnet hat, HAT entschieden; ein zweiter Klick "annehmen"
    // waere eine Formalie, die vergessen werden kann.
    let adminId: string | null;
    if (isServiceRole(req)) {
      // Die Gegenzeichnung kam ueber DocuSign, oft per Mail und damit ohne
      // Sitzung bei uns. Dann steht hier niemand -- und das ist ehrlicher,
      // als die Annahme einem beliebigen Admin zuzuschreiben.
      adminId = (await req.clone().json().catch(() => ({})))?.acting_user_id ?? null;
    } else {
      const admin = await requireAdmin(req, supabase);
      if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
      adminId = admin.userId!;
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const draftId = String(body?.draft_id ?? '');
    if (!draftId) return fail('invalid_request', 'draft_id fehlt.');

    const { data: draft, error: draftErr } = await supabase
      .from('intake_drafts').select('*').eq('id', draftId).maybeSingle();
    if (draftErr) return fail('internal_error', draftErr.message);
    if (!draft) return fail('not_found', 'Aufnahme nicht gefunden.');

    const summary = draftSummary(draft);

    // Nach der Gegenzeichnung (docusign-apply, contract-admin): noch offen →
    // annehmen; schon angenommen → nur noch den Zugang schicken.
    let step = action === 'after_countersign'
      ? (draft.review_state === 'pending_admin' ? 'accept' : 'send_access')
      : action;

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

    // ======================================================= Konto umstellen
    // Der Ausweg aus „Headhunter-Konto unter der Kundenadresse“: Matchunt
    // entscheidet, dass das Konto Kunde ist. Danach läuft, was die
    // Gegenzeichnung ausgelöst hätte.
    if (action === 'make_client') {
      const account = await accountForEmail(supabase, draft.contact_email ?? '');
      if (!account) return fail('not_found', 'Zu dieser Adresse gibt es kein Konto.');
      if (!account.roles.includes('recruiter')) return fail('conflict', 'Das Konto ist kein Headhunter-Konto.');
      const { error } = await supabase.from('user_roles')
        .update({ role: 'client' }).eq('user_id', account.userId).eq('role', 'recruiter');
      if (error) return fail('internal_error', error.message);
      step = draft.review_state === 'pending_admin' ? 'accept' : 'send_access';
    }

    // ==================================================================== accept
    if (step === 'accept') {
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

      // Headhunter-Konto unter der Kundenadresse: nichts still übernehmen. Die
      // Stelle hinge an einem Headhunter-Konto, und die Anmeldung führte zur
      // Headhunter-Vertragsseite (Kanna Medics, 25.09.2026). Ist schon
      // gegengezeichnet, wartet der Kunde -- dann bekommt Matchunt Bescheid.
      if (clientUserId && await isRecruiterAccount(supabase, clientUserId)) {
        if (mandate.countersigned_at) await notifyAccessProblem(supabase, draft, { kind: 'held' });
        return fail('conflict', RECRUITER_ACCOUNT(draft.contact_email), { code: 'recruiter_account' });
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

      // ---- Rahmenvertrag an die Firma haengen ---------------------------------
      // Die Firma entsteht erst hier; der Rahmenvertrag kam schon beim Absenden.
      // Ohne diesen Schritt findet ihn keiner, der ueber die Firma sucht
      // (framework-link.ts, Befund Kanna Medics 25.09.2026).
      const { data: angenommen } = await supabase
        .from('intake_drafts').select('organization_id').eq('id', draftId).maybeSingle();
      const verknuepft = await linkFramework(supabase, {
        frameworkId: mandate.framework_agreement_id,
        organizationId: angenommen?.organization_id,
        clientUserId,
      });
      if (!verknuepft.linked && verknuepft.reason === 'conflict') {
        const { data: rv } = await supabase.from('client_framework_agreements')
          .select('agreement_number').eq('id', mandate.framework_agreement_id).maybeSingle();
        await notifyFrameworkConflict(supabase, draft, { own: rv?.agreement_number ?? 'Rahmenvertrag', other: verknuepft.other });
      }

      // ---- Zugang des Kunden --------------------------------------------------
      // Neu angelegt oder schon vorhanden: der Kunde bekommt denselben Weg
      // hinein, einen persönlichen Link auf /anmelden. Der frühere
      // Passwort-Link galt nur für neue Konten und nur kurz.
      const access = await deliverAccess(supabase, draft, mandate, clientUserId!, jobId as string | null);

      return json({ ok: true, job_id: jobId, client_user_id: clientUserId, account_created: accountCreated, access_mail: access });
    }

    // ================================================= Zugang (erneut) senden
    if (step === 'send_access' || action === 'resend_access') {
      if (!draft.job_id) return fail('conflict', 'Die Aufnahme ist noch nicht angenommen.');
      const mandate = await currentMandate();
      if (!mandate) return fail('conflict', 'Zu dieser Aufnahme gibt es keinen Auftrag.');
      const { data: job } = await supabase.from('jobs').select('client_id').eq('id', draft.job_id).maybeSingle();
      if (!job?.client_id) return fail('conflict', 'Zur Stelle gibt es kein Kundenkonto.');
      if (await isRecruiterAccount(supabase, job.client_id)) {
        if (mandate.countersigned_at) await notifyAccessProblem(supabase, draft, { kind: 'held' });
        return fail('conflict', RECRUITER_ACCOUNT(draft.contact_email), { code: 'recruiter_account' });
      }
      const force = action === 'resend_access';
      const access = await deliverAccess(supabase, draft, mandate, job.client_id, draft.job_id, { force });
      if (force && !access.sent) {
        return fail('upstream_error', `Die Mail konnte nicht versendet werden (${'error' in access ? access.error ?? 'unbekannt' : 'unbekannt'}).`);
      }
      return json({ ok: true, access_mail: access });
    }

    // ======================================================= Zugang ansehen
    // Für den Block „Zugang des Kunden“: Konto, Rolle, erste Anmeldung, Mail.
    if (action === 'access_status') {
      const mandate = await currentMandate();
      let userId: string | null = null;
      if (draft.job_id) {
        const { data: job } = await supabase.from('jobs').select('client_id').eq('id', draft.job_id).maybeSingle();
        userId = job?.client_id ?? null;
      }
      const found = userId ? null : await accountForEmail(supabase, draft.contact_email ?? '');
      userId = userId ?? found?.userId ?? null;
      let account: Record<string, unknown> | null = null;
      if (userId) {
        const [{ data: auth }, { data: roles }] = await Promise.all([
          supabase.auth.admin.getUserById(userId),
          supabase.from('user_roles').select('role').eq('user_id', userId),
        ]);
        account = {
          user_id: userId,
          email: auth?.user?.email ?? null,
          roles: (roles ?? []).map((r: { role: string }) => r.role),
          created_at: auth?.user?.created_at ?? null,
          last_sign_in_at: auth?.user?.last_sign_in_at ?? null,
          password_set_at: auth?.user?.user_metadata?.password_set_at ?? null,
        };
      }
      return json({
        ok: true,
        account,
        mail: mandate ? await lastAccessMail(supabase, mandate.id) : null,
        countersigned: Boolean(mandate?.countersigned_at),
        signature_required: mandate ? mandate.signature_status !== 'not_required' : true,
        accepted: Boolean(draft.job_id),
      });
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
      return fail('conflict', action === 'propose_new_terms'
        ? 'Abweichende Konditionen gibt es nicht mehr. Es stehen genau drei Pakete zur Wahl; '
          + 'der Kunde wählt sie selbst.'
        : 'Der Vertragslauf ist nach contract-admin umgezogen und läuft jetzt zweistufig '
          + '(Kunde zuerst, Matchunt zuletzt).');
    }

    // ---- Firmenangaben trotz Befunden freigeben -----------------------------
    // Der Gegenpol zur automatischen Pruefung: sie stellt fest, ein Mensch
    // entscheidet. Ohne diesen Weg waere ein 'failed' eine Sackgasse.
    if (action === 'clear_company') {
      const { error } = await supabase.from('intake_drafts')
        .update({
          company_state: 'verified',
          company_cleared_at: new Date().toISOString(),
          company_cleared_by: adminId,
          admin_note: [draft.admin_note,
                       `Firmenangaben trotz Befunden freigegeben: ${String(body?.note ?? '—').slice(0, 500)}`]
            .filter(Boolean).join('\n\n').slice(0, 4000),
        })
        .eq('id', draftId);
      if (error) return fail('internal_error', error.message);

      await logEvent(supabase, {
        type: 'company_verified', linkId: draft.link_id, draftId, actorUserId: adminId,
        meta: { manual: true },
      });
      return json({ ok: true });
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
