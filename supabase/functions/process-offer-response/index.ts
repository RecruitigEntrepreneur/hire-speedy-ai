import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { notifyLang, tx } from "../_shared/notify-i18n.ts";

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

          // Notify client and recruiter (jeweils in der Sprache des Empfängers)
          const [vcl, vrl] = await Promise.all([notifyLang(supabase, offer.client_id), notifyLang(supabase, offer.submissions.recruiter_id)]);
          const fn = offer.candidates.full_name;
          await supabase.from('notifications').insert([
            {
              user_id: offer.client_id,
              type: 'offer_viewed',
              title: tx(vcl, 'Angebot angesehen', 'Offer viewed', 'Erbjudandet visat', 'Tilbudet sett'),
              message: tx(vcl, `${fn} hat das Angebot geöffnet.`, `${fn} has opened the offer.`, `${fn} har öppnat erbjudandet.`, `${fn} har åpnet tilbudet.`),
              related_type: 'offer',
              related_id: offer.id
            },
            {
              user_id: offer.submissions.recruiter_id,
              type: 'offer_viewed',
              title: tx(vrl, 'Angebot angesehen', 'Offer viewed', 'Erbjudandet visat', 'Tilbudet sett'),
              message: tx(vrl, `${fn} hat das Angebot angesehen.`, `${fn} has viewed the offer.`, `${fn} har tittat på erbjudandet.`, `${fn} har sett på tilbudet.`),
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
          // Nur stage schreiben — status leitet der DB-Trigger ab.
          .update({ stage: 'placed' })
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

        // Notify all parties (jeweils in der Sprache des Empfängers)
        const [acl, arl] = await Promise.all([notifyLang(supabase, offer.client_id), notifyLang(supabase, offer.submissions.recruiter_id)]);
        const afn = offer.candidates.full_name;
        const payout = (l: string) => recruiterPayout.toLocaleString(l === 'en' ? 'en-GB' : l === 'sv' ? 'sv-SE' : l === 'nb' ? 'nb-NO' : 'de-DE');
        await supabase.from('notifications').insert([
          {
            user_id: offer.client_id,
            type: 'offer_accepted',
            title: tx(acl, '🎉 Angebot angenommen!', '🎉 Offer accepted!', '🎉 Erbjudandet accepterat!', '🎉 Tilbudet akseptert!'),
            message: tx(acl, `${afn} hat das Angebot für ${offer.position_title} angenommen!`, `${afn} has accepted the offer for ${offer.position_title}!`, `${afn} har accepterat erbjudandet för ${offer.position_title}!`, `${afn} har akseptert tilbudet for ${offer.position_title}!`),
            related_type: 'offer',
            related_id: offer.id
          },
          {
            user_id: offer.submissions.recruiter_id,
            type: 'placement_created',
            title: tx(arl, '🎉 Placement erstellt!', '🎉 Placement created!', '🎉 Placering skapad!', '🎉 Plassering opprettet!'),
            message: tx(arl, `${afn} wurde erfolgreich platziert. Provision: ${payout(arl)} €`, `${afn} has been placed successfully. Commission: ${payout(arl)} €`, `${afn} har placerats. Provision: ${payout(arl)} €`, `${afn} er plassert. Provisjon: ${payout(arl)} €`),
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

        // Notify client and recruiter (jeweils in der Sprache des Empfängers)
        const [rcl, rrl] = await Promise.all([notifyLang(supabase, offer.client_id), notifyLang(supabase, offer.submissions.recruiter_id)]);
        const rfn = offer.candidates.full_name;
        await supabase.from('notifications').insert([
          {
            user_id: offer.client_id,
            type: 'offer_rejected',
            title: tx(rcl, 'Angebot abgelehnt', 'Offer declined', 'Erbjudandet avböjt', 'Tilbudet avslått'),
            message: `${tx(rcl, `${rfn} hat das Angebot abgelehnt.`, `${rfn} has declined the offer.`, `${rfn} har tackat nej till erbjudandet.`, `${rfn} har takket nei til tilbudet.`)}${rejection_reason ? tx(rcl, ` Grund: ${rejection_reason}`, ` Reason: ${rejection_reason}`, ` Skäl: ${rejection_reason}`, ` Grunn: ${rejection_reason}`) : ''}`,
            related_type: 'offer',
            related_id: offer.id
          },
          {
            user_id: offer.submissions.recruiter_id,
            type: 'offer_rejected',
            title: tx(rrl, 'Angebot abgelehnt', 'Offer declined', 'Erbjudandet avböjt', 'Tilbudet avslått'),
            message: tx(rrl, `${rfn} hat das Angebot abgelehnt.`, `${rfn} has declined the offer.`, `${rfn} har tackat nej till erbjudandet.`, `${rfn} har takket nei til tilbudet.`),
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

        // Notify client (in seiner Sprache)
        const ccl = await notifyLang(supabase, offer.client_id);
        const amount = counter_offer_salary.toLocaleString(ccl === 'en' ? 'en-GB' : ccl === 'sv' ? 'sv-SE' : ccl === 'nb' ? 'nb-NO' : 'de-DE');
        await supabase.from('notifications').insert({
          user_id: offer.client_id,
          type: 'counter_offer',
          title: tx(ccl, 'Gegenangebot erhalten', 'Counter-offer received', 'Motbud mottaget', 'Motbud mottatt'),
          message: tx(ccl, `${offer.candidates.full_name} hat ein Gegenangebot gemacht: ${amount} €`, `${offer.candidates.full_name} has made a counter-offer: ${amount} €`, `${offer.candidates.full_name} har lagt ett motbud: ${amount} €`, `${offer.candidates.full_name} har gitt et motbud: ${amount} €`),
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
