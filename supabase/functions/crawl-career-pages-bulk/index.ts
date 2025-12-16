import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkCrawlResult {
  success: boolean;
  total: number;
  processed: number;
  results: {
    lead_id: string;
    company_name: string;
    status: 'success' | 'error' | 'skipped';
    hiring_activity?: string;
    live_jobs_count?: number;
    error?: string;
  }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_ids, force_refresh = false } = await req.json();

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'lead_ids array required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch leads in smaller batches to avoid URL length issues
    const FETCH_BATCH_SIZE = 20;
    const allLeads: any[] = [];
    
    for (let i = 0; i < lead_ids.length; i += FETCH_BATCH_SIZE) {
      const batchIds = lead_ids.slice(i, i + FETCH_BATCH_SIZE);
      const { data: batchLeads, error: batchError } = await supabase
        .from('outreach_leads')
        .select('id, company_name, company_domain, company_website, contact_email, career_crawled_at, hiring_activity')
        .in('id', batchIds);

      if (batchError) {
        console.error(`[Bulk Crawl] Batch fetch error:`, batchError);
        continue;
      }
      
      if (batchLeads) {
        allLeads.push(...batchLeads);
      }
    }

    if (allLeads.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No leads found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Bulk Crawl] Fetched ${allLeads.length} leads to process`);

    const results: BulkCrawlResult['results'] = [];
    const CONCURRENT_LIMIT = 3;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    // Process in batches
    for (let i = 0; i < allLeads.length; i += CONCURRENT_LIMIT) {
      const batch = allLeads.slice(i, i + CONCURRENT_LIMIT);
      
      const batchPromises = batch.map(async (lead) => {
        // Skip if recently crawled (within 24h) and not force refresh
        if (!force_refresh && lead.career_crawled_at) {
          const crawledAt = new Date(lead.career_crawled_at).getTime();
          const now = Date.now();
          if (now - crawledAt < ONE_DAY_MS) {
            return {
              lead_id: lead.id,
              company_name: lead.company_name,
              status: 'skipped' as const,
              hiring_activity: lead.hiring_activity,
              error: 'Recently crawled'
            };
          }
        }

        try {
          // Call the single crawl function
          const crawlResponse = await supabase.functions.invoke('crawl-career-page', {
            body: { lead_id: lead.id }
          });

          if (crawlResponse.error) {
            return {
              lead_id: lead.id,
              company_name: lead.company_name,
              status: 'error' as const,
              error: crawlResponse.error.message
            };
          }

          const crawlData = crawlResponse.data;
          return {
            lead_id: lead.id,
            company_name: lead.company_name,
            status: 'success' as const,
            hiring_activity: crawlData.hiring_activity,
            live_jobs_count: crawlData.live_jobs_count
          };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          return {
            lead_id: lead.id,
            company_name: lead.company_name,
            status: 'error' as const,
            error: errorMessage
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches
      if (i + CONCURRENT_LIMIT < allLeads.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const response: BulkCrawlResult = {
      success: true,
      total: lead_ids.length,
      processed: results.filter(r => r.status === 'success').length,
      results
    };

    console.log(`[Bulk Crawl] Processed ${response.processed}/${response.total} leads`);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Bulk Crawl] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
