import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { generateToken, hashToken } from '../_shared/tokens.ts';
import { encryptToken, decryptToken } from '../_shared/encryption.ts';
import { normalizeDomain, isPlausibleEmail } from '../_shared/domain.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { intakeStartUrl } from '../_shared/app-url.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';

/**
 * intake-link-admin — Aufnahme-Links erzeugen, versenden, widerrufen.
 *
 * Der Klartext-Token verlaesst das System GENAU EINMAL: in der Antwort auf
 * 'create' und im Text der Einladungsmail. In der Datenbank liegt nur der
 * SHA-256-Hash; ein spaeteres "Link nochmal anzeigen" ist deshalb technisch
 * unmoeglich und auch nicht vorgesehen — wer ihn verliert, erzeugt einen neuen.
 */

const LINK_TYPES = ['personal', 'campaign', 'public'] as const;

/**
 * Den Token verschluesselt ablegen, damit der Admin ihn erneut anzeigen kann.
 *
 * Anders als beim Entwurfs-Token, der hash-only bleibt: ein Link traegt nur die
 * Vorbelegung und die Moeglichkeit, eine Aufnahme zu beginnen -- die
 * vertraulichen Angaben haengen am Entwurf. Ohne ENCRYPTION_KEY wird nur der
 * Hash gespeichert; der Link funktioniert dann, laesst sich aber nicht erneut
 * anzeigen. Das wird gemeldet statt verschwiegen.
 */
async function sealToken(token: string): Promise<{ encrypted: string | null; note: string | null }> {
  const key = Deno.env.get('ENCRYPTION_KEY');
  if (!key || key.length !== 64) {
    console.warn('[intake-link-admin] ENCRYPTION_KEY fehlt oder hat nicht 64 Zeichen — Link wird nicht wieder anzeigbar sein.');
    return {
      encrypted: null,
      note: 'Der Link lässt sich später nicht erneut anzeigen: das Secret ENCRYPTION_KEY ist nicht gesetzt. Bitte jetzt kopieren.',
    };
  }
  try {
    return { encrypted: await encryptToken(token, key), note: null };
  } catch (e) {
    console.error('[intake-link-admin] Verschluesselung fehlgeschlagen:', e);
    return { encrypted: null, note: 'Der Link lässt sich später nicht erneut anzeigen. Bitte jetzt kopieren.' };
  }
}

async function openToken(encrypted: string | null): Promise<string | null> {
  const key = Deno.env.get('ENCRYPTION_KEY');
  if (!encrypted || !key || key.length !== 64) return null;
  try {
    return await decryptToken(encrypted, key);
  } catch (e) {
    console.error('[intake-link-admin] Entschluesselung fehlgeschlagen:', e);
    return null;
  }
}

/** Nur diese Schluessel duerfen in prefill. Alles andere waere ein Kanal, um
 *  beliebige Daten in den Gast-Flow zu schieben — insbesondere gilt die harte
 *  Regel aus J.2.4: niemals Kandidatendaten. */
const PREFILL_KEYS = [
  'company_name', 'company_domain', 'industry', 'location', 'company_size',
  'contact_name', 'contact_email', 'contact_role',
  'seed_title', 'seed_text', 'contract_type',
] as const;

function cleanPrefill(input: unknown): Record<string, string> {
  const src = (input ?? {}) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const key of PREFILL_KEYS) {
    const value = src[key];
    if (typeof value === 'string' && value.trim()) {
      out[key] = value.trim().slice(key === 'seed_text' ? 4000 : 0, key === 'seed_text' ? 4000 : 300);
    }
  }
  if (out.company_domain) {
    const normalized = normalizeDomain(out.company_domain);
    if (normalized) out.company_domain = normalized;
    else delete out.company_domain;
  }
  if (out.contact_email && !isPlausibleEmail(out.contact_email)) delete out.contact_email;
  return out;
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const supabase = serviceClient();
    const admin = await requireAdmin(req, supabase);
    if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? 'list');

    // ---------------------------------------------------------------- create
    if (action === 'create') {
      const linkType = String(body?.link_type ?? '');
      if (!LINK_TYPES.includes(linkType as typeof LINK_TYPES[number])) {
        return fail('invalid_request', 'Unbekannter Linktyp.');
      }
      const label = String(body?.label ?? '').trim().slice(0, 160);
      if (label.length < 3) return fail('invalid_request', 'Bitte geben Sie eine Bezeichnung an.');

      const prefill = cleanPrefill(body?.prefill);
      if (linkType === 'public' && (prefill.contact_email || prefill.contact_name)) {
        return fail('invalid_request',
          'Ein öffentlicher Link darf keine Person vorbelegen — er wird von unbekannten Besuchern geöffnet.');
      }

      const token = generateToken();
      const sealed = await sealToken(token);
      const insert: Record<string, unknown> = {
        token_hash: await hashToken(token),
        token_encrypted: sealed.encrypted,
        link_type: linkType,
        label,
        internal_note: String(body?.internal_note ?? '').trim().slice(0, 2000) || null,
        owner_user_id: body?.owner_user_id ?? null,
        campaign_key: String(body?.campaign_key ?? '').trim().slice(0, 120) || null,
        source: String(body?.source ?? '').trim().slice(0, 60) || null,
        outreach_company_id: body?.outreach_company_id ?? null,
        outreach_lead_id: body?.outreach_lead_id ?? null,
        organization_id: body?.organization_id ?? null,
        prefill,
        terms_template_id: body?.terms_template_id ?? null,
        fee_percentage: body?.fee_percentage != null ? Number(body.fee_percentage) : null,
        recruiter_fee_percentage:
          body?.recruiter_fee_percentage != null ? Number(body.recruiter_fee_percentage) : null,
        allow_freemail: body?.allow_freemail === true,
        max_uses: body?.max_uses != null ? Number(body.max_uses) : null,
        expires_at: body?.expires_at ?? null,
        created_by: admin.userId!,
      };

      const { data: link, error } = await supabase
        .from('intake_links').insert(insert).select('*').single();

      if (error) {
        // Der Bandbreiten-Trigger meldet im Klartext, was nicht passt.
        console.error('[intake-link-admin] create:', error.message);
        return fail(error.code === '23514' ? 'invalid_request' : 'internal_error', error.message);
      }

      const url = intakeStartUrl(token);

      // Optionaler Direktversand an den Ansprechpartner.
      let emailSent: boolean | null = null;
      const sendTo = String(body?.send_to ?? '').trim().toLowerCase();
      if (sendTo) {
        if (!isPlausibleEmail(sendTo)) return json({ link, url, token, email_sent: false, email_error: 'Ungültige Adresse' });

        let ownerName: string | null = null;
        if (admin.userId) {
          const { data } = await supabase.from('profiles').select('full_name').eq('user_id', admin.userId).maybeSingle();
          ownerName = data?.full_name ?? null;
        }
        const message = String(body?.message ?? '').trim().slice(0, 2000);

        const html = layout({
          preheader: 'Ihre Position in wenigen Minuten aufnehmen — ohne Registrierung.',
          heading: prefill.seed_title
            ? `Ihre Position aufnehmen: ${prefill.seed_title}`
            : 'Ihre Position aufnehmen',
          body: `
            <p style="margin:0 0 16px 0;">Guten Tag${prefill.contact_name ? ' ' + esc(prefill.contact_name) : ''},</p>
            ${message ? `<p style="margin:0 0 16px 0;">${esc(message).replace(/\n/g, '<br/>')}</p>` : `
            <p style="margin:0 0 16px 0;">
              über den folgenden Link nehmen wir Ihre offene Position auf — Stellenanzeige einfügen,
              Link oder PDF hochladen, oder einfach beschreiben. Der Rest geht automatisch.
              Eine Registrierung ist dafür nicht nötig.
            </p>`}
            <p style="margin:0 0 16px 0;">
              Die Konditionen sehen Sie von Anfang an: Erfolgshonorar, keine Fixkosten, kein Retainer.
            </p>`,
          cta: { label: 'Position aufnehmen', url },
          footnote:
            'Ihre Angaben werden fortlaufend gespeichert — Sie können jederzeit unterbrechen und später weitermachen.',
        });

        const mail = await sendIntakeMail(supabase, {
          to: sendTo,
          subject: prefill.seed_title
            ? `Ihre Position aufnehmen: ${prefill.seed_title}`
            : 'Ihre offene Position bei Matchunt aufnehmen',
          html,
          template: 'intake_link_invitation',
          replyTo: admin.email,
          meta: { link_id: link.id, link_type: linkType, owner: ownerName },
        });
        emailSent = mail.sent;
      }

      // Der Token wird hier zurueckgegeben und danach nie wieder. Der Hash
      // gehoert nicht in die Antwort -- er ist zwar mit Pfeffer gebildet und
      // damit nicht ruecklesbar, aber er hat im Browser trotzdem nichts verloren.
      const { token_hash: _hash, token_encrypted: _enc, ...safeLink } = link as Record<string, unknown>;
      return json({ link: safeLink, url, token, email_sent: emailSent, warning: sealed.note });
    }

    // ---------------------------------------------------------------- reveal
    // Den Link erneut anzeigen. Nur fuer Admins, und nur wenn er
    // verschluesselt abgelegt werden konnte.
    if (action === 'reveal') {
      const linkId = String(body?.link_id ?? '');
      if (!linkId) return fail('invalid_request', 'link_id fehlt.');

      const { data: row, error } = await supabase
        .from('intake_links').select('id, label, token_encrypted, revoked_at').eq('id', linkId).maybeSingle();
      if (error) return fail('internal_error', error.message);
      if (!row) return fail('not_found', 'Link nicht gefunden.');

      const token = await openToken(row.token_encrypted);
      if (!token) {
        return fail('conflict',
          'Dieser Link kann nicht erneut angezeigt werden — er wurde angelegt, bevor Links speicherbar waren, oder das Secret ENCRYPTION_KEY fehlt. Erzeugen Sie über „Neuen Link erzeugen" einen Ersatz; der alte wird dabei ungültig.');
      }
      return json({ url: intakeStartUrl(token), token, revoked: Boolean(row.revoked_at) });
    }

    // ---------------------------------------------------------------- rotate
    // Neuer Token auf denselben Link. Der alte wird sofort ungueltig, weil sich
    // der Hash aendert -- genau das, was man nach einem Leck braucht, und die
    // Rettung fuer Links, die nie anzeigbar waren.
    if (action === 'rotate') {
      const linkId = String(body?.link_id ?? '');
      if (!linkId) return fail('invalid_request', 'link_id fehlt.');

      const token = generateToken();
      const sealed = await sealToken(token);
      const { data, error } = await supabase
        .from('intake_links')
        .update({
          token_hash: await hashToken(token),
          token_encrypted: sealed.encrypted,
          token_rotated_at: new Date().toISOString(),
          token_rotated_by: admin.userId,
        })
        .eq('id', linkId)
        .select('id, label')
        .single();
      if (error) return fail('internal_error', error.message);

      return json({
        link: data, url: intakeStartUrl(token), token, warning: sealed.note,
        message: 'Neuer Link erzeugt. Der bisherige ist ab sofort ungültig.',
      });
    }

    // ---------------------------------------------------------------- revoke
    if (action === 'revoke' || action === 'reactivate') {
      const linkId = String(body?.link_id ?? '');
      if (!linkId) return fail('invalid_request', 'link_id fehlt.');
      const { data, error } = await supabase
        .from('intake_links')
        .update(
          action === 'revoke'
            ? { revoked_at: new Date().toISOString(), revoked_by: admin.userId }
            : { revoked_at: null, revoked_by: null },
        )
        .eq('id', linkId)
        .select('*')
        .single();
      if (error) return fail('internal_error', error.message);
      const { token_hash: _h, ...safe } = (data ?? {}) as Record<string, unknown>;
      return json({ link: safe });
    }

    // ---------------------------------------------------------------- update
    if (action === 'update') {
      const linkId = String(body?.link_id ?? '');
      if (!linkId) return fail('invalid_request', 'link_id fehlt.');
      const patch: Record<string, unknown> = {};
      if ('label' in body) patch.label = String(body.label ?? '').trim().slice(0, 160);
      if ('internal_note' in body) patch.internal_note = String(body.internal_note ?? '').trim().slice(0, 2000) || null;
      if ('owner_user_id' in body) patch.owner_user_id = body.owner_user_id ?? null;
      if ('campaign_key' in body) patch.campaign_key = String(body.campaign_key ?? '').trim().slice(0, 120) || null;
      if ('source' in body) patch.source = String(body.source ?? '').trim().slice(0, 60) || null;
      if ('prefill' in body) patch.prefill = cleanPrefill(body.prefill);
      if ('terms_template_id' in body) patch.terms_template_id = body.terms_template_id ?? null;
      if ('fee_percentage' in body) patch.fee_percentage = body.fee_percentage != null ? Number(body.fee_percentage) : null;
      if ('recruiter_fee_percentage' in body) patch.recruiter_fee_percentage = body.recruiter_fee_percentage != null ? Number(body.recruiter_fee_percentage) : null;
      if ('allow_freemail' in body) patch.allow_freemail = body.allow_freemail === true;
      if ('max_uses' in body) patch.max_uses = body.max_uses != null ? Number(body.max_uses) : null;
      if ('expires_at' in body) patch.expires_at = body.expires_at ?? null;

      const { data, error } = await supabase
        .from('intake_links').update(patch).eq('id', linkId).select('*').single();
      if (error) return fail(error.code === '23514' ? 'invalid_request' : 'internal_error', error.message);
      const { token_hash: _h2, ...safe2 } = (data ?? {}) as Record<string, unknown>;
      return json({ link: safe2 });
    }

    // ----------------------------------------------------------------- stats
    if (action === 'stats') {
      const linkId = String(body?.link_id ?? '');
      if (!linkId) return fail('invalid_request', 'link_id fehlt.');

      const [{ data: funnelEvents }, { data: drafts }, { data: events }] = await Promise.all([
        // NICHT ueber intake_link_funnel: die View traegt die Rollenpruefung
        // has_role(auth.uid(),'admin') in sich, und aus einer Service-Role-
        // Function ist auth.uid() NULL -- sie liefert dort immer leer.
        supabase.from('intake_link_events').select('event_type, draft_id, anonymous_id').eq('link_id', linkId),
        supabase
          .from('intake_drafts')
          .select('id, company_name, contact_name, contact_email, title, completeness, capture_state, identity_state, commercial_state, review_state, created_at, last_activity_at, submitted_at, job_id')
          .eq('link_id', linkId)
          .order('last_activity_at', { ascending: false })
          .limit(100),
        supabase
          .from('intake_link_events')
          .select('event_type, occurred_at, draft_id, meta')
          .eq('link_id', linkId)
          .order('occurred_at', { ascending: false })
          .limit(100),
      ]);

      const distinct = (type: string, key: 'draft_id' | 'anonymous_id') =>
        new Set(
          (funnelEvents ?? [])
            .filter((e: Record<string, unknown>) => e.event_type === type && e[key])
            .map((e: Record<string, unknown>) => e[key]),
        ).size;

      return json({
        funnel: {
          link_id: linkId,
          opened: distinct('link_opened', 'anonymous_id'),
          started: distinct('intake_started', 'draft_id'),
          contacted: distinct('contact_provided', 'draft_id'),
          verified: distinct('email_verified', 'draft_id'),
          completed: distinct('intake_completed', 'draft_id'),
          submitted: distinct('submitted', 'draft_id'),
          accepted: distinct('accepted', 'draft_id'),
          signed: distinct('contract_signed', 'draft_id'),
          published: distinct('published', 'draft_id'),
        },
        drafts: drafts ?? [],
        events: events ?? [],
      });
    }

    // ------------------------------------------------------------------ list
    // Aus demselben Grund wie bei 'stats' nicht ueber die View. Zwei Abfragen
    // statt eines JOIN: die Ereignistabelle waechst schneller als die Links,
    // und das Zaehlen im Speicher ist bei dieser Groessenordnung guenstiger
    // als eine gruppierte Abfrage ueber beides.
    const { data: links, error } = await supabase
      .from('intake_links')
      .select('id, label, link_type, campaign_key, source, owner_user_id, created_at,' +
              ' revoked_at, expires_at, uses_count, max_uses, allow_freemail,' +
              ' token_encrypted, token_rotated_at')
      .order('created_at', { ascending: false })
      .limit(Number(body?.limit ?? 200));
    if (error) {
      if (error.code === '42P01') {
        return fail('not_deployed',
          'Die Tabellen der Aufnahme-Links fehlen. Die Migrationen 20260901100*.sql müssen in Lovable angestoßen werden.');
      }
      return fail('internal_error', error.message);
    }

    const ids = (links ?? []).map((l: Record<string, unknown>) => l.id);
    const counters = new Map<string, Record<string, Set<unknown>>>();
    if (ids.length > 0) {
      const { data: evts } = await supabase
        .from('intake_link_events')
        .select('link_id, event_type, draft_id, anonymous_id')
        .in('link_id', ids);
      for (const e of evts ?? []) {
        const bucket = counters.get(e.link_id) ?? {};
        const key = e.event_type === 'link_opened' ? e.anonymous_id : e.draft_id;
        if (!key) continue;
        (bucket[e.event_type] ??= new Set()).add(key);
        counters.set(e.link_id, bucket);
      }
    }

    const withFunnel = (links ?? []).map((l: Record<string, any>) => {
      const c = counters.get(l.id) ?? {};
      // Der verschluesselte Token verlaesst den Server nicht -- nur die
      // Information, ob sich der Link ueberhaupt wieder anzeigen laesst.
      const { token_encrypted, ...rest } = l;
      return {
        ...rest,
        link_id: l.id,
        can_reveal: Boolean(token_encrypted),
        opened: c.link_opened?.size ?? 0,
        started: c.intake_started?.size ?? 0,
        contacted: c.contact_provided?.size ?? 0,
        verified: c.email_verified?.size ?? 0,
        completed: c.intake_completed?.size ?? 0,
        submitted: c.submitted?.size ?? 0,
        accepted: c.accepted?.size ?? 0,
        signed: c.contract_signed?.size ?? 0,
        published: c.published?.size ?? 0,
      };
    });

    return json({ links: withFunnel });
  } catch (e) {
    console.error('[intake-link-admin]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});
