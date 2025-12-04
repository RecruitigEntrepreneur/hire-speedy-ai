import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateAccessToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    const {
      submission_id,
      salary_offered,
      salary_currency = 'EUR',
      bonus_amount,
      equity_percentage,
      benefits = [],
      start_date,
      contract_type = 'permanent',
      probation_months = 6,
      remote_policy,
      location,
      custom_terms,
      expires_in_days = 7
    } = body;

    console.log('Creating offer for submission:', submission_id);

    // Get submission details
    const { data: submission, error: subError } = await supabase
      .from('submissions')
      .select(`
        *,
        jobs!inner(id, title, client_id, company_name),
        candidates!inner(id, full_name, email)
      `)
      .eq('id', submission_id)
      .single();

    if (subError || !submission) {
      throw new Error('Submission not found');
    }

    // Verify client owns this job
    if (submission.jobs.client_id !== user.id) {
      throw new Error('Not authorized to create offer for this submission');
    }

    // Generate unique access token
    const access_token = generateAccessToken();

    // Calculate expiry date
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + expires_in_days);

    // Create offer
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .insert({
        submission_id,
        job_id: submission.job_id,
        candidate_id: submission.candidate_id,
        client_id: user.id,
        recruiter_id: submission.recruiter_id,
        position_title: submission.jobs.title,
        salary_offered,
        salary_currency,
        original_salary: salary_offered,
        bonus_amount,
        equity_percentage,
        benefits,
        start_date,
        contract_type,
        probation_months,
        remote_policy,
        location: location || submission.jobs.company_name,
        custom_terms,
        status: 'draft',
        access_token,
        expires_at: expires_at.toISOString()
      })
      .select()
      .single();

    if (offerError) {
      console.error('Error creating offer:', offerError);
      throw new Error('Failed to create offer');
    }

    // Create offer event
    await supabase
      .from('offer_events')
      .insert({
        offer_id: offer.id,
        event_type: 'created',
        actor_type: 'client',
        actor_id: user.id,
        details: { salary_offered, contract_type }
      });

    // Update submission stage
    await supabase
      .from('submissions')
      .update({ stage: 'offer_pending', status: 'offer_extended' })
      .eq('id', submission_id);

    // Generate candidate link
    const candidateLink = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/offer/view/${access_token}`;

    console.log('Offer created successfully:', offer.id);

    return new Response(
      JSON.stringify({
        success: true,
        offer,
        candidate_link: candidateLink,
        access_token
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in create-offer:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
