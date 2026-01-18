import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, startDateTime, endDateTime, interviewId } = await req.json();

    if (!subject || !startDateTime || !endDateTime || !interviewId) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from auth
    const { data: { user } } = await supabase.auth.getUser(authHeader!);
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Microsoft integration
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('access_token, token_expires_at, refresh_token')
      .eq('user_id', user.id)
      .eq('provider', 'microsoft')
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Microsoft Teams not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = integration.access_token;

    // Check if token needs refresh
    if (new Date(integration.token_expires_at) < new Date()) {
      // Refresh the token
      const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID');
      const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET');

      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID!,
          client_secret: MICROSOFT_CLIENT_SECRET!,
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token'
        })
      });

      if (tokenResponse.ok) {
        const tokens = await tokenResponse.json();
        accessToken = tokens.access_token;

        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

        await supabase
          .from('user_integrations')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || integration.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id)
          .eq('provider', 'microsoft');
      } else {
        return new Response(
          JSON.stringify({ error: 'Token refresh failed. Please reconnect Microsoft Teams.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create Teams online meeting
    const meetingResponse = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        startDateTime,
        endDateTime,
        subject,
        lobbyBypassSettings: {
          scope: 'everyone',
          isDialInBypassEnabled: true
        },
        allowedPresenters: 'everyone'
      })
    });

    if (!meetingResponse.ok) {
      const errorText = await meetingResponse.text();
      console.error('Failed to create Teams meeting:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to create Teams meeting' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meeting = await meetingResponse.json();

    // Update interview with Teams meeting info
    const { error: updateError } = await supabase
      .from('interviews')
      .update({
        teams_meeting_id: meeting.id,
        teams_join_url: meeting.joinUrl,
        meeting_link: meeting.joinUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', interviewId);

    if (updateError) {
      console.error('Failed to update interview:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        meetingId: meeting.id,
        joinUrl: meeting.joinUrl,
        dialInUrl: meeting.audioConferencing?.dialinUrl,
        tollNumber: meeting.audioConferencing?.tollNumber
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create Teams meeting error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
