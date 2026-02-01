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
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://hire-speedy-ai.lovable.app';

// Redirect URI points to frontend OAuth callback
const getRedirectUri = () => {
  return `${FRONTEND_URL}/oauth/callback`;
};

// Helper to refresh token inline
async function refreshTokenInline(refreshToken: string) {
  const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID!,
      client_secret: MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  if (!tokenResponse.ok) {
    throw new Error('Token refresh failed');
  }

  return await tokenResponse.json();
}

// Helper to get valid access token (refreshing if needed)
async function getValidAccessToken(supabase: any, userId: string) {
  const { data: integration, error } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expires_at, email')
    .eq('user_id', userId)
    .eq('provider', 'microsoft')
    .single();

  if (error || !integration) {
    throw new Error('Microsoft integration not found');
  }

  // Check if token is expired (with 5 minute buffer)
  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();
  now.setMinutes(now.getMinutes() + 5);

  if (expiresAt < now) {
    // Token is expired, refresh it
    const tokens = await refreshTokenInline(integration.refresh_token);
    const newExpiresAt = new Date();
    newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokens.expires_in);

    // Update stored tokens
    await supabase
      .from('user_integrations')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || integration.refresh_token,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('provider', 'microsoft');

    return { accessToken: tokens.access_token, email: integration.email };
  }

  return { accessToken: integration.access_token, email: integration.email };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, ...body } = await req.json();
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader);
      userId = user?.id || null;
    }

    switch (action) {
      // ==================== CHECK CONFIG ====================
      case 'check-config': {
        // No auth required - just check if secrets are configured
        const configured = !!MICROSOFT_CLIENT_ID && !!MICROSOFT_CLIENT_SECRET;
        return new Response(
          JSON.stringify({ configured, provider: 'microsoft' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== GET AUTH URL ====================
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
          scope: 'openid profile email offline_access User.Read OnlineMeetings.ReadWrite Calendars.ReadWrite',
          state,
          response_mode: 'query'
        });

        const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;

        return new Response(
          JSON.stringify({ url, state }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== EXCHANGE CODE ====================
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

      // ==================== REFRESH TOKEN ====================
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
          .eq('provider', 'microsoft')
          .single();

        if (fetchError || !integration?.refresh_token) {
          return new Response(
            JSON.stringify({ error: 'No refresh token available' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const tokens = await refreshTokenInline(integration.refresh_token);
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
          .eq('user_id', userId)
          .eq('provider', 'microsoft');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ==================== DISCONNECT ====================
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

      // ==================== GET FREE/BUSY ====================
      case 'get-free-busy': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { startDate, endDate } = body;
        if (!startDate || !endDate) {
          return new Response(
            JSON.stringify({ error: 'startDate and endDate required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const { accessToken, email } = await getValidAccessToken(supabase, userId);

          // Call Microsoft Graph getSchedule API
          const scheduleResponse = await fetch(
            'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                schedules: [email],
                startTime: {
                  dateTime: startDate,
                  timeZone: 'Europe/Berlin'
                },
                endTime: {
                  dateTime: endDate,
                  timeZone: 'Europe/Berlin'
                },
                availabilityViewInterval: 30 // 30-minute slots
              })
            }
          );

          if (!scheduleResponse.ok) {
            const errorText = await scheduleResponse.text();
            console.error('Schedule API error:', errorText);
            return new Response(
              JSON.stringify({ error: 'Failed to get calendar schedule' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const scheduleData = await scheduleResponse.json();
          
          // Parse the schedule items
          const busySlots: Array<{ start: string; end: string; status: string }> = [];
          
          if (scheduleData.value && scheduleData.value[0]?.scheduleItems) {
            for (const item of scheduleData.value[0].scheduleItems) {
              busySlots.push({
                start: item.start.dateTime,
                end: item.end.dateTime,
                status: item.status // busy, tentative, oof, workingElsewhere, free
              });
            }
          }

          return new Response(
            JSON.stringify({ busySlots, email }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Get free/busy error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to get calendar availability' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // ==================== CREATE CALENDAR EVENT ====================
      case 'create-calendar-event': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { subject, start, end, bodyContent, showAs, location, attendees } = body;
        if (!subject || !start || !end) {
          return new Response(
            JSON.stringify({ error: 'subject, start, and end are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const { accessToken } = await getValidAccessToken(supabase, userId);

          const eventPayload: any = {
            subject,
            start: {
              dateTime: start,
              timeZone: 'Europe/Berlin'
            },
            end: {
              dateTime: end,
              timeZone: 'Europe/Berlin'
            },
            body: {
              contentType: 'HTML',
              content: bodyContent || ''
            },
            showAs: showAs || 'tentative',
            isReminderOn: true,
            reminderMinutesBeforeStart: 60
          };

          if (location) {
            eventPayload.location = { displayName: location };
          }

          if (attendees && attendees.length > 0) {
            eventPayload.attendees = attendees.map((email: string) => ({
              emailAddress: { address: email },
              type: 'required'
            }));
          }

          const eventResponse = await fetch(
            'https://graph.microsoft.com/v1.0/me/events',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(eventPayload)
            }
          );

          if (!eventResponse.ok) {
            const errorText = await eventResponse.text();
            console.error('Create event error:', errorText);
            return new Response(
              JSON.stringify({ error: 'Failed to create calendar event' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const eventData = await eventResponse.json();

          return new Response(
            JSON.stringify({ 
              success: true, 
              eventId: eventData.id,
              iCalUId: eventData.iCalUId,
              webLink: eventData.webLink
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Create calendar event error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to create calendar event' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // ==================== UPDATE CALENDAR EVENT ====================
      case 'update-calendar-event': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { eventId, updates } = body;
        if (!eventId || !updates) {
          return new Response(
            JSON.stringify({ error: 'eventId and updates are required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const { accessToken } = await getValidAccessToken(supabase, userId);

          const updatePayload: any = {};

          if (updates.subject) updatePayload.subject = updates.subject;
          if (updates.start) {
            updatePayload.start = { dateTime: updates.start, timeZone: 'Europe/Berlin' };
          }
          if (updates.end) {
            updatePayload.end = { dateTime: updates.end, timeZone: 'Europe/Berlin' };
          }
          if (updates.showAs) updatePayload.showAs = updates.showAs;
          if (updates.location) {
            updatePayload.location = { displayName: updates.location };
          }
          if (updates.bodyContent) {
            updatePayload.body = { contentType: 'HTML', content: updates.bodyContent };
          }

          const updateResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/events/${eventId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(updatePayload)
            }
          );

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            console.error('Update event error:', errorText);
            return new Response(
              JSON.stringify({ error: 'Failed to update calendar event' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Update calendar event error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to update calendar event' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // ==================== DELETE CALENDAR EVENT ====================
      case 'delete-calendar-event': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { eventId: deleteEventId } = body;
        if (!deleteEventId) {
          return new Response(
            JSON.stringify({ error: 'eventId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        try {
          const { accessToken } = await getValidAccessToken(supabase, userId);

          const deleteResponse = await fetch(
            `https://graph.microsoft.com/v1.0/me/events/${deleteEventId}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            }
          );

          if (!deleteResponse.ok && deleteResponse.status !== 404) {
            const errorText = await deleteResponse.text();
            console.error('Delete event error:', errorText);
            return new Response(
              JSON.stringify({ error: 'Failed to delete calendar event' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Delete calendar event error:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to delete calendar event' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
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