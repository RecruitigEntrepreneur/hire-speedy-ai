import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Öffentlicher Token-Check für die Einladungsseite (verify_jwt = false):
// Der Eingeladene ist i. d. R. noch nicht eingeloggt. Es wird ausschließlich
// über den SHA-256-Hash des Tokens gesucht — Klartext-Tokens liegen nie in der DB.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { token } = await req.json();
    if (!token || typeof token !== 'string') {
      return jsonResponse({ error: 'Token is required' }, 400);
    }

    const tokenHash = await sha256Hex(token);

    const { data: invite, error } = await supabase
      .from('organization_invites')
      .select('id, email, role, job_ids, expires_at, accepted_at, revoked_at, organizations(name, logo_url)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !invite) {
      return jsonResponse({ valid: false, reason: 'not_found' }, 404);
    }
    if (invite.accepted_at) {
      return jsonResponse({ valid: false, reason: 'already_used' }, 410);
    }
    if (invite.revoked_at) {
      return jsonResponse({ valid: false, reason: 'revoked' }, 410);
    }
    if (new Date(invite.expires_at) < new Date()) {
      return jsonResponse({ valid: false, reason: 'expired' }, 410);
    }

    // Existiert schon ein Konto mit dieser E-Mail? (steuert Login vs. Registrierung)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('email', invite.email)
      .maybeSingle();

    return jsonResponse({
      valid: true,
      email: invite.email,
      role: invite.role,
      job_count: Array.isArray(invite.job_ids) ? invite.job_ids.length : 0,
      expires_at: invite.expires_at,
      organization_name: invite.organizations?.name ?? null,
      organization_logo: invite.organizations?.logo_url ?? null,
      account_exists: !!existingProfile,
    });
  } catch (error) {
    console.error('Error in validate-invite:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
