import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HubSpotContact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  jobtitle?: string;
  company?: string;
  notes?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const hubspotApiKey = Deno.env.get('HUBSPOT_API_KEY');

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get user ID from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, contact } = await req.json();
    console.log(`[HubSpot Sync] Action: ${action}, User: ${user.id}`);

    if (action === 'fetch_contacts') {
      // If no HubSpot API key, return demo data
      if (!hubspotApiKey) {
        console.log('[HubSpot Sync] No API key, returning demo data');
        const demoContacts: HubSpotContact[] = [
          { id: 'demo-1', firstname: 'Max', lastname: 'Mustermann', email: 'max@beispiel.de', phone: '+49 170 1234567', jobtitle: 'Software Engineer' },
          { id: 'demo-2', firstname: 'Anna', lastname: 'Schmidt', email: 'anna@beispiel.de', phone: '+49 171 9876543', jobtitle: 'Product Manager' },
          { id: 'demo-3', firstname: 'Thomas', lastname: 'Müller', email: 'thomas@beispiel.de', jobtitle: 'Sales Manager' },
          { id: 'demo-4', firstname: 'Lisa', lastname: 'Weber', email: 'lisa@beispiel.de', phone: '+49 172 5555555', jobtitle: 'UX Designer' },
          { id: 'demo-5', firstname: 'Stefan', lastname: 'Koch', email: 'stefan@beispiel.de', jobtitle: 'DevOps Engineer' },
        ];
        return new Response(
          JSON.stringify({ contacts: demoContacts, demo: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch from HubSpot API
      const response = await fetch(
        'https://api.hubapi.com/crm/v3/objects/contacts?limit=100&properties=firstname,lastname,email,phone,jobtitle,company',
        {
          headers: {
            'Authorization': `Bearer ${hubspotApiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[HubSpot Sync] API Error:', errorText);
        throw new Error(`HubSpot API error: ${response.status}`);
      }

      const hubspotData = await response.json();
      
      const contacts: HubSpotContact[] = hubspotData.results.map((contact: any) => ({
        id: contact.id,
        firstname: contact.properties.firstname || '',
        lastname: contact.properties.lastname || '',
        email: contact.properties.email || '',
        phone: contact.properties.phone,
        jobtitle: contact.properties.jobtitle,
        company: contact.properties.company,
      })).filter((c: HubSpotContact) => c.email);

      console.log(`[HubSpot Sync] Fetched ${contacts.length} contacts`);

      return new Response(
        JSON.stringify({ contacts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'import_contact' && contact) {
      // Check if candidate already exists
      const { data: existingCandidate } = await supabase
        .from('candidates')
        .select('id')
        .eq('email', contact.email)
        .eq('recruiter_id', user.id)
        .single();

      if (existingCandidate) {
        console.log(`[HubSpot Sync] Candidate ${contact.email} already exists, skipping`);
        return new Response(
          JSON.stringify({ skipped: true, reason: 'already_exists' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create candidate
      const { data: newCandidate, error: insertError } = await supabase
        .from('candidates')
        .insert({
          recruiter_id: user.id,
          full_name: `${contact.firstname} ${contact.lastname}`.trim(),
          email: contact.email,
          phone: contact.phone || null,
          skills: contact.jobtitle ? [contact.jobtitle] : [],
          summary: contact.company ? `Importiert aus HubSpot. Firma: ${contact.company}` : 'Importiert aus HubSpot',
        })
        .select()
        .single();

      if (insertError) {
        console.error('[HubSpot Sync] Insert error:', insertError);
        throw insertError;
      }

      // Log the activity
      await supabase
        .from('candidate_activity_log')
        .insert({
          candidate_id: newCandidate.id,
          recruiter_id: user.id,
          activity_type: 'hubspot_import',
          title: 'Aus HubSpot importiert',
          description: `Kontakt importiert: ${contact.firstname} ${contact.lastname}`,
          metadata: {
            hubspot_id: contact.id,
            jobtitle: contact.jobtitle,
            company: contact.company,
          },
        });

      console.log(`[HubSpot Sync] Created candidate ${newCandidate.id} from HubSpot contact ${contact.id}`);

      return new Response(
        JSON.stringify({ success: true, candidate_id: newCandidate.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[HubSpot Sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
