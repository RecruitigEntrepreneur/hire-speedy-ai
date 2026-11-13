import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyLang, tx } from "../_shared/notify-i18n.ts";
import { defaultCtx } from "../_shared/interview-service.ts";
import { withdrawOpenOffers } from "../_shared/offer-service.ts";

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

    const { submission_id, reason_category, custom_feedback, rejection_stage } = await req.json();

    if (!submission_id || !reason_category) {
      throw new Error('submission_id and reason_category are required');
    }

    console.log(`Processing rejection for submission ${submission_id}`);

    // Get submission with candidate and job details
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select(`
        *,
        candidate:candidates(*),
        job:jobs(*)
      `)
      .eq('id', submission_id)
      .single();

    if (submissionError || !submission) {
      throw new Error('Submission not found');
    }

    // Get auth user from request
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(authHeader);
    
    if (!user) {
      throw new Error('Unauthorized');
    }

    // Nur der Kunde der Stelle (Inhaber oder aktives Teammitglied der Organisation)
    // darf absagen. Ohne diese Prüfung konnte jeder Eingeloggte per Submission-ID
    // jede Einreichung "als Kunde" ablehnen.
    const job = submission.job;
    let allowed = job?.client_id === user.id;
    if (!allowed && job?.organization_id) {
      const { data: member } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', job.organization_id)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      allowed = !!member;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Keine Berechtigung für diese Einreichung.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find matching rejection template
    const { data: template } = await supabase
      .from('rejection_templates')
      .select('*')
      .eq('stage', rejection_stage || 'screening')
      .eq('reason_category', reason_category)
      .eq('is_active', true)
      .single();

    // Create rejection record
    const { data: rejection, error: rejectionError } = await supabase
      .from('rejections')
      .insert({
        submission_id,
        rejection_stage: rejection_stage || 'screening',
        reason_category,
        rejection_reason: template?.body || `Rejected due to: ${reason_category}`,
        custom_feedback,
        rejected_by: user.id,
        template_id: template?.id || null,
        sent_via: ['email']
      })
      .select()
      .single();

    if (rejectionError) {
      console.error('Error creating rejection:', rejectionError);
      throw rejectionError;
    }

    // Läuft noch ein Angebot: geplante Mails an den Kandidaten abbrechen, Links sperren (02.11.2026).
    // Vor dem Stufenwechsel, denn danach setzt der Trigger cancel_orphaned_interviews_offers es auf „cancelled“
    try {
      await withdrawOpenOffers(defaultCtx(supabase), submission_id, null);
    } catch (offerError) {
      console.error('Error withdrawing offer:', offerError);
    }

    // Update submission status
    const { error: updateError } = await supabase
      .from('submissions')
      // Nur stage schreiben — status leitet der DB-Trigger ab.
      .update({ 
        stage: 'client_rejected',
        rejection_reason: custom_feedback || reason_category
      })
      .eq('id', submission_id);

    if (updateError) {
      console.error('Error updating submission:', updateError);
      throw updateError;
    }

    // Create notification for recruiter (in seiner Profilsprache)
    const rl = await notifyLang(supabase, submission.recruiter_id);
    await supabase
      .from('notifications')
      .insert({
        user_id: submission.recruiter_id,
        type: 'candidate_rejected',
        title: tx(rl, 'Kandidat abgelehnt', 'Candidate rejected', 'Kandidat avböjd', 'Kandidat avslått'),
        message: tx(rl, `${submission.candidate.full_name} wurde für ${submission.job.title} abgelehnt. Grund: ${reason_category}`, `${submission.candidate.full_name} was rejected for ${submission.job.title}. Reason: ${reason_category}`, `${submission.candidate.full_name} fick avslag för ${submission.job.title}. Skäl: ${reason_category}`, `${submission.candidate.full_name} fikk avslag for ${submission.job.title}. Grunn: ${reason_category}`),
        related_type: 'submission',
        related_id: submission_id
      });

    // Keine automatische Mail an den Kandidaten: der Headhunter informiert ihn
    // persönlich (Aufgabe "Kunde hat abgesagt"), und ein Firmenname darf vor dem
    // Reveal ohnehin nicht an den Kandidaten gehen.

    // Log activity
    await supabase
      .from('activity_logs')
      .insert({
        user_id: user.id,
        action: 'candidate_rejected',
        entity_type: 'submission',
        entity_id: submission_id,
        details: {
          candidate_name: submission.candidate.full_name,
          job_title: submission.job.title,
          reason_category,
          custom_feedback
        }
      });

    console.log(`Rejection processed successfully for submission ${submission_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        rejection_id: rejection.id 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error processing rejection:', error);
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
