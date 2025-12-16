const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LiveJob {
  title: string;
  location?: string;
  department?: string;
  url?: string;
}

interface NewsItem {
  title: string;
  url: string;
  date?: string;
  summary?: string;
  source?: string;
}

interface CrawlResult {
  career_page_url?: string;
  career_page_status: 'found' | 'not_found' | 'error';
  live_jobs: LiveJob[];
  live_jobs_count: number;
  hiring_activity: 'hot' | 'active' | 'low' | 'none' | 'unknown';
  recent_news: NewsItem[];
}

function classifyHiringActivity(jobCount: number): 'hot' | 'active' | 'low' | 'none' {
  if (jobCount >= 10) return 'hot';
  if (jobCount >= 5) return 'active';
  if (jobCount >= 1) return 'low';
  return 'none';
}

function findBestCareerUrl(links: string[], domain: string): string | null {
  const careerPatterns = [
    /\/karriere\/?$/i,
    /\/career[s]?\/?$/i,
    /\/job[s]?\/?$/i,
    /\/stellen\/?$/i,
    /\/arbeiten-bei/i,
    /\/join-us/i,
    /\/work-with-us/i,
    /\/offene-stellen/i,
    /\/team\/?$/i,
  ];

  const scoredLinks = links
    .filter(link => {
      try {
        const url = new URL(link);
        return url.hostname.includes(domain.replace(/^www\./, ''));
      } catch {
        return false;
      }
    })
    .map(link => {
      let score = 0;
      const lowerLink = link.toLowerCase();
      
      for (const pattern of careerPatterns) {
        if (pattern.test(lowerLink)) {
          score += 10;
          break;
        }
      }
      
      if (lowerLink.includes('karriere') || lowerLink.includes('career')) score += 5;
      if (lowerLink.includes('job')) score += 3;
      if (lowerLink.includes('stellen') || lowerLink.includes('positions')) score += 3;
      
      return { link, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scoredLinks.length > 0 ? scoredLinks[0].link : null;
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, domain, company_name, crawl_news = true } = await req.json();

    if (!company_id && !domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'company_id or domain required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company data if company_id provided
    let companyDomain = domain;
    let companyNameToUse = company_name;
    
    if (company_id) {
      const { data: company, error: companyError } = await supabase
        .from('outreach_companies')
        .select('domain, name')
        .eq('id', company_id)
        .single();

      if (companyError || !company) {
        return new Response(
          JSON.stringify({ success: false, error: 'Company not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      companyDomain = company.domain;
      companyNameToUse = company.name;
    }

    console.log(`[Company Crawl] Starting crawl for ${companyNameToUse} (${companyDomain})`);

    const result: CrawlResult = {
      career_page_status: 'not_found',
      live_jobs: [],
      live_jobs_count: 0,
      hiring_activity: 'unknown',
      recent_news: [],
    };

    // Format domain for URL
    let formattedDomain = companyDomain.trim().toLowerCase();
    if (!formattedDomain.startsWith('http')) {
      formattedDomain = `https://${formattedDomain}`;
    }

    // Step 1: Find career page using map
    console.log(`[Company Crawl] Step 1: Mapping ${formattedDomain} for career pages`);
    
    try {
      const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formattedDomain,
          limit: 100,
        }),
      });

      if (mapResponse.ok) {
        const mapData = await mapResponse.json();
        const links = mapData.links || [];
        console.log(`[Company Crawl] Found ${links.length} links`);

        const careerUrl = findBestCareerUrl(links, companyDomain);
        
        if (careerUrl) {
          result.career_page_url = careerUrl;
          result.career_page_status = 'found';
          console.log(`[Company Crawl] Found career page: ${careerUrl}`);

          // Step 2: Scrape career page for jobs
          console.log(`[Company Crawl] Step 2: Scraping career page for jobs`);
          
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: careerUrl,
              formats: [
                'links',
                {
                  type: 'json',
                  schema: {
                    type: 'object',
                    properties: {
                      jobs: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            location: { type: 'string' },
                            department: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                  prompt: 'Extract all job listings from this career page. For each job, extract the title, location, and department if available.',
                },
              ],
              onlyMainContent: true,
            }),
          });

          if (scrapeResponse.ok) {
            const scrapeData = await scrapeResponse.json();
            const jsonData = scrapeData.data?.json || scrapeData.json;
            const pageLinks = scrapeData.data?.links || scrapeData.links || [];

            if (jsonData?.jobs && Array.isArray(jsonData.jobs)) {
              result.live_jobs = jsonData.jobs.map((job: any, index: number) => ({
                title: job.title || `Position ${index + 1}`,
                location: job.location || undefined,
                department: job.department || undefined,
                url: pageLinks.find((l: string) => 
                  l.toLowerCase().includes('job') || 
                  l.toLowerCase().includes('stelle') ||
                  l.toLowerCase().includes('position')
                ) || careerUrl,
              }));
            }

            result.live_jobs_count = result.live_jobs.length;
            result.hiring_activity = classifyHiringActivity(result.live_jobs_count);
            console.log(`[Company Crawl] Found ${result.live_jobs_count} jobs - Activity: ${result.hiring_activity}`);
          }
        }
      }
    } catch (careerError) {
      console.error(`[Company Crawl] Career page crawl error:`, careerError);
      result.career_page_status = 'error';
    }

    // Step 3: Search for company news (if enabled)
    if (crawl_news && companyNameToUse) {
      console.log(`[Company Crawl] Step 3: Searching for news about ${companyNameToUse}`);
      
      try {
        const searchQuery = `"${companyNameToUse}" news OR pressemitteilung OR announcement 2024`;
        
        const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 10,
            lang: 'de',
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const newsResults = searchData.data || [];

          result.recent_news = newsResults
            .filter((item: any) => item.title && item.url)
            .slice(0, 5)
            .map((item: any) => ({
              title: item.title,
              url: item.url,
              summary: item.description || undefined,
              source: new URL(item.url).hostname.replace('www.', ''),
            }));

          console.log(`[Company Crawl] Found ${result.recent_news.length} news items`);
        }
      } catch (newsError) {
        console.error(`[Company Crawl] News search error:`, newsError);
      }
    }

    // Calculate priority score
    let priorityScore = 0;
    priorityScore += result.live_jobs_count * 2;
    priorityScore += result.recent_news.length * 3;
    if (result.hiring_activity === 'hot') priorityScore += 20;
    else if (result.hiring_activity === 'active') priorityScore += 10;

    // Update company in database if company_id provided
    if (company_id) {
      const { error: updateError } = await supabase
        .from('outreach_companies')
        .update({
          career_page_url: result.career_page_url,
          career_page_status: result.career_page_status,
          live_jobs: result.live_jobs,
          live_jobs_count: result.live_jobs_count,
          hiring_activity: result.hiring_activity,
          career_crawled_at: new Date().toISOString(),
          recent_news: result.recent_news,
          news_crawled_at: crawl_news ? new Date().toISOString() : undefined,
          priority_score: priorityScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', company_id);

      if (updateError) {
        console.error(`[Company Crawl] Update error:`, updateError);
      }
    }

    console.log(`[Company Crawl] Completed for ${companyNameToUse}`);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...result,
          priority_score: priorityScore,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Company Crawl] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
