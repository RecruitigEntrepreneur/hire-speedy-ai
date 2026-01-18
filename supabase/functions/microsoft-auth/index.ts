import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID');
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Determine redirect URI based on environment
const getRedirectUri = () => {
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1];
  // Use the app's OAuth callback page
  return `https://${projectRef}.supabase.co/functions/v1/microsoft-auth/callback`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code } = await req.json();
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader);
      userId = user?.id || null;
    }

    switch (action) {
      case 'get-auth-url': {
        if (!MICROSOFT_CLIENT_ID) {
          return new Response(
            JSON.stringify({ 
              error: 'Microsoft integration not configured',
              message: 'Bitte konfigurieren Sie MICROSOFT_CLIENT_ID und MICROSOFT_CLIENT_SECRET'
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const state = crypto.randomUUID();
        const redirectUri = getRedirectUri();
        
        const params = new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          response_type: 'code',
          redirect_uri: redirectUri,
          scope: 'openid profile email User.Read OnlineMeetings.ReadWrite Calendars.ReadWrite',
          state,
          response_mode: 'query'
        });

        const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;

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
        
        // Exchange code for tokens
        const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: MICROSOFT_CLIENT_ID!,
            client_secret: MICROSOFT_CLIENT_SECRET!,
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

        // Get user info from Microsoft Graph
        const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { 'Authorization': `Bearer ${tokens.access_token}` }
        });

        const userInfo = await userResponse.json();

        // Calculate token expiry
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

        // Store integration
        const { error: upsertError } = await supabase
          .from('user_integrations')
          .upsert({
            user_id: userId,
            provider: 'microsoft',
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            email: userInfo.mail || userInfo.userPrincipalName,
            metadata: {
              displayName: userInfo.displayName,
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
          JSON.stringify({ success: true, email: userInfo.mail || userInfo.userPrincipalName }),
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

        // Get current integration
        const { data: integration, error: fetchError } = await supabase
          .from('user_integrations')
          .select('refresh_token')
          .eq('user_id', userId)
          .eq('provider', 'microsoft')
          .single();

        if (fetchError || !integration?.refresh_token) {
          return new Response(
            JSON.stringify({ error: 'No refresh token available' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Refresh the token
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

        if (!tokenResponse.ok) {
          return new Response(
            JSON.stringify({ error: 'Token refresh failed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokens = await tokenResponse.json();
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + tokens.expires_in);

        // Update stored tokens
        await supabase
          .from('user_integrations')
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || integration.refresh_token,
            token_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('provider', 'microsoft');

        return new Response(
          JSON.stringify({ success: true }),
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
          .eq('provider', 'microsoft');

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
    console.error('Microsoft auth error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
