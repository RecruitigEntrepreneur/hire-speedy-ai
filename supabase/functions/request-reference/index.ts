import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPublicAppUrl } from "../_shared/app-url.ts";
import { mailFrom } from "../_shared/intake-mail.ts";
import { normLang, tr, type Lang } from "../_shared/i18n.ts";
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      submission_id,
      candidate_id,
      reference_name,
      reference_email,
      reference_phone,
      reference_company,
      reference_position,
      relationship,
      lang: bodyLang,
    } = await req.json();

    if (!submission_id || !candidate_id || !reference_name || !reference_email) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get candidate details
    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('full_name, recruiter_id')
      .eq('id', candidate_id)
      .single();

    if (candidateError || !candidate) {
      return new Response(JSON.stringify({ error: 'Candidate not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is the recruiter
    if (candidate.recruiter_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate secure token
    const accessToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days

    // Create reference request
    const { data: request, error: requestError } = await supabase
      .from('reference_requests')
      .insert({
        submission_id,
        candidate_id,
        reference_name,
        reference_email,
        reference_phone,
        reference_company,
        reference_position,
        relationship,
        access_token: accessToken,
        requested_by: user.id,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (requestError) {
      console.error('Error creating reference request:', requestError);
      return new Response(JSON.stringify({ error: 'Failed to create request' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send email to reference person
    if (resendApiKey) {
      // Referenzgeber: Sprache, die der Headhunter mitschickt, sonst die des Kandidaten (= die seines Headhunters)
      const lang: Lang = normLang(bodyLang) ?? await candidateLanguage(supabase, candidate.recruiter_id);
      const L = (de: string, en: string, sv: string, nb: string, vars?: Record<string, string>) => tr(lang, { de, en, sv, nb }, vars);
      const referenceUrl = withLang(`${getPublicAppUrl()}/reference/${accessToken}`, lang);
      
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: mailFrom(),
            to: [reference_email],
            subject: L('Referenzanfrage für {c}', 'Reference request for {c}', 'Referensförfrågan för {c}', 'Referanseforespørsel for {c}', { c: candidate.full_name }),
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${L('Referenzanfrage', 'Reference request', 'Referensförfrågan', 'Referanseforespørsel')}</h2>
                <p>${L('Sehr geehrte/r {n},', 'Dear {n},', 'Hej {n},', 'Hei {n},', { n: reference_name })}</p>
                <p>${L('{c} hat Sie als Referenz angegeben. Wir würden uns freuen, wenn Sie uns ein kurzes Feedback zu Ihrer Zusammenarbeit geben könnten.', '{c} has named you as a reference. We would be grateful if you could give us brief feedback on your work together.', '{c} har angett dig som referens. Vi skulle uppskatta om du kunde ge oss en kort återkoppling om ert samarbete.', '{c} har oppgitt deg som referanse. Vi setter stor pris på om du kan gi oss en kort tilbakemelding om samarbeidet deres.', { c: candidate.full_name })}</p>
                <p>${L('Das Ausfüllen des Formulars dauert etwa 5 Minuten.', 'Filling in the form takes about 5 minutes.', 'Det tar ungefär 5 minuter att fylla i formuläret.', 'Det tar omtrent 5 minutter å fylle ut skjemaet.')}</p>
                <a href="${referenceUrl}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                  ${L('Referenz abgeben', 'Give a reference', 'Lämna referens', 'Gi referanse')}
                </a>
                <p style="color: #666; font-size: 14px;">
                  ${L('Dieser Link ist 14 Tage gültig. Ihre Angaben werden vertraulich behandelt.', 'This link is valid for 14 days. Your answers will be treated confidentially.', 'Länken gäller i 14 dagar. Dina uppgifter behandlas konfidentiellt.', 'Lenken gjelder i 14 dager. Opplysningene dine behandles konfidensielt.')}
                </p>
              </div>
            `,
          }),
        });
      } catch (emailError) {
        console.error('Error sending email:', emailError);
      }
    }

    console.log(`Reference request created for candidate ${candidate_id}`);

    return new Response(JSON.stringify({
      success: true,
      request: {
        id: request.id,
        reference_name: request.reference_name,
        reference_email: request.reference_email,
        expires_at: request.expires_at,
        status: request.status,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in request-reference:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
