import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPublicAppUrl } from "../_shared/app-url.ts";
import { esc, layout, sendIntakeMail } from "../_shared/intake-mail.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rolle Buchhaltung ('finance', Etappe 4, 25.10.2026): sieht nur Rechnungen und Rechnungsdaten
const ALLOWED_ROLES = ['admin', 'hr', 'hiring_manager', 'viewer', 'finance'];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  hr: 'HR / Recruiting',
  hiring_manager: 'Fachbereich',
  viewer: 'Betrachter',
  finance: 'Buchhaltung',
};

// Token: 32 Zufallsbytes, base64url. In der DB liegt NUR der SHA-256-Hash.
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { organization_id, email, role, job_ids, full_name, message, billing_cc } = await req.json();
    // Optional: Name für die Anrede, persönliche Nachricht des Einladenden.
    const inviteeName = typeof full_name === 'string' ? full_name.trim().slice(0, 120) : '';
    const personalMessage = typeof message === 'string' ? message.trim().slice(0, 500) : '';

    if (!organization_id || !email || !role) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return jsonResponse({ error: 'Invalid role' }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    // Buchhaltung hat keine Stellen; sie sieht die Rechnungen der ganzen Firma
    const jobIds: string[] = role === 'finance' ? [] : Array.isArray(job_ids) ? job_ids : [];

    // Nur Org-Admins (owner/admin) dürfen einladen
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, owner_id')
      .eq('id', organization_id)
      .single();

    if (orgError || !org) {
      return jsonResponse({ error: 'Organization not found' }, 404);
    }

    let isAdmin = org.owner_id === user.id;
    if (!isAdmin) {
      const { data: membership } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organization_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      isAdmin = !!membership && ['owner', 'admin'].includes(membership.role);
    }
    if (!isAdmin) {
      return jsonResponse({ error: 'Not authorized to invite members' }, 403);
    }

    // Job-Scoping validieren: alle Jobs müssen zur Organisation gehören
    if (jobIds.length > 0) {
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('id')
        .eq('organization_id', organization_id)
        .in('id', jobIds);
      if (jobsError || (jobs?.length ?? 0) !== jobIds.length) {
        return jsonResponse({ error: 'One or more jobs do not belong to this organization' }, 400);
      }
    }

    // Ist die E-Mail bereits aktives Mitglied?
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id, status')
        .eq('organization_id', organization_id)
        .eq('user_id', existingProfile.user_id)
        .maybeSingle();
      if (existingMember?.status === 'active') {
        return jsonResponse({ error: 'User is already an active member' }, 400);
      }
    }

    // Offene Einladung für diese E-Mail?
    const { data: existingInvite } = await supabase
      .from('organization_invites')
      .select('id')
      .eq('organization_id', organization_id)
      .ilike('email', normalizedEmail)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingInvite) {
      return jsonResponse({ error: 'User already invited' }, 400);
    }

    // Token erzeugen — Klartext geht NUR per E-Mail/Antwort raus, DB speichert den Hash
    const token = generateToken();
    const tokenHash = await sha256Hex(token);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error: inviteError } = await supabase
      .from('organization_invites')
      .insert({
        organization_id,
        email: normalizedEmail,
        role,
        job_ids: jobIds,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      })
      .select('id, email, role, job_ids, expires_at')
      .single();

    if (inviteError) {
      console.error('Error creating invite:', inviteError);
      return jsonResponse({ error: 'Failed to create invite' }, 500);
    }

    // Kanonische Domain aus der Konfiguration, nie der origin-Header: eine Einladung
    // aus dem lokalen Preview bekäme sonst einen localhost-Link (Fund 20.10.2026).
    const inviteUrl = `${getPublicAppUrl()}/invite/${token}`;

    // Name des Einladenden für die E-Mail
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();
    const inviterName = inviterProfile?.full_name || 'Ihr Team';

    // Stellennamen für die Mail (Fachbereich/Betrachter sehen nur diese Stellen).
    let jobTitles: string[] = [];
    if (jobIds.length) {
      const { data: jobRows } = await supabase.from('jobs').select('title').in('id', jobIds).eq('organization_id', organization_id);
      jobTitles = (jobRows ?? []).map((j: { title: string }) => j.title).filter(Boolean);
    }
    const greeting = inviteeName ? `Guten Tag ${esc(inviteeName)},` : 'Guten Tag,';
    const rows = [
      `<tr><td style="padding:6px 0;color:#6b7280;">Ihre Rolle</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(ROLE_LABELS[role] ?? role)}</td></tr>`,
      jobTitles.length
        ? `<tr><td style="padding:6px 0;color:#6b7280;vertical-align:top;">Stellen</td><td style="padding:6px 0;text-align:right;">${jobTitles.map(esc).join('<br>')}</td></tr>`
        : '',
      role === 'finance'
        ? `<tr><td colspan="2" style="padding:6px 0;color:#6b7280;">Sie sehen die Rechnungen von Matchunt an ${esc(org.name ?? 'Ihre Firma')}, keine Bewerber.</td></tr>`
        : '',
    ].join('');

    // Buchhaltung: Rechnungen auf Wunsch auch an diese Adresse (weitere Empfänger in den Rechnungsdaten)
    if (role === 'finance' && billing_cc === true && org.owner_id) {
      const { data: cp } = await supabase.from('company_profiles').select('id, billing_email, billing_cc_emails').eq('user_id', org.owner_id).maybeSingle();
      if (cp) {
        const list = [...new Set([...((cp.billing_cc_emails ?? []) as string[]), normalizedEmail].map((e) => String(e).toLowerCase()))]
          .filter((e) => e !== String(cp.billing_email ?? '').toLowerCase());
        if (list.length <= 5) {
          const { error: ccError } = await supabase.from('company_profiles').update({ billing_cc_emails: list }).eq('id', cp.id);
          if (ccError) console.warn('[organization-invite] Rechnungs-Empfänger nicht ergänzt:', ccError.message);
        } else {
          console.warn('[organization-invite] Schon fünf weitere Rechnungs-Empfänger, nicht ergänzt');
        }
      }
    }

    // Gleicher Versandweg wie Aufnahme und Onboarding: bestätigter Absender,
    // Protokoll in email_events, Fehlertext statt stillem Scheitern.
    const mail = await sendIntakeMail(supabase, {
      to: normalizedEmail,
      subject: `${inviterName} lädt Sie zu ${org.name} ein`,
      html: layout({
        preheader: `${inviterName} lädt Sie ins Team von ${org.name} auf Matchunt ein.`,
        heading: 'Einladung ins Team',
        body: `<p style="margin:0 0 12px 0;">${greeting}</p>
<p style="margin:0 0 12px 0;"><strong>${esc(inviterName)}</strong> hat Sie eingeladen, dem Team von <strong>${esc(org.name)}</strong> auf Matchunt beizutreten.</p>
${personalMessage ? `<blockquote style="margin:12px 0;padding:10px 14px;background:#f8fafc;border-left:3px solid #111827;color:#334155;">${esc(personalMessage).replace(/\n/g, '<br>')}</blockquote>` : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;font-size:14px;">${rows}</table>`,
        cta: { label: 'Einladung annehmen', url: inviteUrl },
        after: 'Der Link ist 7 Tage gültig und kann einmal verwendet werden.',
        footnote: 'Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.',
      }),
      template: 'organization_invite',
      meta: { invite_id: invite.id, organization_id, role },
      idempotencyKey: `org-invite-${invite.id}`,
    });
    const emailSent = mail.sent;
    if (!mail.sent) console.error('[organization-invite] Mail nicht verschickt:', mail.error);

    return jsonResponse({
      success: true,
      email_sent: emailSent,
      invite_url: inviteUrl,
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        job_ids: invite.job_ids,
        expires_at: invite.expires_at,
      },
    });
  } catch (error) {
    console.error('Error in organization-invite:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
