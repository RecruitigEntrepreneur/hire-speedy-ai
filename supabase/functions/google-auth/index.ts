import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://hire-speedy-ai.lovable.app';

// Redirect URI points to frontend OAuth callback
const getRedirectUri = () => {
  return `${FRONTEND_URL}/oauth/callback`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, startDate, endDate, durationMinutes } = await req.json();
    
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader);
      userId = user?.id || null;
    }

    switch (action) {
      case 'check-config': {
        const configured = !!GOOGLE_CLIENT_ID && !!GOOGLE_CLIENT_SECRET;
        return new Response(
          JSON.stringify({ configured, provider: 'google' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-auth-url': {
        if (!GOOGLE_CLIENT_ID) {
          return new Response(
            JSON.stringify({ 
              error: 'Google integration not configured',
              message: 'Bitte konfigurieren Sie GOOGLE_CLIENT_ID und GOOGLE_CLIENT_SECRET'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const state = crypto.randomUUID();
        const redirectUri = getRedirectUri();
        
        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          response_type: 'code',
          redirect_uri: redirectUri,
          scope: 'openid profile email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events',
          state,
          access_type: 'offline',
          prompt: 'consent'
        });

        const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

        return new Response(
          JSON.stringify({ url, state }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'exchange-code': {
        if (!code) {
          return new Response(
            JSON.stringify({ error: 'Authorization code required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const redirectUri = getRedirectUri();
        
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
            code,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });

        if (!tokenResponse.ok) {
          const error = await tokenResponse.text();
          console.error('Token exchange failed:', error);
          return new Response(
            JSON.stringify({ error: 'Token exchange failed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokens = await tokenResponse.json();

        // Get user info
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        const userInfo = await userResponse.json();

        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

        const { error: upsertError } = await supabase
          .from('user_integrations')
          .upsert({
            user_id: userId,
            provider: 'google',
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            email: userInfo.email,
            metadata: {
              name: userInfo.name,
              picture: userInfo.picture,
              id: userInfo.id
            },
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id,provider'
          });

        if (upsertError) {
          console.error('Error storing integration:', upsertError);
          return new Response(
            JSON.stringify({ error: 'Failed to store integration' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, email: userInfo.email }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'refresh-token': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: integration, error: fetchError } = await supabase
          .from('user_integrations')
          .select('refresh_token')
          .eq('user_id', userId)
          .eq('provider', 'google')
          .single();

        if (fetchError || !integration?.refresh_token) {
          return new Response(
            JSON.stringify({ error: 'No refresh token available' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID!,
            client_secret: GOOGLE_CLIENT_SECRET!,
            refresh_token: integration.refresh_token,
            grant_type: 'refresh_token'
          })
        });

        if (!tokenResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Token refresh failed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokens = await tokenResponse.json();
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

        await supabase
          .from('user_integrations')
          .update({
            access_token: tokens.access_token,
            token_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('provider', 'google');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-free-busy': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: integration } = await supabase
          .from('user_integrations')
          .select('access_token, token_expires_at')
          .eq('user_id', userId)
          .eq('provider', 'google')
          .single();

        if (!integration) {
          return new Response(
            JSON.stringify({ error: 'Google not connected' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check if token needs refresh
        if (new Date(integration.token_expires_at) < new Date()) {
          // Trigger token refresh
          await fetch(`${SUPABASE_URL}/functions/v1/google-auth`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authHeader}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'refresh-token' })
          });
        }

        // Get free/busy info from Google Calendar
        const freeBusyResponse = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            timeMin: startDate,
            timeMax: endDate,
            items: [{ id: 'primary' }]
          })
        });

        if (!freeBusyResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Failed to get calendar data' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const freeBusyData = await freeBusyResponse.json();
        const busyTimes = freeBusyData.calendars?.primary?.busy || [];

        // Generate available slots (simplified - would need more complex logic in production)
        const slots: { start: string; end: string }[] = [];
        // ... slot generation logic would go here

        return new Response(
          JSON.stringify({ slots, busyTimes }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: deleteError } = await supabase
          .from('user_integrations')
          .delete()
          .eq('user_id', userId)
          .eq('provider', 'google');

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: 'Failed to disconnect' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Google auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
