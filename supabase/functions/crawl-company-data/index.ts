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

interface KeyExecutive {
  name: string;
  role: string;
  linkedin?: string;
}

interface CrawlResult {
  career_page_url?: string;
  career_page_status: 'found' | 'not_found' | 'error';
  live_jobs: LiveJob[];
  live_jobs_count: number;
  hiring_activity: 'hot' | 'active' | 'low' | 'none' | 'unknown';
  recent_news: NewsItem[];
  key_executives: KeyExecutive[];
  funding_stage?: string;
  funding_total?: string;
  remote_policy?: string;
  awards: string[];
  linkedin_url?: string;
  employee_growth?: string;
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

function extractRemotePolicy(text: string): string | null {
  const lowerText = text.toLowerCase();
  if (lowerText.includes('remote first') || lowerText.includes('remote-first') || lowerText.includes('vollständig remote')) {
    return 'remote_first';
  }
  if (lowerText.includes('hybrid') || lowerText.includes('teilweise remote')) {
    return 'hybrid';
  }
  if (lowerText.includes('vor ort') || lowerText.includes('office') || lowerText.includes('präsenz')) {
    return 'office';
  }
  return null;
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, domain, company_name, crawl_news = true, crawl_extended = true } = await req.json();

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
      key_executives: [],
      awards: [],
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
                'markdown',
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
                      remote_policy: { type: 'string' },
                      benefits: { type: 'array', items: { type: 'string' } },
                    },
                  },
                  prompt: 'Extract all job listings from this career page. For each job, extract the title, location, and department if available. Also extract any mentioned remote/hybrid work policy and company benefits.',
                },
              ],
              onlyMainContent: true,
              waitFor: 3000, // Wait for JavaScript-rendered content
            }),
          });

          if (scrapeResponse.ok) {
            const scrapeData = await scrapeResponse.json();
            const jsonData = scrapeData.data?.json || scrapeData.json;
            const pageLinks = scrapeData.data?.links || scrapeData.links || [];
            const markdown = scrapeData.data?.markdown || '';

            if (jsonData?.jobs && Array.isArray(jsonData.jobs) && jsonData.jobs.length > 0) {
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
            
            // Fallback: If JSON extraction failed, try to detect jobs from links
            if (result.live_jobs.length === 0 && pageLinks.length > 0) {
              const jobLinks = pageLinks.filter((l: string) => 
                /\/job[s]?\/|\/stelle[n]?\/|\/position[s]?\/|\/career[s]?\/|\/opening[s]?\//i.test(l) &&
                !l.endsWith('/jobs') && !l.endsWith('/careers') // Exclude main listing pages
              );
              
              if (jobLinks.length > 0) {
                console.log(`[Company Crawl] Fallback: Found ${jobLinks.length} job links`);
                result.live_jobs = jobLinks.slice(0, 20).map((url: string, i: number) => {
                  // Try to extract job title from URL
                  const pathParts = new URL(url).pathname.split('/').filter(Boolean);
                  const titlePart = pathParts[pathParts.length - 1] || `Position ${i + 1}`;
                  const title = titlePart
                    .replace(/-/g, ' ')
                    .replace(/_/g, ' ')
                    .replace(/\d+$/, '')
                    .trim();
                  
                  return {
                    title: title.charAt(0).toUpperCase() + title.slice(1),
                    url: url,
                  };
                });
              }
            }

            // Extract remote policy from markdown if not in JSON
            if (!jsonData?.remote_policy && markdown) {
              result.remote_policy = extractRemotePolicy(markdown) || undefined;
            } else if (jsonData?.remote_policy) {
              result.remote_policy = jsonData.remote_policy;
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
        const searchQuery = `"${companyNameToUse}" news OR pressemitteilung OR announcement 2024 2025`;
        
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

    // Step 4: Search for extended data (funding, executives, etc.)
    if (crawl_extended && companyNameToUse) {
      console.log(`[Company Crawl] Step 4: Searching for extended data about ${companyNameToUse}`);
      
      try {
        // Search for funding information
        const fundingQuery = `"${companyNameToUse}" funding OR finanzierung OR series site:techcrunch.com OR site:gruenderszene.de OR site:deutsche-startups.de 2024 2025`;
        
        const fundingResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: fundingQuery,
            limit: 5,
            lang: 'de',
          }),
        });

        if (fundingResponse.ok) {
          const fundingData = await fundingResponse.json();
          const fundingResults = fundingData.data || [];
          
          // Parse funding info from search results
          for (const item of fundingResults) {
            const text = (item.title + ' ' + (item.description || '')).toLowerCase();
            if (text.includes('series a')) result.funding_stage = 'Series A';
            else if (text.includes('series b')) result.funding_stage = 'Series B';
            else if (text.includes('series c')) result.funding_stage = 'Series C';
            else if (text.includes('seed')) result.funding_stage = 'Seed';
            else if (text.includes('ipo') || text.includes('börsengang')) result.funding_stage = 'Public';
            
            // Try to extract funding amount
            const amountMatch = text.match(/(\d+(?:,\d+)?(?:\.\d+)?)\s*(million|mio|mrd|billion)/i);
            if (amountMatch) {
              result.funding_total = `${amountMatch[1]} ${amountMatch[2]}`;
            }
            
            if (result.funding_stage) break;
          }
          
          console.log(`[Company Crawl] Funding stage: ${result.funding_stage || 'not found'}`);
        }

        // Search for LinkedIn company page
        const linkedinQuery = `site:linkedin.com/company "${companyNameToUse}"`;
        const linkedinResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: linkedinQuery,
            limit: 3,
          }),
        });

        if (linkedinResponse.ok) {
          const linkedinData = await linkedinResponse.json();
          const linkedinResults = linkedinData.data || [];
          
          for (const item of linkedinResults) {
            if (item.url && item.url.includes('linkedin.com/company')) {
              result.linkedin_url = item.url;
              break;
            }
          }
          
          console.log(`[Company Crawl] LinkedIn URL: ${result.linkedin_url || 'not found'}`);
        }

        // Search for awards
        const awardsQuery = `"${companyNameToUse}" award OR auszeichnung OR "best employer" OR "top arbeitgeber" 2024 2025`;
        const awardsResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: awardsQuery,
            limit: 5,
            lang: 'de',
          }),
        });

        if (awardsResponse.ok) {
          const awardsData = await awardsResponse.json();
          const awardsResults = awardsData.data || [];
          
          result.awards = awardsResults
            .filter((item: any) => item.title)
            .slice(0, 3)
            .map((item: any) => item.title);
          
          console.log(`[Company Crawl] Found ${result.awards.length} awards`);
        }

      } catch (extendedError) {
        console.error(`[Company Crawl] Extended data error:`, extendedError);
      }
    }

    // Calculate priority score
    let priorityScore = 0;
    priorityScore += result.live_jobs_count * 2;
    priorityScore += result.recent_news.length * 3;
    priorityScore += result.awards.length * 5;
    if (result.funding_stage) priorityScore += 15;
    if (result.hiring_activity === 'hot') priorityScore += 20;
    else if (result.hiring_activity === 'active') priorityScore += 10;

    // Update company in database if company_id provided
    if (company_id) {
      const updateData: Record<string, any> = {
        career_page_url: result.career_page_url,
        career_page_status: result.career_page_status,
        live_jobs: result.live_jobs,
        live_jobs_count: result.live_jobs_count,
        hiring_activity: result.hiring_activity,
        career_crawled_at: new Date().toISOString(),
        recent_news: result.recent_news,
        priority_score: priorityScore,
        updated_at: new Date().toISOString(),
      };

      if (crawl_news) {
        updateData.news_crawled_at = new Date().toISOString();
      }

      if (crawl_extended) {
        if (result.funding_stage) updateData.funding_stage = result.funding_stage;
        if (result.funding_total) updateData.funding_total = result.funding_total;
        if (result.linkedin_url) updateData.linkedin_url = result.linkedin_url;
        if (result.remote_policy) updateData.remote_policy = result.remote_policy;
        if (result.awards.length > 0) updateData.awards = result.awards;
        if (result.key_executives.length > 0) updateData.key_executives = result.key_executives;
      }

      const { error: updateError } = await supabase
        .from('outreach_companies')
        .update(updateData)
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
