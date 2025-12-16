import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Common career page URL patterns
const CAREER_URL_PATTERNS = [
  '/careers', '/karriere', '/jobs', '/stellenangebote', '/stellen',
  '/open-positions', '/join-us', '/work-with-us', '/join',
  '/about/careers', '/company/careers', '/de/karriere', '/en/careers',
  '/arbeiten-bei', '/team', '/hiring', '/vacancies', '/offene-stellen'
];

interface LiveJob {
  title: string;
  location?: string;
  department?: string;
  url?: string;
  posted_date?: string;
}

interface CrawlResult {
  success: boolean;
  career_page_url?: string;
  career_page_status: 'found' | 'not_found' | 'error';
  live_jobs: LiveJob[];
  live_jobs_count: number;
  hiring_activity: 'hot' | 'active' | 'low' | 'none' | 'unknown';
  error?: string;
}

function classifyHiringActivity(jobCount: number): 'hot' | 'active' | 'low' | 'none' {
  if (jobCount >= 10) return 'hot';
  if (jobCount >= 3) return 'active';
  if (jobCount >= 1) return 'low';
  return 'none';
}

function findBestCareerUrl(links: string[], domain: string): string | null {
  const domainLower = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
  
  // Score each link
  const scoredLinks = links
    .filter(link => {
      try {
        const url = new URL(link);
        return url.hostname.includes(domainLower.split('/')[0]);
      } catch {
        return false;
      }
    })
    .map(link => {
      const linkLower = link.toLowerCase();
      let score = 0;
      
      for (const pattern of CAREER_URL_PATTERNS) {
        if (linkLower.includes(pattern)) {
          score += 10;
          // Bonus for exact path match
          if (linkLower.endsWith(pattern) || linkLower.endsWith(pattern + '/')) {
            score += 5;
          }
        }
      }
      
      // Penalty for deep paths (more slashes = lower priority)
      const slashCount = (link.match(/\//g) || []).length;
      score -= slashCount * 0.5;
      
      return { link, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);
  
  return scoredLinks.length > 0 ? scoredLinks[0].link : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, company_domain, company_name } = await req.json();

    if (!company_domain && !lead_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'company_domain or lead_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If lead_id provided, fetch domain from lead
    let domain = company_domain;
    let leadData = null;
    
    if (lead_id) {
      const { data: lead, error: leadError } = await supabase
        .from('outreach_leads')
        .select('*')
        .eq('id', lead_id)
        .single();
      
      if (leadError || !lead) {
        return new Response(
          JSON.stringify({ success: false, error: 'Lead not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      leadData = lead;
      domain = lead.company_domain || lead.company_website;
      
      if (!domain) {
        // Try to extract domain from email
        const emailDomain = lead.contact_email?.split('@')[1];
        if (emailDomain && !['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'web.de', 'gmx.de'].includes(emailDomain)) {
          domain = emailDomain;
        }
      }
    }

    if (!domain) {
      const result: CrawlResult = {
        success: false,
        career_page_status: 'error',
        live_jobs: [],
        live_jobs_count: 0,
        hiring_activity: 'unknown',
        error: 'No domain available'
      };
      
      if (lead_id) {
        await supabase.from('outreach_leads').update({
          career_page_status: 'error',
          career_crawled_at: new Date().toISOString(),
          hiring_activity: 'unknown'
        }).eq('id', lead_id);
      }
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Format domain
    let formattedDomain = domain.trim();
    if (!formattedDomain.startsWith('http://') && !formattedDomain.startsWith('https://')) {
      formattedDomain = `https://${formattedDomain}`;
    }

    console.log(`[Career Crawl] Mapping domain: ${formattedDomain}`);

    // Step 1: Map the website to find career page
    const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedDomain,
        search: 'karriere jobs careers stellen hiring',
        limit: 200,
        includeSubdomains: true,
      }),
    });

    const mapData = await mapResponse.json();
    
    if (!mapResponse.ok || !mapData.success) {
      console.error('[Career Crawl] Map failed:', mapData);
      
      const result: CrawlResult = {
        success: false,
        career_page_status: 'error',
        live_jobs: [],
        live_jobs_count: 0,
        hiring_activity: 'unknown',
        error: mapData.error || 'Failed to map website'
      };
      
      if (lead_id) {
        await supabase.from('outreach_leads').update({
          career_page_status: 'error',
          career_crawled_at: new Date().toISOString(),
          hiring_activity: 'unknown'
        }).eq('id', lead_id);
      }
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const links = mapData.links || [];
    console.log(`[Career Crawl] Found ${links.length} links`);

    // Step 2: Find best career page URL
    const careerUrl = findBestCareerUrl(links, formattedDomain);
    
    if (!careerUrl) {
      console.log('[Career Crawl] No career page found');
      
      const result: CrawlResult = {
        success: true,
        career_page_status: 'not_found',
        live_jobs: [],
        live_jobs_count: 0,
        hiring_activity: 'unknown'
      };
      
      if (lead_id) {
        await supabase.from('outreach_leads').update({
          career_page_status: 'not_found',
          career_crawled_at: new Date().toISOString(),
          live_jobs: [],
          live_jobs_count: 0,
          hiring_activity: 'unknown'
        }).eq('id', lead_id);
      }
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Career Crawl] Best career URL: ${careerUrl}`);

    // Step 3: Scrape career page with JSON extraction
    const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: careerUrl,
        formats: [
          'markdown',
          {
            type: 'json',
            prompt: `Extract all job listings/openings from this career page. For each job, extract:
- title: Job title (required)
- location: Job location if mentioned
- department: Department or team if mentioned
- url: Direct link to job posting if available

Return as JSON array. If no jobs found, return empty array [].
Example: [{"title": "Senior Developer", "location": "Berlin", "department": "Engineering"}]`
          }
        ],
        onlyMainContent: true,
        waitFor: 3000, // Wait for dynamic content
      }),
    });

    const scrapeData = await scrapeResponse.json();
    
    if (!scrapeResponse.ok || !scrapeData.success) {
      console.error('[Career Crawl] Scrape failed:', scrapeData);
      
      const result: CrawlResult = {
        success: true,
        career_page_url: careerUrl,
        career_page_status: 'found',
        live_jobs: [],
        live_jobs_count: 0,
        hiring_activity: 'unknown',
        error: 'Could not extract jobs'
      };
      
      if (lead_id) {
        await supabase.from('outreach_leads').update({
          career_page_url: careerUrl,
          career_page_status: 'found',
          career_crawled_at: new Date().toISOString(),
          live_jobs: [],
          live_jobs_count: 0,
          hiring_activity: 'unknown'
        }).eq('id', lead_id);
      }
      
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse extracted jobs
    let liveJobs: LiveJob[] = [];
    const extractedData = scrapeData.data?.json || scrapeData.json;
    
    if (Array.isArray(extractedData)) {
      liveJobs = extractedData.filter(job => job.title).map(job => ({
        title: job.title,
        location: job.location || null,
        department: job.department || null,
        url: job.url || null,
        posted_date: job.posted_date || null
      }));
    }

  // If no jobs from JSON extraction, try to count from markdown
    if (liveJobs.length === 0) {
      const markdown = scrapeData.data?.markdown || scrapeData.markdown || '';
      // Simple heuristic: count lines that look like job titles
      const jobPatterns = markdown.match(/^[-*•]\s+.+/gm) || [];
      const headerPatterns = markdown.match(/^#{1,3}\s+.+/gm) || [];
      
      // Estimate job count from patterns
      const estimatedJobs = Math.max(jobPatterns.length, Math.floor(headerPatterns.length / 2));
      if (estimatedJobs > 0) {
        liveJobs = Array(Math.min(estimatedJobs, 20)).fill(null).map((_, i) => ({
          title: `Position ${i + 1}`,
          location: undefined,
          department: undefined,
          url: careerUrl
        }));
      }
    }

    const jobCount = liveJobs.length;
    const hiringActivity = classifyHiringActivity(jobCount);

    console.log(`[Career Crawl] Found ${jobCount} jobs, activity: ${hiringActivity}`);

    const result: CrawlResult = {
      success: true,
      career_page_url: careerUrl,
      career_page_status: 'found',
      live_jobs: liveJobs,
      live_jobs_count: jobCount,
      hiring_activity: hiringActivity
    };

    // Update lead in database
    if (lead_id) {
      await supabase.from('outreach_leads').update({
        career_page_url: careerUrl,
        career_page_status: 'found',
        career_crawled_at: new Date().toISOString(),
        live_jobs: liveJobs,
        live_jobs_count: jobCount,
        hiring_activity: hiringActivity
      }).eq('id', lead_id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Career Crawl] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
