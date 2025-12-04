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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { candidate_id, submission_id } = await req.json();

    if (!candidate_id || !submission_id) {
      throw new Error('candidate_id and submission_id are required');
    }

    console.log(`Detecting conflicts for candidate ${candidate_id}, submission ${submission_id}`);

    // Get current submission with job details
    const { data: currentSubmission, error: subError } = await supabase
      .from('submissions')
      .select(`
        *,
        job:jobs(id, client_id, industry, company_name)
      `)
      .eq('id', submission_id)
      .single();

    if (subError || !currentSubmission) {
      throw new Error('Submission not found');
    }

    // Get all other submissions for this candidate
    const { data: otherSubmissions, error: othersError } = await supabase
      .from('submissions')
      .select(`
        *,
        job:jobs(id, client_id, industry, company_name)
      `)
      .eq('candidate_id', candidate_id)
      .neq('id', submission_id)
      .not('status', 'eq', 'rejected');

    if (othersError) {
      throw othersError;
    }

    const conflicts = [];

    for (const otherSub of otherSubmissions || []) {
      // Check 1: Same client
      if (currentSubmission.job.client_id === otherSub.job.client_id) {
        conflicts.push({
          candidate_id,
          conflict_type: 'same_client',
          severity: 'high',
          submission_a_id: submission_id,
          submission_b_id: otherSub.id
        });
        continue;
      }

      // Check 2: Same industry (potential competitor)
      if (currentSubmission.job.industry && 
          currentSubmission.job.industry === otherSub.job.industry &&
          ['accepted', 'interview', 'offer'].includes(otherSub.status)) {
        conflicts.push({
          candidate_id,
          conflict_type: 'same_industry',
          severity: 'medium',
          submission_a_id: submission_id,
          submission_b_id: otherSub.id
        });
        continue;
      }

      // Check 3: Critical stage at another position
      if (['interview', 'offer'].includes(otherSub.status)) {
        conflicts.push({
          candidate_id,
          conflict_type: 'critical_stage',
          severity: otherSub.status === 'offer' ? 'high' : 'medium',
          submission_a_id: submission_id,
          submission_b_id: otherSub.id
        });
      }
    }

    // Insert conflicts (if any)
    let insertedCount = 0;
    for (const conflict of conflicts) {
      // Check if conflict already exists
      const { data: existing } = await supabase
        .from('candidate_conflicts')
        .select('id')
        .eq('candidate_id', conflict.candidate_id)
        .eq('submission_a_id', conflict.submission_a_id)
        .eq('submission_b_id', conflict.submission_b_id)
        .eq('resolved', false)
        .single();

      if (!existing) {
        const { error: insertError } = await supabase
          .from('candidate_conflicts')
          .insert(conflict);

        if (!insertError) {
          insertedCount++;

          // Create notification for high severity conflicts
          if (conflict.severity === 'high') {
            await supabase
              .from('notifications')
              .insert({
                user_id: currentSubmission.recruiter_id,
                type: 'conflict_detected',
                title: 'Konflikt erkannt',
                message: `Ein schwerwiegender Konflikt wurde für einen Kandidaten erkannt. Bitte prüfen Sie die Details.`,
                related_type: 'candidate',
                related_id: candidate_id
              });
          }
        }
      }
    }

    console.log(`Found ${conflicts.length} potential conflicts, inserted ${insertedCount} new conflicts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        conflicts_found: insertedCount,
        total_potential: conflicts.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error detecting conflicts:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
