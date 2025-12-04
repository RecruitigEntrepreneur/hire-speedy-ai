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

    const {
      access_token,
      action, // 'view', 'accept', 'reject', 'counter_offer'
      signature,
      rejection_reason,
      counter_offer_salary,
      counter_offer_notes
    } = await req.json();

    console.log('Processing offer response:', { access_token, action });

    // Get offer by access token
    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select(`
        *,
        candidates!inner(id, full_name, email),
        jobs!inner(id, title, company_name, fee_percentage, recruiter_fee_percentage),
        submissions!inner(id, recruiter_id)
      `)
      .eq('access_token', access_token)
      .single();

    if (offerError || !offer) {
      throw new Error('Offer not found or invalid token');
    }

    // Check if offer is expired
    if (new Date(offer.expires_at) < new Date() && action !== 'view') {
      throw new Error('Offer has expired');
    }

    // Check if offer is still valid for response
    if (['accepted', 'rejected', 'expired', 'withdrawn'].includes(offer.status) && action !== 'view') {
      throw new Error(`Offer is already ${offer.status}`);
    }

    switch (action) {
      case 'view':
        // Mark as viewed
        if (!offer.viewed_at) {
          await supabase
            .from('offers')
            .update({ viewed_at: new Date().toISOString() })
            .eq('id', offer.id);

          await supabase.from('offer_events').insert({
            offer_id: offer.id,
            event_type: 'viewed',
            actor_type: 'candidate',
            details: {}
          });

          // Notify client and recruiter
          await supabase.from('notifications').insert([
            {
              user_id: offer.client_id,
              type: 'offer_viewed',
              title: 'Angebot angesehen',
              message: `${offer.candidates.full_name} hat das Angebot geöffnet.`,
              related_type: 'offer',
              related_id: offer.id
            },
            {
              user_id: offer.submissions.recruiter_id,
              type: 'offer_viewed',
              title: 'Angebot angesehen',
              message: `${offer.candidates.full_name} hat das Angebot angesehen.`,
              related_type: 'offer',
              related_id: offer.id
            }
          ]);
        }
        break;

      case 'accept':
        if (!signature) {
          throw new Error('Signature required for acceptance');
        }

        // Update offer
        await supabase
          .from('offers')
          .update({
            status: 'accepted',
            decision_at: new Date().toISOString(),
            candidate_signature: signature,
            candidate_signed_at: new Date().toISOString()
          })
          .eq('id', offer.id);

        // Create offer event
        await supabase.from('offer_events').insert({
          offer_id: offer.id,
          event_type: 'accepted',
          actor_type: 'candidate',
          details: { signature: '***' }
        });

        // Update submission status
        await supabase
          .from('submissions')
          .update({ status: 'placed', stage: 'placed' })
          .eq('id', offer.submission_id);

        // Calculate fees and create placement
        const totalFee = Math.round(offer.salary_offered * (offer.jobs.fee_percentage || 20) / 100);
        const recruiterPayout = Math.round(totalFee * (offer.jobs.recruiter_fee_percentage || 15) / (offer.jobs.fee_percentage || 20));
        const platformFee = totalFee - recruiterPayout;

        // Calculate escrow release date (90 days from start)
        const startDate = offer.start_date ? new Date(offer.start_date) : new Date();
        const escrowReleaseDate = new Date(startDate);
        escrowReleaseDate.setDate(escrowReleaseDate.getDate() + 90);

        await supabase.from('placements').insert({
          submission_id: offer.submission_id,
          agreed_salary: offer.salary_offered,
          start_date: offer.start_date,
          total_fee: totalFee,
          recruiter_payout: recruiterPayout,
          platform_fee: platformFee,
          escrow_status: 'pending',
          payment_status: 'pending',
          escrow_release_date: escrowReleaseDate.toISOString()
        });

        // Notify all parties
        await supabase.from('notifications').insert([
          {
            user_id: offer.client_id,
            type: 'offer_accepted',
            title: '🎉 Angebot angenommen!',
            message: `${offer.candidates.full_name} hat das Angebot für ${offer.position_title} angenommen!`,
            related_type: 'offer',
            related_id: offer.id
          },
          {
            user_id: offer.submissions.recruiter_id,
            type: 'placement_created',
            title: '🎉 Placement erstellt!',
            message: `${offer.candidates.full_name} wurde erfolgreich platziert. Provision: ${recruiterPayout.toLocaleString('de-DE')} €`,
            related_type: 'placement',
            related_id: offer.id
          }
        ]);

        console.log('Offer accepted, placement created');
        break;

      case 'reject':
        await supabase
          .from('offers')
          .update({
            status: 'rejected',
            decision_at: new Date().toISOString(),
            rejection_reason
          })
          .eq('id', offer.id);

        await supabase.from('offer_events').insert({
          offer_id: offer.id,
          event_type: 'rejected',
          actor_type: 'candidate',
          details: { reason: rejection_reason }
        });

        // Notify client and recruiter
        await supabase.from('notifications').insert([
          {
            user_id: offer.client_id,
            type: 'offer_rejected',
            title: 'Angebot abgelehnt',
            message: `${offer.candidates.full_name} hat das Angebot abgelehnt.${rejection_reason ? ` Grund: ${rejection_reason}` : ''}`,
            related_type: 'offer',
            related_id: offer.id
          },
          {
            user_id: offer.submissions.recruiter_id,
            type: 'offer_rejected',
            title: 'Angebot abgelehnt',
            message: `${offer.candidates.full_name} hat das Angebot abgelehnt.`,
            related_type: 'offer',
            related_id: offer.id
          }
        ]);

        console.log('Offer rejected');
        break;

      case 'counter_offer':
        if (!counter_offer_salary) {
          throw new Error('Counter offer salary required');
        }

        await supabase
          .from('offers')
          .update({
            status: 'negotiating',
            counter_offer_salary,
            counter_offer_notes,
            counter_offer_at: new Date().toISOString(),
            negotiation_rounds: (offer.negotiation_rounds || 0) + 1
          })
          .eq('id', offer.id);

        await supabase.from('offer_events').insert({
          offer_id: offer.id,
          event_type: 'counter_offer',
          actor_type: 'candidate',
          details: { counter_offer_salary, notes: counter_offer_notes }
        });

        // Notify client
        await supabase.from('notifications').insert({
          user_id: offer.client_id,
          type: 'counter_offer',
          title: 'Gegenangebot erhalten',
          message: `${offer.candidates.full_name} hat ein Gegenangebot gemacht: ${counter_offer_salary.toLocaleString('de-DE')} €`,
          related_type: 'offer',
          related_id: offer.id
        });

        console.log('Counter offer submitted');
        break;

      default:
        throw new Error('Invalid action');
    }

    // Return updated offer
    const { data: updatedOffer } = await supabase
      .from('offers')
      .select('*')
      .eq('id', offer.id)
      .single();

    return new Response(
      JSON.stringify({ success: true, offer: updatedOffer }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-offer-response:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
