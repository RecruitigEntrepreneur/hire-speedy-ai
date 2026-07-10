import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Öffentlicher, token-basierter Lookup für die Kandidaten-Antwortseite.
 *
 * Hintergrund: Kandidaten haben keine Accounts. Die Antwortseite konnte das
 * Interview bisher nie laden, weil alle RLS-Policies auf `interviews` einen
 * eingeloggten Recruiter/Client verlangen → der Opt-In-Link war tot.
 *
 * Diese Function (Service-Role, verify_jwt = false) gibt ausschließlich die
 * Felder zurück, die die Antwortseite braucht – KEINE Kandidaten-PII, keine
 * internen Notizen. Firmenname ist bewusst enthalten (Produktentscheidung:
 * der Kandidat sieht von Anfang an, welche Firma anfragt).
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== 'string' || token.length < 16) {
      return json({ error: 'Invalid token' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const select = `
      id,
      status,
      scheduled_at,
      proposed_slots,
      duration_minutes,
      meeting_format,
      meeting_link,
      onsite_address,
      client_message,
      submission:submissions(
        job:jobs(title, industry, company_name)
      )
    `;

    // response_token (neuer Flow) zuerst, selection_token (Legacy-Links) als Fallback
    let { data, error } = await supabase
      .from('interviews')
      .select(select)
      .eq('response_token', token)
      .maybeSingle();

    if (!data && !error) {
      const legacy = await supabase.from('interviews').select(select).eq('selection_token', token).maybeSingle();
      data = legacy.data;
      error = legacy.error;
    }

    if (error) {
      console.error('Token lookup error:', error);
      return json({ error: 'Lookup failed' }, 500);
    }
    if (!data) {
      return json({ error: 'Not found' }, 404);
    }

    const job = (data.submission as any)?.job ?? {};
    return json({
      interview: {
        id: data.id,
        status: data.status,
        scheduled_at: data.scheduled_at,
        proposed_slots: data.proposed_slots ?? [],
        duration_minutes: data.duration_minutes ?? 60,
        meeting_format: data.meeting_format ?? 'video',
        meeting_link: data.meeting_link ?? null,
        onsite_address: data.onsite_address ?? null,
        client_message: data.client_message ?? null,
        job: {
          title: job.title ?? 'Position',
          industry: job.industry ?? null,
          company_name: job.company_name ?? null,
        },
      },
    });
  } catch (e) {
    console.error('get-interview-by-token error:', e);
    return json({ error: 'Internal error' }, 500);
  }
});
