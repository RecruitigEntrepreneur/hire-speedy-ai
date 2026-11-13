import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPublicAppUrl } from "../_shared/app-url.ts";
import { mailFrom } from "../_shared/intake-mail.ts";
import { intlLocale, tr } from "../_shared/i18n.ts";
import { candidateLanguage } from "../_shared/recipient-language.ts";
import { withLang } from "../_shared/mail-i18n.ts";

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

    // Mehrsprachigkeit (13.11.2026): Mail in der Sprache des Kandidaten (= die seines Headhunters);
    // ohne Sprache Deutsch, wortgleich wie bisher.
    const lang = await candidateLanguage(supabase, offer.recruiter_id);
    const t = (de: string, en: string, sv: string, nb: string, vars?: Record<string, string>) => tr(lang, { de, en, sv, nb }, vars);
    const loc = intlLocale(lang);

    // Generate candidate link
    // Kanonische Domain statt einer aus der Supabase-URL gebauten (die führte ins Leere).
    const candidateLink = withLang(`${getPublicAppUrl()}/offer/view/${offer.access_token}`, lang);

    // Format expiry date
    const expiresAt = new Date(offer.expires_at).toLocaleDateString(loc, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const subject = t('Jobangebot: {p}', 'Job offer: {p}', 'Jobberbjudande: {p}', 'Jobbtilbud: {p}', { p: offer.position_title });

    // Send email via Resend
    if (resendApiKey) {
      const emailBody = `
${t('Sehr geehrte(r) {n},', 'Dear {n},', 'Hej {n},', 'Hei {n},', { n: offer.candidates.full_name })}

${t('wir freuen uns, Ihnen ein Angebot für die Position "{p}" unterbreiten zu können!', 'We are pleased to offer you the position "{p}"!', 'Vi är glada att kunna erbjuda dig tjänsten "{p}"!', 'Vi er glade for å kunne tilby deg stillingen "{p}"!', { p: offer.position_title })}

📋 ${t('Angebotsdetails:', 'Offer details:', 'Detaljer om erbjudandet:', 'Detaljer om tilbudet:')}
• ${t('Position', 'Position', 'Tjänst', 'Stilling')}: ${offer.position_title}
• ${t('Jahresgehalt', 'Annual salary', 'Årslön', 'Årslønn')}: ${offer.salary_offered.toLocaleString(loc)} ${offer.salary_currency}
${offer.bonus_amount ? `• Bonus: ${offer.bonus_amount.toLocaleString(loc)} ${offer.salary_currency}` : ''}
• ${t('Vertragsart', 'Contract type', 'Anställningsform', 'Avtaletype')}: ${offer.contract_type === 'permanent' ? t('Unbefristet', 'Permanent', 'Tillsvidare', 'Fast') : offer.contract_type}
• ${t('Startdatum', 'Start date', 'Startdatum', 'Startdato')}: ${offer.start_date ? new Date(offer.start_date).toLocaleDateString(loc) : t('Nach Vereinbarung', 'By arrangement', 'Enligt överenskommelse', 'Etter avtale')}
${offer.remote_policy ? `• Remote: ${offer.remote_policy}` : ''}

${custom_message ? `${t('Nachricht', 'Message', 'Meddelande', 'Melding')}: ${custom_message}\n` : ''}

${t('Bitte prüfen Sie das vollständige Angebot unter folgendem Link:', 'Please review the full offer at the following link:', 'Se hela erbjudandet via länken nedan:', 'Se hele tilbudet via lenken nedenfor:')}
${candidateLink}

⏰ ${t('Das Angebot ist gültig bis: {d}', 'The offer is valid until: {d}', 'Erbjudandet gäller till: {d}', 'Tilbudet gjelder til: {d}', { d: expiresAt })}

${t('Mit freundlichen Grüßen', 'Kind regards', 'Vänliga hälsningar', 'Med vennlig hilsen')}
      `.trim();

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: mailFrom(),
          to: offer.candidates.email,
          subject,
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
        subject,
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
