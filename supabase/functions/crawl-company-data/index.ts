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
  // Company basics
  industry?: string;
  city?: string;
  country?: string;
  headcount?: string;
  founded_year?: string;
  // Career data
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

// NEW: Find the best job listing URL within a career site (for multi-step career pages)
function findBestJobListingUrl(links: string[], careerDomain: string): string | null {
  const jobListPatterns = [
    /\/positions\/?$/i,
    /\/open-positions\/?$/i,
    /\/all-positions\/?$/i,
    /\/offene-stellen\/?$/i,
    /\/stellenangebote\/?$/i,
    /\/jobs\/?$/i,
    /\/all-jobs\/?$/i,
    /\/vacancies\/?$/i,
    /\/openings\/?$/i,
    /\/karriere\/stellen\/?$/i,
  ];

  const scoredLinks = links
    .filter(link => {
      try {
        return link.startsWith(careerDomain) || new URL(link).origin === careerDomain;
      } catch {
        return false;
      }
    })
    .map(link => {
      let score = 0;
      const lowerLink = link.toLowerCase();
      
      // Highest priority for explicit job listing pages
      for (const pattern of jobListPatterns) {
        if (pattern.test(lowerLink)) {
          score += 20;
          break;
        }
      }
      
      // Bonus for "all" or "open" in path
      if (lowerLink.includes('/all') || lowerLink.includes('/open')) score += 5;
      if (lowerLink.includes('position') || lowerLink.includes('job')) score += 3;
      if (lowerLink.includes('stellen') || lowerLink.includes('vacanc')) score += 3;
      
      // Avoid landing pages that just have company/location names
      if (lowerLink.match(/\/[a-z-]+\/?$/) && !lowerLink.includes('job') && !lowerLink.includes('position')) {
        score -= 2;
      }
      
      return { link, score };
    })
    .filter(item => item.score > 5) // Only consider links with meaningful scores
    .sort((a, b) => b.score - a.score);

  return scoredLinks.length > 0 ? scoredLinks[0].link : null;
}

// NEW: Extract job info from a URL
function extractJobFromUrl(url: string): { title: string; url: string; location?: string } {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    
    // Find the job title segment (usually the last one)
    let titleSegment = segments[segments.length - 1] || 'Position';
    
    // Remove IDs and format nicely
    titleSegment = titleSegment
      .replace(/[a-f0-9]{8,}/gi, '') // Remove UUIDs
      .replace(/^\d+[-_]?/, '')      // Remove leading numbers
      .replace(/[-_]/g, ' ')          // Dashes to spaces
      .replace(/\s+/g, ' ')
      .trim();
    
    // Extract location from URL segments
    const locationPatterns = /berlin|munich|münchen|hamburg|frankfurt|stuttgart|cologne|köln|düsseldorf|croatia|zagreb|london|paris|amsterdam|vienna|wien|zurich|zürich/i;
    const locationSegment = segments.find(s => locationPatterns.test(s));
    
    return {
      title: titleSegment.charAt(0).toUpperCase() + titleSegment.slice(1) || 'Open Position',
      url: url,
      location: locationSegment ? locationSegment.charAt(0).toUpperCase() + locationSegment.slice(1).toLowerCase() : undefined,
    };
  } catch {
    return { title: 'Open Position', url };
  }
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

    // Step 0: Scrape main website for company basics
    console.log(`[Company Crawl] Step 0: Extracting company basics from ${formattedDomain}`);
    
    try {
      const mainScrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: formattedDomain,
          formats: [
            {
              type: 'json',
              schema: {
                type: 'object',
                properties: {
                  company_description: { type: 'string' },
                  industry: { type: 'string' },
                  headquarters_city: { type: 'string' },
                  headquarters_country: { type: 'string' },
                  employee_count: { type: 'string' },
                  founded_year: { type: 'string' },
                },
              },
              prompt: 'Extract company information from this website: What industry/sector is this company in? Where is the headquarters (city and country)? How many employees does the company have (size/headcount)? When was it founded?',
            },
          ],
          onlyMainContent: true,
          waitFor: 2000,
        }),
      });

      if (mainScrapeResponse.ok) {
        const mainData = await mainScrapeResponse.json();
        const basics = mainData.data?.json || mainData.json;
        
        if (basics) {
          if (basics.industry) result.industry = basics.industry;
          if (basics.headquarters_city) result.city = basics.headquarters_city;
          if (basics.headquarters_country) result.country = basics.headquarters_country;
          if (basics.employee_count) result.headcount = basics.employee_count;
          if (basics.founded_year) result.founded_year = basics.founded_year;
          console.log(`[Company Crawl] Basics extracted: industry=${result.industry}, city=${result.city}, headcount=${result.headcount}`);
        }
      }
    } catch (basicsError) {
      console.error(`[Company Crawl] Basics extraction error:`, basicsError);
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

          // Step 1.5: Map the career subdomain to find job listing pages
          // This handles multi-step career sites (like Rimac) where jobs are behind navigation
          let careerSubpageLinks: string[] = [];
          let bestJobListingUrl: string | null = null;
          
          try {
            const careerDomain = new URL(careerUrl).origin;
            console.log(`[Company Crawl] Step 1.5: Deep mapping career domain ${careerDomain}`);
            
            const careerMapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${firecrawlApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: careerDomain,
                search: 'jobs positions stellen openings vacancies karriere', // Filter for job-related URLs
                limit: 300,
              }),
            });

            if (careerMapResponse.ok) {
              const careerMapData = await careerMapResponse.json();
              careerSubpageLinks = careerMapData.links || [];
              console.log(`[Company Crawl] Found ${careerSubpageLinks.length} career subpages`);
              
              // Find the best job listing URL (e.g., /positions, /open-positions, /all-jobs)
              bestJobListingUrl = findBestJobListingUrl(careerSubpageLinks, careerDomain);
              if (bestJobListingUrl) {
                console.log(`[Company Crawl] Found job listing page: ${bestJobListingUrl}`);
              }
            }
          } catch (careerMapError) {
            console.error(`[Company Crawl] Career subdomain mapping error:`, careerMapError);
          }

          // Step 2: Scrape the best job listing page (or fall back to career landing page)
          const urlToScrape = bestJobListingUrl || careerUrl;
          console.log(`[Company Crawl] Step 2: Scraping job listing page: ${urlToScrape}`);
          
          const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: urlToScrape,
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
                  prompt: 'Extract all job listings from this career/jobs page. For each job, extract the title, location, and department if available. Also extract any mentioned remote/hybrid work policy and company benefits.',
                },
              ],
              onlyMainContent: true,
              waitFor: 5000, // Longer wait for JS-heavy career sites
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
                ) || urlToScrape,
              }));
              console.log(`[Company Crawl] Extracted ${result.live_jobs.length} jobs from JSON`);
            }
            
            // Fallback 1: Extract jobs from links on the scraped page
            if (result.live_jobs.length === 0 && pageLinks.length > 0) {
              const jobLinks = pageLinks.filter((l: string) => 
                /\/job[s]?\/[a-z0-9-]+|\/stelle[n]?\/[a-z0-9-]+|\/position[s]?\/[a-z0-9-]+|\/opening[s]?\/[a-z0-9-]+/i.test(l) &&
                !l.endsWith('/jobs') && !l.endsWith('/careers') && !l.endsWith('/positions')
              );
              
              if (jobLinks.length > 0) {
                console.log(`[Company Crawl] Fallback 1: Found ${jobLinks.length} job links on page`);
                result.live_jobs = jobLinks.slice(0, 50).map((url: string) => extractJobFromUrl(url));
              }
            }

            // Fallback 2: Use career subpage links to find individual job postings
            if (result.live_jobs.length === 0 && careerSubpageLinks.length > 0) {
              console.log(`[Company Crawl] Fallback 2: Scanning ${careerSubpageLinks.length} career subpage URLs for jobs`);
              
              const individualJobLinks = careerSubpageLinks.filter((l: string) => {
                const lowerLink = l.toLowerCase();
                // Match individual job URLs (not listing pages)
                return (
                  /\/job[s]?\/[a-z0-9-]{5,}/i.test(lowerLink) ||
                  /\/position[s]?\/[a-z0-9-]{5,}/i.test(lowerLink) ||
                  /\/stelle[n]?\/[a-z0-9-]{5,}/i.test(lowerLink) ||
                  /\/opening[s]?\/[a-z0-9-]{5,}/i.test(lowerLink) ||
                  /\/vacancy\/[a-z0-9-]{5,}/i.test(lowerLink) ||
                  /\/career[s]?\/[a-z0-9-]+\/[a-z0-9-]{5,}/i.test(lowerLink)
                ) && 
                !lowerLink.endsWith('/jobs') && 
                !lowerLink.endsWith('/positions') &&
                !lowerLink.endsWith('/careers') &&
                !lowerLink.endsWith('/stellen');
              });
              
              if (individualJobLinks.length > 0) {
                console.log(`[Company Crawl] Fallback 2: Found ${individualJobLinks.length} individual job URLs`);
                result.live_jobs = individualJobLinks.slice(0, 50).map((url: string) => extractJobFromUrl(url));
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
            console.log(`[Company Crawl] Final result: ${result.live_jobs_count} jobs - Activity: ${result.hiring_activity}`);
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
        // Company basics from Step 0
        ...(result.industry && { industry: result.industry }),
        ...(result.city && { city: result.city }),
        ...(result.country && { country: result.country }),
        ...(result.headcount && { headcount: result.headcount }),
        // Career data
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
