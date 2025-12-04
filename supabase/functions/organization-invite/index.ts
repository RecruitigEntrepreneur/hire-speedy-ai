import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { organization_id, email, role, permissions } = await req.json();

    if (!organization_id || !email || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is org admin
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organization_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (memberError || !membership || !['owner', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Not authorized to invite members' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organization_id)
      .single();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if email already invited or member
    const { data: existingInvite } = await supabase
      .from('organization_invites')
      .select('id')
      .eq('organization_id', organization_id)
      .eq('email', email)
      .is('accepted_at', null)
      .single();

    if (existingInvite) {
      return new Response(JSON.stringify({ error: 'User already invited' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate secure token
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    // Create invite
    const { data: invite, error: inviteError } = await supabase
      .from('organization_invites')
      .insert({
        organization_id,
        email,
        role,
        permissions: permissions || [],
        token,
        expires_at: expiresAt.toISOString(),
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Error creating invite:', inviteError);
      return new Response(JSON.stringify({ error: 'Failed to create invite' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send invite email if Resend is configured
    if (resendApiKey) {
      const inviteUrl = `${req.headers.get('origin')}/invite/${token}`;
      
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'RecruitFlow <noreply@recruitflow.app>',
            to: [email],
            subject: `Einladung zu ${org.name}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Sie wurden zu ${org.name} eingeladen</h2>
                <p>Sie wurden als ${role} zu ${org.name} auf RecruitFlow eingeladen.</p>
                <p>Klicken Sie auf den folgenden Link, um die Einladung anzunehmen:</p>
                <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                  Einladung annehmen
                </a>
                <p style="color: #666; font-size: 14px;">
                  Dieser Link ist 7 Tage gültig.
                </p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't fail the request, invite is still created
      }
    }

    console.log(`Invite created for ${email} to org ${organization_id}`);

    return new Response(JSON.stringify({ 
      success: true, 
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expires_at: invite.expires_at,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in organization-invite:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
