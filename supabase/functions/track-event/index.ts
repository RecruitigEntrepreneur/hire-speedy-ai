import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackEventRequest {
  event_type: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to get user info
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for inserting events
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: TrackEventRequest = await req.json();
    const { event_type, entity_type, entity_id, metadata, session_id } = body;

    if (!event_type) {
      return new Response(
        JSON.stringify({ error: 'event_type is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const userType = (roleData as any)?.role || 'unknown';

    // Calculate response time if this is a response event
    let responseTimeSeconds: number | null = null;
    if (event_type.includes('response') || event_type.includes('review') || event_type.includes('accept') || event_type.includes('reject')) {
      // Find the last event for this entity
      const { data: lastEvent } = await supabase
        .from('platform_events')
        .select('created_at')
        .eq('entity_type', entity_type)
        .eq('entity_id', entity_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastEvent) {
        const lastEventTime = new Date((lastEvent as any).created_at).getTime();
        const now = Date.now();
        responseTimeSeconds = Math.floor((now - lastEventTime) / 1000);
      }
    }

    // Get IP and User Agent
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                      req.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Insert event
    const { data: event, error: insertError } = await supabase
      .from('platform_events')
      .insert({
        event_type,
        user_id: user.id,
        user_type: userType,
        entity_type: entity_type || null,
        entity_id: entity_id || null,
        metadata: metadata || {},
        response_time_seconds: responseTimeSeconds,
        session_id: session_id || null,
        ip_address: ipAddress,
        user_agent: userAgent.substring(0, 500),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting event:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to track event' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this event should create or complete an SLA deadline
    await handleSlaDeadlines(supabase, event_type, entity_type, entity_id, user.id);

    console.log(`Event tracked: ${event_type} by ${userType} ${user.id}`);

    return new Response(
      JSON.stringify({ success: true, event_id: (event as any).id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in track-event:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleSlaDeadlines(
  supabase: any,
  eventType: string,
  entityType: string | undefined,
  entityId: string | undefined,
  userId: string
) {
  if (!entityType || !entityId) return;

  // Map events to SLA phases
  const eventToPhaseMap: Record<string, { phase: string; creates: boolean }> = {
    'submission_created': { phase: 'submitted', creates: true },
    'opt_in_requested': { phase: 'opt_in_requested', creates: true },
    'interview_requested': { phase: 'pending', creates: true },
    'interview_completed': { phase: 'completed', creates: true },
    'submission_reviewed': { phase: 'submitted', creates: false },
    'opt_in_responded': { phase: 'opt_in_requested', creates: false },
    'interview_scheduled': { phase: 'pending', creates: false },
    'interview_feedback_given': { phase: 'completed', creates: false },
  };

  const mapping = eventToPhaseMap[eventType];
  if (!mapping) return;

  try {
    if (mapping.creates) {
      // Get the applicable SLA rule
      const { data: rule } = await supabase
        .from('sla_rules')
        .select('*')
        .eq('entity_type', entityType)
        .eq('phase', mapping.phase)
        .eq('is_active', true)
        .single();

      if (rule) {
        // Determine responsible user
        let responsibleUserId = userId;
        
        // For submissions, the client is responsible for review
        if (entityType === 'submission' && mapping.phase === 'submitted') {
          const { data: submission } = await supabase
            .from('submissions')
            .select('job_id, jobs(client_id)')
            .eq('id', entityId)
            .single();
          
          if ((submission as any)?.jobs?.client_id) {
            responsibleUserId = (submission as any).jobs.client_id;
          }
        }

        const deadlineAt = new Date();
        deadlineAt.setHours(deadlineAt.getHours() + (rule as any).deadline_hours);

        let warningAt: Date | null = null;
        if ((rule as any).warning_hours) {
          warningAt = new Date();
          warningAt.setHours(warningAt.getHours() + ((rule as any).deadline_hours - (rule as any).warning_hours));
        }

        await supabase.from('sla_deadlines').insert({
          sla_rule_id: (rule as any).id,
          entity_type: entityType,
          entity_id: entityId,
          responsible_user_id: responsibleUserId,
          deadline_at: deadlineAt.toISOString(),
          warning_at: warningAt?.toISOString() || null,
        });
      }
    } else {
      // Complete the SLA deadline
      await supabase
        .from('sla_deadlines')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .eq('status', 'active');
    }
  } catch (error) {
    console.error('Error handling SLA deadlines:', error);
  }
}