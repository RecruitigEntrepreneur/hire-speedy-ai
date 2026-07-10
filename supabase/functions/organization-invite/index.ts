import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_ROLES = ['admin', 'hr', 'hiring_manager', 'viewer'];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  hr: 'HR / Recruiting',
  hiring_manager: 'Hiring Manager',
  viewer: 'Betrachter',
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

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

    const { organization_id, email, role, job_ids } = await req.json();

    if (!organization_id || !email || !role) {
      return jsonResponse({ error: 'Missing required fields' }, 400);
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return jsonResponse({ error: 'Invalid role' }, 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const jobIds: string[] = Array.isArray(job_ids) ? job_ids : [];

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

    const origin = req.headers.get('origin') || Deno.env.get('SITE_URL') || '';
    const inviteUrl = `${origin}/invite/${token}`;

    // Name des Einladenden für die E-Mail
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', user.id)
      .maybeSingle();
    const inviterName = inviterProfile?.full_name || 'Ihr Team';

    let emailSent = false;
    if (resendApiKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: Deno.env.get('RESEND_FROM') || 'Matchunt <onboarding@resend.dev>',
            to: [normalizedEmail],
            subject: `${inviterName} lädt Sie zu ${org.name} ein`,
            html: `
              <div style="font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
                <div style="background: linear-gradient(135deg, #1e293b, #0f172a); border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
                  <h1 style="color: #ffffff; font-size: 22px; margin: 0;">Team-Einladung</h1>
                </div>
                <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 32px;">
                  <p>Guten Tag,</p>
                  <p><strong>${inviterName}</strong> hat Sie eingeladen, dem Team von <strong>${org.name}</strong> auf Matchunt beizutreten.</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Ihre Rolle</td>
                      <td style="padding: 8px 0; text-align: right; font-weight: 600;">${ROLE_LABELS[role] ?? role}</td>
                    </tr>
                  </table>
                  <div style="text-align: center; margin: 24px 0;">
                    <a href="${inviteUrl}" style="display: inline-block; padding: 12px 28px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">
                      Einladung annehmen
                    </a>
                  </div>
                  <p style="color: #64748b; font-size: 13px;">
                    Dieser Link ist 7 Tage gültig und kann nur einmal verwendet werden.
                    Falls Sie diese Einladung nicht erwartet haben, können Sie diese E-Mail ignorieren.
                  </p>
                </div>
              </div>
            `,
          }),
        });
        emailSent = res.ok;
        if (!res.ok) {
          console.error('Resend error:', await res.text());
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }
    }

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
