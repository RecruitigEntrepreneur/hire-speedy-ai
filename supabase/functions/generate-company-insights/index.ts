import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyInsight {
  id: string;
  type: 'hiring' | 'funding' | 'management' | 'expansion' | 'news' | 'tech';
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  weight: number;
  outreach_angle?: string;
  relevant_roles?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id } = await req.json();

    if (!company_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'company_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch company data
    const { data: company, error: companyError } = await supabase
      .from('outreach_companies')
      .select('*')
      .eq('id', company_id)
      .single();

    if (companyError || !company) {
      return new Response(
        JSON.stringify({ success: false, error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch existing intelligence
    const { data: intelligence } = await supabase
      .from('company_intelligence')
      .select('*')
      .eq('company_id', company_id)
      .order('captured_at', { ascending: false })
      .limit(20);

    console.log(`[Insights] Generating insights for ${company.name}`);

    const insights: CompanyInsight[] = [];
    let totalScore = 0;

    // Analyze hiring signals
    const liveJobs = Array.isArray(company.live_jobs) ? company.live_jobs : [];
    if (liveJobs.length > 0) {
      const hiringWeight = liveJobs.length >= 10 ? 100 : liveJobs.length >= 5 ? 70 : 40;
      totalScore += hiringWeight;
      
      insights.push({
        id: 'hiring_pressure',
        type: 'hiring',
        title: `${liveJobs.length} offene Stellen`,
        description: liveJobs.length >= 10 
          ? 'Starker Hiring-Druck - idealer Zeitpunkt für Recruiting-Ansprache'
          : liveJobs.length >= 5
            ? 'Aktives Hiring - gute Gelegenheit für Kontaktaufnahme'
            : 'Moderates Hiring - gezieltes Ansprechen möglich',
        importance: liveJobs.length >= 10 ? 'high' : liveJobs.length >= 5 ? 'medium' : 'low',
        weight: hiringWeight,
        outreach_angle: 'talent_pipeline',
        relevant_roles: ['hr', 'cto', 'ceo'],
      });

      // Analyze job types
      const techJobs = liveJobs.filter((j: any) => 
        /engineer|developer|tech|software|data|devops|cloud/i.test(j.title || '')
      );
      if (techJobs.length > 0) {
        insights.push({
          id: 'tech_hiring',
          type: 'hiring',
          title: `${techJobs.length} Tech-Positionen offen`,
          description: 'Fokus auf technische Rollen - Tech-Recruiting Angle relevant',
          importance: techJobs.length >= 5 ? 'high' : 'medium',
          weight: techJobs.length >= 5 ? 60 : 30,
          outreach_angle: 'tech_talent',
          relevant_roles: ['cto', 'engineering_lead'],
        });
        totalScore += techJobs.length >= 5 ? 60 : 30;
      }
    }

    // Analyze news/events
    const recentNews = Array.isArray(company.recent_news) ? company.recent_news : [];
    const intelligenceEvents = intelligence || [];

    // Check for funding signals
    const fundingNews = [...recentNews, ...intelligenceEvents].filter((item: any) => 
      /funding|finanzierung|series|investment|raised|million|mio/i.test(item.title || item.description || '')
    );
    if (fundingNews.length > 0) {
      totalScore += 80;
      insights.push({
        id: 'recent_funding',
        type: 'funding',
        title: 'Kürzliche Finanzierung',
        description: 'Frisches Kapital bedeutet oft Wachstum und neue Stellen',
        importance: 'high',
        weight: 80,
        outreach_angle: 'scaling',
        relevant_roles: ['cfo', 'ceo', 'hr'],
      });
    }

    // Check for expansion signals
    const expansionNews = [...recentNews, ...intelligenceEvents].filter((item: any) => 
      /expansion|neuer standort|new office|wachstum|growth|international/i.test(item.title || item.description || '')
    );
    if (expansionNews.length > 0) {
      totalScore += 60;
      insights.push({
        id: 'expansion',
        type: 'expansion',
        title: 'Expansion/Wachstum',
        description: 'Unternehmen expandiert - erhöhter Personalbedarf wahrscheinlich',
        importance: 'high',
        weight: 60,
        outreach_angle: 'scaling',
        relevant_roles: ['hr', 'ceo', 'coo'],
      });
    }

    // Check for management changes
    const managementNews = [...recentNews, ...intelligenceEvents].filter((item: any) => 
      /ceo|cto|cfo|chief|geschäftsführ|neuer leiter|new head|appointed/i.test(item.title || item.description || '')
    );
    if (managementNews.length > 0) {
      totalScore += 70;
      insights.push({
        id: 'management_change',
        type: 'management',
        title: 'Management-Wechsel',
        description: 'Neues Management = oft neue Strategien und Team-Aufbau',
        importance: 'high',
        weight: 70,
        outreach_angle: 'new_leadership',
        relevant_roles: ['ceo', 'hr'],
      });
    }

    // Tech stack insight
    const technologies = Array.isArray(company.technologies) ? company.technologies : [];
    if (technologies.length > 0) {
      totalScore += 20;
      insights.push({
        id: 'tech_stack',
        type: 'tech',
        title: `Tech-Stack: ${technologies.slice(0, 3).join(', ')}${technologies.length > 3 ? '...' : ''}`,
        description: 'Bekannter Tech-Stack ermöglicht gezieltes Matching',
        importance: 'low',
        weight: 20,
        relevant_roles: ['cto', 'engineering_lead'],
      });
    }

    // Calculate intelligence score (0-100)
    const intelligenceScore = Math.min(100, Math.round(totalScore / (insights.length || 1)));

    // Sort insights by weight
    insights.sort((a, b) => b.weight - a.weight);

    // Update company intelligence score
    await supabase
      .from('outreach_companies')
      .update({ 
        intelligence_score: intelligenceScore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', company_id);

    console.log(`[Insights] Generated ${insights.length} insights with score ${intelligenceScore}`);

    return new Response(
      JSON.stringify({
        success: true,
        company_id,
        intelligence_score: intelligenceScore,
        insights,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Insights] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
