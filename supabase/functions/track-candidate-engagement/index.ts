import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingEvent {
  type: 'email_open' | 'link_click' | 'prep_view' | 'company_view' | 'salary_tool';
  submission_id: string;
  candidate_id?: string;
  metadata?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle different content types
    let event: TrackingEvent;
    
    if (req.method === 'GET') {
      // Tracking pixel or redirect URL
      const url = new URL(req.url);
      const type = url.searchParams.get('type') as TrackingEvent['type'];
      const submissionId = url.searchParams.get('sid');
      const redirectUrl = url.searchParams.get('redirect');

      if (!type || !submissionId) {
        return new Response('Missing parameters', { status: 400, headers: corsHeaders });
      }

      event = { type, submission_id: submissionId };

      // Process the tracking event
      await processTrackingEvent(supabase, event);

      // Return appropriate response
      if (type === 'email_open') {
        // Return 1x1 transparent GIF
        const gif = new Uint8Array([
          0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
          0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
          0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
          0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
          0x01, 0x00, 0x3b
        ]);
        return new Response(gif, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      } else if (type === 'link_click' && redirectUrl) {
        // Redirect to the actual URL
        return Response.redirect(redirectUrl, 302);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST request with JSON body
    event = await req.json();
    await processTrackingEvent(supabase, event);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error tracking engagement:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processTrackingEvent(supabase: any, event: TrackingEvent) {
  console.log('Processing tracking event:', event);

  // Get current behavior data
  const { data: existing } = await supabase
    .from('candidate_behavior')
    .select('*')
    .eq('submission_id', event.submission_id)
    .maybeSingle();

  const updates: Record<string, any> = {
    last_engagement_at: new Date().toISOString(),
    days_since_engagement: 0,
    updated_at: new Date().toISOString(),
  };

  switch (event.type) {
    case 'email_open':
      updates.emails_opened = (existing?.emails_opened || 0) + 1;
      break;
    case 'link_click':
      updates.links_clicked = (existing?.links_clicked || 0) + 1;
      break;
    case 'prep_view':
      updates.prep_materials_viewed = (existing?.prep_materials_viewed || 0) + 1;
      // Increase readiness score
      updates.interview_readiness_score = Math.min(100, (existing?.interview_readiness_score || 50) + 5);
      break;
    case 'company_view':
      updates.company_profile_viewed = true;
      // Increase confidence score
      updates.confidence_score = Math.min(100, (existing?.confidence_score || 50) + 3);
      break;
    case 'salary_tool':
      updates.salary_tool_used = true;
      break;
  }

  // Calculate engagement level
  const totalEngagements = 
    (updates.emails_opened || existing?.emails_opened || 0) +
    (updates.links_clicked || existing?.links_clicked || 0) +
    (updates.prep_materials_viewed || existing?.prep_materials_viewed || 0);

  if (totalEngagements >= 10) {
    updates.engagement_level = 'high';
  } else if (totalEngagements >= 5) {
    updates.engagement_level = 'medium';
  } else if (totalEngagements >= 2) {
    updates.engagement_level = 'neutral';
  } else {
    updates.engagement_level = 'low';
  }

  // Update motivation indicators
  const motivationIndicators = existing?.motivation_indicators || [];
  if (updates.company_profile_viewed && !motivationIndicators.includes('Firmenprofil angesehen')) {
    motivationIndicators.push('Firmenprofil angesehen');
    updates.motivation_indicators = motivationIndicators;
  }
  if ((updates.prep_materials_viewed || existing?.prep_materials_viewed || 0) >= 3 && 
      !motivationIndicators.includes('Aktive Vorbereitung')) {
    motivationIndicators.push('Aktive Vorbereitung');
    updates.motivation_indicators = motivationIndicators;
  }

  if (existing) {
    await supabase
      .from('candidate_behavior')
      .update(updates)
      .eq('submission_id', event.submission_id);
  } else if (event.candidate_id) {
    await supabase
      .from('candidate_behavior')
      .insert({
        submission_id: event.submission_id,
        candidate_id: event.candidate_id,
        ...updates,
      });
  }

  // Log the event
  await supabase.from('platform_events').insert({
    user_id: event.candidate_id || '00000000-0000-0000-0000-000000000000',
    event_type: `candidate_${event.type}`,
    entity_type: 'submission',
    entity_id: event.submission_id,
    metadata: event.metadata || {},
  });

  console.log('Tracking event processed successfully');
}
