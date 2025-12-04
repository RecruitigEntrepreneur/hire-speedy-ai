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
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { offer_id, custom_message } = await req.json();

    console.log('Sending offer:', offer_id);

    // Get offer with relations
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select(`
        *,
        candidates!inner(id, full_name, email, preferred_channel),
        jobs!inner(id, title, company_name)
      `)
      .eq('id', offer_id)
      .single();

    if (offerError || !offer) {
      throw new Error('Offer not found');
    }

    // Verify client owns this offer
    if (offer.client_id !== user.id) {
      throw new Error('Not authorized to send this offer');
    }

    // Generate candidate link
    const candidateLink = `${supabaseUrl.replace('supabase.co', 'lovable.app')}/offer/view/${offer.access_token}`;

    // Format expiry date
    const expiresAt = new Date(offer.expires_at).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    // Send email via Resend
    if (resendApiKey) {
      const emailBody = `
Sehr geehrte(r) ${offer.candidates.full_name},

wir freuen uns, Ihnen ein Angebot für die Position "${offer.position_title}" unterbreiten zu können!

📋 Angebotsdetails:
• Position: ${offer.position_title}
• Jahresgehalt: ${offer.salary_offered.toLocaleString('de-DE')} ${offer.salary_currency}
${offer.bonus_amount ? `• Bonus: ${offer.bonus_amount.toLocaleString('de-DE')} ${offer.salary_currency}` : ''}
• Vertragsart: ${offer.contract_type === 'permanent' ? 'Unbefristet' : offer.contract_type}
• Startdatum: ${offer.start_date ? new Date(offer.start_date).toLocaleDateString('de-DE') : 'Nach Vereinbarung'}
${offer.remote_policy ? `• Remote: ${offer.remote_policy}` : ''}

${custom_message ? `Nachricht: ${custom_message}\n` : ''}

Bitte prüfen Sie das vollständige Angebot unter folgendem Link:
${candidateLink}

⏰ Das Angebot ist gültig bis: ${expiresAt}

Mit freundlichen Grüßen
      `.trim();

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'noreply@lovable.app',
          to: offer.candidates.email,
          subject: `Jobangebot: ${offer.position_title}`,
          text: emailBody
        })
      });

      if (!emailResponse.ok) {
        console.error('Email sending failed:', await emailResponse.text());
      } else {
        console.log('Email sent successfully');
      }

      // Log communication
      await supabase.from('communication_log').insert({
        candidate_id: offer.candidate_id,
        submission_id: offer.submission_id,
        channel: 'email',
        message_type: 'offer',
        subject: `Jobangebot: ${offer.position_title}`,
        body: emailBody,
        status: emailResponse.ok ? 'sent' : 'failed',
        sent_at: new Date().toISOString()
      });
    }

    // Update offer status
    const { error: updateError } = await supabase
      .from('offers')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
      .eq('id', offer_id);

    if (updateError) {
      console.error('Error updating offer:', updateError);
    }

    // Create offer event
    await supabase.from('offer_events').insert({
      offer_id,
      event_type: 'sent',
      actor_type: 'client',
      actor_id: user.id,
      details: { channel: 'email', custom_message }
    });

    // Notify recruiter
    await supabase.from('notifications').insert({
      user_id: offer.recruiter_id,
      type: 'offer_sent',
      title: 'Angebot gesendet',
      message: `Ein Angebot für ${offer.candidates.full_name} wurde gesendet.`,
      related_type: 'offer',
      related_id: offer_id
    });

    console.log('Offer sent successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Offer sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in send-offer:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
