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
  funding_date?: string;
  remote_policy?: string;
  awards: string[];
  linkedin_url?: string;
  employee_growth?: string;
  // NEW: Extended intelligence data
  technologies?: string[];
  cloud_provider?: string;
  development_tools?: string[];
  kununu_score?: number;
  kununu_reviews?: number;
  glassdoor_score?: number;
  glassdoor_reviews?: number;
  revenue_range?: string;
  company_culture?: string[];
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

// NEW: Detect technologies from HTML source (BuiltWith-style)
function detectTechnologiesFromHtml(html: string): string[] {
  const technologies: string[] = [];
  const lowerHtml = html.toLowerCase();
  
  // Frontend Frameworks
  if (lowerHtml.includes('react') || lowerHtml.includes('_next')) technologies.push('React');
  if (lowerHtml.includes('vue') || lowerHtml.includes('nuxt')) technologies.push('Vue.js');
  if (lowerHtml.includes('angular')) technologies.push('Angular');
  if (lowerHtml.includes('svelte')) technologies.push('Svelte');
  if (lowerHtml.includes('gatsby')) technologies.push('Gatsby');
  if (lowerHtml.includes('next.js') || lowerHtml.includes('_next')) technologies.push('Next.js');
  
  // Cloud Providers
  if (lowerHtml.includes('amazonaws.com') || lowerHtml.includes('aws.')) technologies.push('AWS');
  if (lowerHtml.includes('googleapis.com') || lowerHtml.includes('google-analytics') || lowerHtml.includes('gcp')) technologies.push('Google Cloud');
  if (lowerHtml.includes('azure') || lowerHtml.includes('microsoft') || lowerHtml.includes('msft')) technologies.push('Azure');
  
  // Analytics & Marketing
  if (lowerHtml.includes('google-analytics') || lowerHtml.includes('gtag') || lowerHtml.includes('ga(')) technologies.push('Google Analytics');
  if (lowerHtml.includes('segment.com') || lowerHtml.includes('segment.io')) technologies.push('Segment');
  if (lowerHtml.includes('hubspot')) technologies.push('HubSpot');
  if (lowerHtml.includes('salesforce') || lowerHtml.includes('pardot')) technologies.push('Salesforce');
  if (lowerHtml.includes('hotjar')) technologies.push('Hotjar');
  if (lowerHtml.includes('mixpanel')) technologies.push('Mixpanel');
  if (lowerHtml.includes('amplitude')) technologies.push('Amplitude');
  if (lowerHtml.includes('intercom')) technologies.push('Intercom');
  if (lowerHtml.includes('zendesk')) technologies.push('Zendesk');
  
  // CMS & Platforms
  if (lowerHtml.includes('wordpress') || lowerHtml.includes('wp-content')) technologies.push('WordPress');
  if (lowerHtml.includes('shopify')) technologies.push('Shopify');
  if (lowerHtml.includes('contentful')) technologies.push('Contentful');
  if (lowerHtml.includes('strapi')) technologies.push('Strapi');
  if (lowerHtml.includes('typo3')) technologies.push('TYPO3');
  if (lowerHtml.includes('drupal')) technologies.push('Drupal');
  
  // Infrastructure
  if (lowerHtml.includes('cloudflare')) technologies.push('Cloudflare');
  if (lowerHtml.includes('fastly')) technologies.push('Fastly');
  if (lowerHtml.includes('akamai')) technologies.push('Akamai');
  if (lowerHtml.includes('vercel')) technologies.push('Vercel');
  if (lowerHtml.includes('netlify')) technologies.push('Netlify');
  
  // Enterprise
  if (lowerHtml.includes('sap.')) technologies.push('SAP');
  if (lowerHtml.includes('oracle')) technologies.push('Oracle');
  if (lowerHtml.includes('workday')) technologies.push('Workday');
  
  // Dev Tools
  if (lowerHtml.includes('sentry')) technologies.push('Sentry');
  if (lowerHtml.includes('datadog')) technologies.push('Datadog');
  if (lowerHtml.includes('newrelic')) technologies.push('New Relic');
  
  // Payment
  if (lowerHtml.includes('stripe')) technologies.push('Stripe');
  if (lowerHtml.includes('paypal')) technologies.push('PayPal');
  if (lowerHtml.includes('klarna')) technologies.push('Klarna');
  
  return [...new Set(technologies)]; // Remove duplicates
}

// NEW: Parse Kununu score from search result
function parseKununuScore(text: string): { score: number; reviews: number } | null {
  // Pattern: "4,2 von 5" or "4.2/5" or "Score: 4.2"
  const scoreMatch = text.match(/(\d[,.]?\d?)\s*(?:von|\/|out of)\s*5/i);
  const reviewMatch = text.match(/(\d+)\s*(?:bewertung|review|rezension)/i);
  
  if (scoreMatch) {
    const score = parseFloat(scoreMatch[1].replace(',', '.'));
    const reviews = reviewMatch ? parseInt(reviewMatch[1]) : 0;
    if (score > 0 && score <= 5) {
      return { score, reviews };
    }
  }
  return null;
}

// NEW: Parse revenue range from text
function parseRevenueRange(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  // German patterns
  if (lowerText.includes('mrd') || lowerText.includes('milliarden')) {
    const match = text.match(/(\d+(?:[,.]?\d+)?)\s*(?:mrd|milliarden)/i);
    if (match) return `€${match[1]}B+`;
  }
  if (lowerText.includes('mio') || lowerText.includes('million')) {
    const match = text.match(/(\d+(?:[,.]?\d+)?)\s*(?:mio|million)/i);
    if (match) {
      const num = parseFloat(match[1].replace(',', '.'));
      if (num >= 100) return '€100M+';
      if (num >= 50) return '€50-100M';
      if (num >= 10) return '€10-50M';
      return '€1-10M';
    }
  }
  
  return null;
}

// NEW: Parse employee growth from text  
function parseEmployeeGrowth(currentHeadcount: string | undefined, text: string): string | null {
  // Look for growth indicators
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('wachstum') || lowerText.includes('growth') || lowerText.includes('growing')) {
    const percentMatch = text.match(/(\d+)\s*%/);
    if (percentMatch) {
      return `+${percentMatch[1]}%`;
    }
    return 'Growing';
  }
  
  if (lowerText.includes('hiring') || lowerText.includes('expanding') || lowerText.includes('stellen')) {
    return 'Expanding';
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
      technologies: [],
      development_tools: [],
      company_culture: [],
    };

    // Format domain for URL
    let formattedDomain = companyDomain.trim().toLowerCase();
    if (!formattedDomain.startsWith('http')) {
      formattedDomain = `https://${formattedDomain}`;
    }

    // Step 0: Scrape main website for company basics + Tech Stack
    console.log(`[Company Crawl] Step 0: Extracting company basics and tech stack from ${formattedDomain}`);
    
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
            'html', // Get HTML to detect technologies
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
                  technologies_mentioned: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'Technologies, frameworks, or tools mentioned on the website'
                  },
                  cloud_provider: { type: 'string', description: 'AWS, GCP, Azure if mentioned' },
                },
              },
              prompt: 'Extract company information: industry/sector, headquarters city and country, employee count/headcount, founding year. Also extract any technologies, frameworks, programming languages, or cloud providers mentioned (e.g., React, Python, AWS, Kubernetes, SAP, Salesforce).',
            },
          ],
          onlyMainContent: true,
          waitFor: 2000,
        }),
      });

      if (mainScrapeResponse.ok) {
        const mainData = await mainScrapeResponse.json();
        const basics = mainData.data?.json || mainData.json;
        const html = mainData.data?.html || mainData.html || '';
        
        if (basics) {
          if (basics.industry) result.industry = basics.industry;
          if (basics.headquarters_city) result.city = basics.headquarters_city;
          if (basics.headquarters_country) result.country = basics.headquarters_country;
          if (basics.employee_count) result.headcount = basics.employee_count;
          if (basics.founded_year) result.founded_year = basics.founded_year;
          if (basics.cloud_provider) result.cloud_provider = basics.cloud_provider;
          if (basics.technologies_mentioned && Array.isArray(basics.technologies_mentioned)) {
            result.technologies = basics.technologies_mentioned.slice(0, 20);
          }
          console.log(`[Company Crawl] Basics extracted: industry=${result.industry}, city=${result.city}, headcount=${result.headcount}`);
        }
        
        // Tech Stack Detection from HTML (BuiltWith-style)
        const detectedTech = detectTechnologiesFromHtml(html);
        if (detectedTech.length > 0) {
          result.technologies = [...new Set([...(result.technologies || []), ...detectedTech])].slice(0, 30);
          console.log(`[Company Crawl] Technologies detected: ${result.technologies.join(', ')}`);
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

            // Fallback 3: Extract jobs from markdown text (for sites like Rimac with text-only listings)
            if (result.live_jobs.length === 0 && markdown) {
              console.log(`[Company Crawl] Fallback 3: Extracting jobs from markdown text`);
              
              const extractedJobs: { title: string; location?: string }[] = [];
              const lines = markdown.split('\n');
              
              for (const line of lines) {
                // Pattern 1: Lines starting with bullet points (- or * or •)
                const bulletMatch = line.match(/^[-*•]\s*(.+)/);
                if (bulletMatch) {
                  const content = bulletMatch[1].trim();
                  // Skip navigation/menu items (too short or common words)
                  if (content.length > 15 && content.length < 120 &&
                      !content.toLowerCase().includes('open positions') &&
                      !content.toLowerCase().includes('offene stellen') &&
                      !content.toLowerCase().includes('apply now') &&
                      !content.toLowerCase().includes('jetzt bewerben') &&
                      !content.toLowerCase().includes('learn more') &&
                      !content.toLowerCase().includes('read more') &&
                      !content.toLowerCase().includes('view all') &&
                      !content.toLowerCase().includes('alle anzeigen') &&
                      !content.toLowerCase().includes('home') &&
                      !content.toLowerCase().includes('about') &&
                      !content.toLowerCase().includes('contact') &&
                      // Check for job-like keywords
                      (content.toLowerCase().includes('engineer') ||
                       content.toLowerCase().includes('manager') ||
                       content.toLowerCase().includes('developer') ||
                       content.toLowerCase().includes('designer') ||
                       content.toLowerCase().includes('analyst') ||
                       content.toLowerCase().includes('specialist') ||
                       content.toLowerCase().includes('lead') ||
                       content.toLowerCase().includes('director') ||
                       content.toLowerCase().includes('head of') ||
                       content.toLowerCase().includes('senior') ||
                       content.toLowerCase().includes('junior') ||
                       content.toLowerCase().includes('(m/w/d)') ||
                       content.toLowerCase().includes('(m/f/d)') ||
                       content.toLowerCase().includes('(m/f/x)') ||
                       content.match(/\s+[–-]\s+[A-Z][a-z]+/) || // Title - Location pattern
                       content.match(/[,]\s*[A-Z][a-z]+(?:\s*,\s*[A-Z]{2,3})?$/))) { // Ends with City, Country
                    
                    // Try to split title and location
                    const dashSplit = content.split(/\s+[–-]\s+(?=[A-Z])/);
                    if (dashSplit.length >= 2) {
                      extractedJobs.push({
                        title: dashSplit[0].trim(),
                        location: dashSplit.slice(1).join(' - ').trim()
                      });
                    } else {
                      extractedJobs.push({ title: content });
                    }
                  }
                }
                
                // Pattern 2: Lines with job title patterns but no bullet (e.g., headers)
                const jobHeaderMatch = line.match(/^#+\s*(.+(?:Engineer|Manager|Developer|Designer|Analyst|Specialist|Lead|Director|m\/w\/d|m\/f\/d).+)$/i);
                if (jobHeaderMatch && !extractedJobs.find(j => j.title === jobHeaderMatch[1].trim())) {
                  const content = jobHeaderMatch[1].trim();
                  if (content.length > 10 && content.length < 120) {
                    extractedJobs.push({ title: content });
                  }
                }
              }
              
              // Pattern 3: Look for job title blocks (multiple lines in a row that look like job titles)
              const jobBlockPattern = /(?:^|\n)([A-Z][^.\n]{10,80}(?:Engineer|Manager|Developer|Designer|Analyst|Specialist|Lead|Director|\(m\/w\/d\)|\(m\/f\/d\))[^.\n]{0,40})(?:\n|$)/gi;
              let blockMatch;
              while ((blockMatch = jobBlockPattern.exec(markdown)) !== null) {
                const title = blockMatch[1].trim();
                if (!extractedJobs.find(j => j.title.toLowerCase() === title.toLowerCase())) {
                  extractedJobs.push({ title });
                }
              }
              
              if (extractedJobs.length > 0) {
                console.log(`[Company Crawl] Fallback 3: Extracted ${extractedJobs.length} jobs from markdown`);
                result.live_jobs = extractedJobs.slice(0, 100).map(job => ({
                  title: job.title,
                  location: job.location,
                  url: urlToScrape
                }));
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

      // Step 5: Search for Key Executives
      console.log(`[Company Crawl] Step 5: Searching for key executives at ${companyNameToUse}`);
      
      try {
        const executivesQuery = `site:linkedin.com/in "${companyNameToUse}" CEO OR CTO OR CFO OR "Head of" OR Geschäftsführer OR "Managing Director"`;
        const executivesResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: executivesQuery,
            limit: 10,
          }),
        });

        if (executivesResponse.ok) {
          const executivesData = await executivesResponse.json();
          const executivesResults = executivesData.data || [];
          
          const executives: KeyExecutive[] = [];
          const seenNames = new Set<string>();
          
          for (const item of executivesResults) {
            if (!item.url?.includes('linkedin.com/in')) continue;
            
            // Extract name from title (typically "Name - Title at Company")
            const titleParts = (item.title || '').split(' - ');
            if (titleParts.length >= 2) {
              const name = titleParts[0].trim();
              const roleMatch = titleParts[1].match(/(CEO|CTO|CFO|COO|CHRO|CMO|CPO|CIO|Head of [^|]+|Geschäftsführer|Managing Director|Director|VP|Vice President)/i);
              
              if (name && roleMatch && !seenNames.has(name.toLowerCase())) {
                seenNames.add(name.toLowerCase());
                executives.push({
                  name: name,
                  role: roleMatch[1],
                  linkedin: item.url,
                });
              }
            }
          }
          
          result.key_executives = executives.slice(0, 5);
          console.log(`[Company Crawl] Found ${result.key_executives.length} executives`);
        }
      } catch (execError) {
        console.error(`[Company Crawl] Executives search error:`, execError);
      }

      // Step 6: Search for Employer Branding Scores (Kununu)
      console.log(`[Company Crawl] Step 6: Searching for employer branding scores`);
      
      try {
        const kununuQuery = `site:kununu.com "${companyNameToUse}"`;
        const kununuResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: kununuQuery,
            limit: 3,
            lang: 'de',
          }),
        });

        if (kununuResponse.ok) {
          const kununuData = await kununuResponse.json();
          const kununuResults = kununuData.data || [];
          
          for (const item of kununuResults) {
            const text = (item.title || '') + ' ' + (item.description || '');
            const scoreData = parseKununuScore(text);
            if (scoreData) {
              result.kununu_score = scoreData.score;
              result.kununu_reviews = scoreData.reviews;
              console.log(`[Company Crawl] Kununu score: ${result.kununu_score} (${result.kununu_reviews} reviews)`);
              break;
            }
          }
        }

        // Search for Glassdoor
        const glassdoorQuery = `site:glassdoor.de OR site:glassdoor.com "${companyNameToUse}"`;
        const glassdoorResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: glassdoorQuery,
            limit: 3,
          }),
        });

        if (glassdoorResponse.ok) {
          const glassdoorData = await glassdoorResponse.json();
          const glassdoorResults = glassdoorData.data || [];
          
          for (const item of glassdoorResults) {
            const text = (item.title || '') + ' ' + (item.description || '');
            // Glassdoor uses similar scoring patterns
            const scoreMatch = text.match(/(\d[,.]?\d?)\s*(?:von|\/|out of|stars?|sterne)/i);
            if (scoreMatch) {
              const score = parseFloat(scoreMatch[1].replace(',', '.'));
              if (score > 0 && score <= 5) {
                result.glassdoor_score = score;
                console.log(`[Company Crawl] Glassdoor score: ${result.glassdoor_score}`);
                break;
              }
            }
          }
        }
      } catch (brandingError) {
        console.error(`[Company Crawl] Employer branding error:`, brandingError);
      }

      // Step 7: Search for Revenue & Growth Signals
      console.log(`[Company Crawl] Step 7: Searching for revenue and growth signals`);
      
      try {
        const revenueQuery = `"${companyNameToUse}" umsatz OR revenue OR jahresumsatz OR turnover 2024 2025`;
        const revenueResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: revenueQuery,
            limit: 5,
            lang: 'de',
          }),
        });

        if (revenueResponse.ok) {
          const revenueData = await revenueResponse.json();
          const revenueResults = revenueData.data || [];
          
          for (const item of revenueResults) {
            const text = (item.title || '') + ' ' + (item.description || '');
            const revenueRange = parseRevenueRange(text);
            if (revenueRange) {
              result.revenue_range = revenueRange;
              console.log(`[Company Crawl] Revenue range: ${result.revenue_range}`);
              break;
            }
          }
        }

        // Employee growth signals
        const growthQuery = `"${companyNameToUse}" wachstum OR growth OR expanding OR hiring 2024 2025`;
        const growthResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: growthQuery,
            limit: 5,
            lang: 'de',
          }),
        });

        if (growthResponse.ok) {
          const growthData = await growthResponse.json();
          const growthResults = growthData.data || [];
          
          for (const item of growthResults) {
            const text = (item.title || '') + ' ' + (item.description || '');
            const growth = parseEmployeeGrowth(result.headcount, text);
            if (growth) {
              result.employee_growth = growth;
              console.log(`[Company Crawl] Employee growth: ${result.employee_growth}`);
              break;
            }
          }
        }
      } catch (growthError) {
        console.error(`[Company Crawl] Growth metrics error:`, growthError);
      }
    }

    // Calculate priority score (enhanced with new signals)
    let priorityScore = 0;
    priorityScore += result.live_jobs_count * 2;
    priorityScore += result.recent_news.length * 3;
    priorityScore += result.awards.length * 5;
    if (result.funding_stage) priorityScore += 15;
    if (result.hiring_activity === 'hot') priorityScore += 20;
    else if (result.hiring_activity === 'active') priorityScore += 10;
    // New scoring factors
    if (result.key_executives.length > 0) priorityScore += 10;
    if (result.kununu_score && result.kununu_score < 3.5) priorityScore += 8; // Low scores = hiring problems = opportunity
    if (result.employee_growth) priorityScore += 5;
    if (result.technologies && result.technologies.length > 5) priorityScore += 5;

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
        if (result.funding_date) updateData.recent_funding_date = result.funding_date;
        if (result.linkedin_url) updateData.linkedin_url = result.linkedin_url;
        if (result.remote_policy) updateData.remote_policy = result.remote_policy;
        if (result.awards.length > 0) updateData.awards = result.awards;
        if (result.key_executives.length > 0) updateData.key_executives = result.key_executives;
        // NEW: Extended intelligence data
        if (result.technologies && result.technologies.length > 0) updateData.technologies = result.technologies;
        if (result.cloud_provider) updateData.cloud_provider = result.cloud_provider;
        if (result.development_tools && result.development_tools.length > 0) updateData.development_tools = result.development_tools;
        if (result.kununu_score) updateData.kununu_score = result.kununu_score;
        if (result.glassdoor_score) updateData.glassdoor_score = result.glassdoor_score;
        if (result.revenue_range) updateData.revenue_range = result.revenue_range;
        if (result.employee_growth) updateData.employee_growth = result.employee_growth;
        if (result.company_culture && result.company_culture.length > 0) updateData.company_culture = result.company_culture;
        
        // Update last_enriched_at for intelligence tracking
        updateData.last_enriched_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('outreach_companies')
        .update(updateData)
        .eq('id', company_id);

      if (updateError) {
        console.error(`[Company Crawl] Update error:`, updateError);
      }
    }

    // === AUTO-CREATE CONTACTS FROM KEY EXECUTIVES ===
    if (crawl_extended && result.key_executives.length > 0 && company_id) {
      console.log(`[Company Crawl] Creating ${result.key_executives.length} contacts from executives`);
      
      for (const exec of result.key_executives) {
        if (!exec.name) continue;
        
        // Check if contact already exists (by name + company)
        const { data: existing } = await supabase
          .from('outreach_leads')
          .select('id')
          .eq('company_id', company_id)
          .ilike('contact_name', exec.name)
          .maybeSingle();
        
        if (!existing) {
          // Determine decision level based on role
          const role = (exec.role || '').toLowerCase();
          let decisionLevel = 'gatekeeper';
          if (role.includes('ceo') || role.includes('geschäftsführer') || role.includes('managing director') ||
              role.includes('cto') || role.includes('cfo') || role.includes('coo') || role.includes('chro') ||
              role.includes('chief') || role.includes('founder') || role.includes('gründer')) {
            decisionLevel = 'entscheider';
          } else if (role.includes('head of') || role.includes('director') || role.includes('vp') || 
                     role.includes('vice president') || role.includes('leiter') || role.includes('lead')) {
            decisionLevel = 'influencer';
          }
          
          // Determine functional area
          let functionalArea = 'Other';
          if (role.includes('hr') || role.includes('people') || role.includes('chro') || role.includes('talent') || role.includes('personal')) {
            functionalArea = 'HR';
          } else if (role.includes('tech') || role.includes('cto') || role.includes('engineer') || role.includes('development')) {
            functionalArea = 'Tech';
          } else if (role.includes('marketing') || role.includes('cmo') || role.includes('brand')) {
            functionalArea = 'Marketing';
          } else if (role.includes('sales') || role.includes('vertrieb') || role.includes('revenue')) {
            functionalArea = 'Sales';
          } else if (role.includes('finance') || role.includes('cfo') || role.includes('finanz')) {
            functionalArea = 'Finance';
          } else if (role.includes('ceo') || role.includes('geschäftsführer') || role.includes('managing') || role.includes('founder')) {
            functionalArea = 'Leadership';
          }
          
          // Create new contact
          const { error: insertError } = await supabase
            .from('outreach_leads')
            .insert({
              company_id: company_id,
              company_name: companyNameToUse,
              contact_name: exec.name,
              contact_email: `kontakt@${domain || 'unbekannt.de'}`,
              contact_title: exec.role,
              personal_linkedin_url: exec.linkedin || null,
              lead_source: 'linkedin_crawl',
              segment: 'enterprise',
              decision_level: decisionLevel,
              functional_area: functionalArea,
              status: 'neu',
              contact_outreach_status: 'nicht_kontaktiert',
            });
          
          if (insertError) {
            console.error(`[Company Crawl] Failed to create contact for ${exec.name}:`, insertError.message);
          } else {
            console.log(`[Company Crawl] Created contact: ${exec.name} (${decisionLevel})`);
          }
        }
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
