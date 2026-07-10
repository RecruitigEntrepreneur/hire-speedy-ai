import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Team-Liste mit Profil-Daten + letztem Login (auth.users.last_sign_in_at
// ist nur mit Service Role lesbar). Zugriff: aktive Mitglieder der Org;
// last_sign_in_at wird nur Org-Admins (owner/admin) mitgegeben.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { organization_id } = await req.json();
    if (!organization_id) {
      return jsonResponse({ error: 'organization_id is required' }, 400);
    }

    // Zugriffsprüfung: Owner oder aktives Mitglied
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, owner_id')
      .eq('id', organization_id)
      .single();
    if (orgError || !org) {
      return jsonResponse({ error: 'Organization not found' }, 404);
    }

    const { data: callerMembership } = await supabase
      .from('organization_members')
      .select('role, status')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .maybeSingle();

    const isOwner = org.owner_id === user.id;
    const isActiveMember = callerMembership?.status === 'active';
    if (!isOwner && !isActiveMember) {
      return jsonResponse({ error: 'Not a member of this organization' }, 403);
    }
    const isAdmin = isOwner || ['owner', 'admin'].includes(callerMembership?.role ?? '');

    // Mitglieder + Profile
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('id, user_id, role, status, invited_by, joined_at, created_at')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: true });
    if (membersError) {
      console.error('Error loading members:', membersError);
      return jsonResponse({ error: 'Failed to load members' }, 500);
    }

    const userIds = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, avatar_url')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));

    // Job-Zuweisungen (für hiring_manager/viewer relevant)
    const { data: collaborators } = await supabase
      .from('job_collaborators')
      .select('user_id, job_id, jobs!inner(id, title, organization_id)')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('jobs.organization_id', organization_id);
    const jobsByUser = new Map<string, { id: string; title: string }[]>();
    for (const c of collaborators ?? []) {
      const list = jobsByUser.get(c.user_id) ?? [];
      const job = (c as unknown as { jobs: { id: string; title: string } }).jobs;
      if (job) list.push({ id: job.id, title: job.title });
      jobsByUser.set(c.user_id, list);
    }

    // Letzter Login: nur für Org-Admins
    const lastSignInMap = new Map<string, string | null>();
    if (isAdmin) {
      await Promise.all(
        userIds.map(async (uid) => {
          try {
            const { data } = await supabase.auth.admin.getUserById(uid);
            lastSignInMap.set(uid, data?.user?.last_sign_in_at ?? null);
          } catch (_) {
            lastSignInMap.set(uid, null);
          }
        })
      );
    }

    const enriched = (members ?? []).map((m) => ({
      ...m,
      full_name: profileMap.get(m.user_id)?.full_name ?? null,
      email: profileMap.get(m.user_id)?.email ?? null,
      avatar_url: profileMap.get(m.user_id)?.avatar_url ?? null,
      last_sign_in_at: isAdmin ? (lastSignInMap.get(m.user_id) ?? null) : null,
      assigned_jobs: jobsByUser.get(m.user_id) ?? [],
    }));

    return jsonResponse({
      members: enriched,
      caller_role: isOwner ? 'owner' : (callerMembership?.role ?? null),
      is_admin: isAdmin,
    });
  } catch (error) {
    console.error('Error in team-data:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
