import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Einladung annehmen (verify_jwt = false, da Neu-Registrierung ohne Session):
//   Modus A — eingeloggter User (Authorization-Header): E-Mail muss zur
//             Einladung passen, Mitgliedschaft wird angelegt/reaktiviert.
//   Modus B — neuer User (password im Body): Konto wird serverseitig
//             angelegt (email_confirm), danach Mitgliedschaft.
// Danach: job_collaborators aus invite.job_ids, Einladung single-use
// (accepted_at) — Lookup ausschließlich über token_hash.

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

    const { token, password, full_name } = await req.json();
    if (!token) {
      return jsonResponse({ error: 'Token is required' }, 400);
    }

    // Einladung über Hash finden und validieren (single-use)
    const tokenHash = await sha256Hex(token);
    const { data: invite, error: inviteError } = await supabase
      .from('organization_invites')
      .select('*, organizations(name)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (inviteError || !invite) {
      return jsonResponse({ error: 'Invalid invite' }, 404);
    }
    if (invite.accepted_at) {
      return jsonResponse({ error: 'Invite already used' }, 410);
    }
    if (invite.revoked_at) {
      return jsonResponse({ error: 'Invite revoked' }, 410);
    }
    if (new Date(invite.expires_at) < new Date()) {
      return jsonResponse({ error: 'Invite has expired' }, 410);
    }

    // User ermitteln: Modus A (Session) oder Modus B (Neu-Registrierung)
    let userId: string;
    let isNewUser = false;

    const authHeader = req.headers.get('Authorization');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const bearer = authHeader?.replace('Bearer ', '') ?? '';
    const hasSession = !!bearer && bearer !== anonKey;

    if (hasSession) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(bearer);
      if (authError || !user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
        return jsonResponse({ error: 'Invite email does not match your account' }, 403);
      }
      userId = user.id;
    } else {
      if (!password || String(password).length < 8) {
        return jsonResponse({ error: 'Password required (min. 8 characters)' }, 400);
      }

      // Existiert bereits ein Konto? Dann muss sich der User einloggen (Modus A).
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('user_id')
        .ilike('email', invite.email)
        .maybeSingle();
      if (existingProfile) {
        return jsonResponse({ error: 'Account exists — please log in to accept', code: 'account_exists' }, 409);
      }

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: full_name || '' },
      });
      if (createError || !created?.user) {
        console.error('Error creating user:', createError);
        return jsonResponse({ error: 'Failed to create account' }, 500);
      }
      userId = created.user.id;
      isNewUser = true;
    }

    // Mitgliedschaft anlegen bzw. reaktivieren
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id, status')
      .eq('organization_id', invite.organization_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      const { error: updateError } = await supabase
        .from('organization_members')
        .update({
          role: invite.role,
          status: 'active',
          invited_by: invite.invited_by,
          joined_at: new Date().toISOString(),
        })
        .eq('id', existingMember.id);
      if (updateError) {
        console.error('Error reactivating member:', updateError);
        return jsonResponse({ error: 'Failed to join organization' }, 500);
      }
    } else {
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: invite.organization_id,
          user_id: userId,
          role: invite.role,
          permissions: invite.permissions ?? [],
          status: 'active',
          invited_by: invite.invited_by,
          invited_at: invite.created_at,
          joined_at: new Date().toISOString(),
        });
      if (memberError) {
        console.error('Error creating member:', memberError);
        return jsonResponse({ error: 'Failed to join organization' }, 500);
      }
    }

    // Job-Scoping aus der Einladung übernehmen (hiring_manager/viewer)
    const jobIds: string[] = Array.isArray(invite.job_ids) ? invite.job_ids : [];
    if (jobIds.length > 0) {
      const rows = jobIds.map((jobId) => ({
        job_id: jobId,
        user_id: userId,
        role: invite.role === 'viewer' ? 'viewer' : 'hiring_manager',
        added_by: invite.invited_by,
      }));
      const { error: collabError } = await supabase
        .from('job_collaborators')
        .upsert(rows, { onConflict: 'job_id,user_id', ignoreDuplicates: true });
      if (collabError) {
        console.error('Error adding job collaborators:', collabError);
      }
    }

    // Single-use: Einladung entwerten
    await supabase
      .from('organization_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    console.log(`User ${userId} joined organization ${invite.organization_id} as ${invite.role}`);

    return jsonResponse({
      success: true,
      new_user: isNewUser,
      organization_id: invite.organization_id,
      organization_name: invite.organizations?.name,
      role: invite.role,
    });
  } catch (error) {
    console.error('Error in accept-invite:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
