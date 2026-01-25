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
  xing?: string;
  email?: string;
  phone?: string;
  bio?: string;
  source?: string;
}

interface SourceResult {
  source: string;
  confidence: number;
  data: Partial<CompanyData>;
  contacts: KeyExecutive[];
  raw_url?: string;
}

interface CompanyData {
  industry?: string;
  city?: string;
  country?: string;
  address?: string;
  headcount?: string;
  founded_year?: string;
  legal_name?: string;
  handelsregister?: string;
  phone?: string;
  email?: string;
  xing_url?: string;
  crunchbase_url?: string;
  funding_total?: string;
  funding_stage?: string;
}

interface CrawlResult {
  // Company basics
  industry?: string;
  city?: string;
  country?: string;
  address?: string;
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
  // Extended intelligence data
  technologies?: string[];
  cloud_provider?: string;
  development_tools?: string[];
  kununu_score?: number;
  kununu_reviews?: number;
  glassdoor_score?: number;
  glassdoor_reviews?: number;
  revenue_range?: string;
  company_culture?: string[];
  // Multi-source data
  xing_url?: string;
  legal_name?: string;
  handelsregister?: string;
}

interface SourceTrackingEntry {
  crawled_at: string | null;
  status: 'success' | 'no_results' | 'error' | 'pending';
  fields?: string[];
  contacts_found?: number;
  executives_found?: number;
  jobs_found?: number;
  error?: string;
}

function classifyHiringActivity(jobCount: number): 'hot' | 'active' | 'low' | 'none' {
  if (jobCount >= 10) return 'hot';
  if (jobCount >= 5) return 'active';
  if (jobCount >= 1) return 'low';
  return 'none';
}

// Generate unique placeholder email from name
function generatePlaceholderEmail(name: string, domain: string): string {
  const cleanName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (Umlaute)
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  
  if (cleanName.length >= 2) {
    return `${cleanName[0]}.${cleanName[cleanName.length - 1]}@${domain}`;
  } else if (cleanName.length === 1) {
    return `${cleanName[0]}@${domain}`;
  }
  return `contact.${Date.now()}@${domain}`;
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
      
      for (const pattern of jobListPatterns) {
        if (pattern.test(lowerLink)) {
          score += 20;
          break;
        }
      }
      
      if (lowerLink.includes('/all') || lowerLink.includes('/open')) score += 5;
      if (lowerLink.includes('position') || lowerLink.includes('job')) score += 3;
      if (lowerLink.includes('stellen') || lowerLink.includes('vacanc')) score += 3;
      
      if (lowerLink.match(/\/[a-z-]+\/?$/) && !lowerLink.includes('job') && !lowerLink.includes('position')) {
        score -= 2;
      }
      
      return { link, score };
    })
    .filter(item => item.score > 5)
    .sort((a, b) => b.score - a.score);

  return scoredLinks.length > 0 ? scoredLinks[0].link : null;
}

function extractJobFromUrl(url: string): { title: string; url: string; location?: string } {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    
    let titleSegment = segments[segments.length - 1] || 'Position';
    
    titleSegment = titleSegment
      .replace(/[a-f0-9]{8,}/gi, '')
      .replace(/^\d+[-_]?/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
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

function detectTechnologiesFromHtml(html: string): string[] {
  const technologies: string[] = [];
  const lowerHtml = html.toLowerCase();
  
  if (lowerHtml.includes('react') || lowerHtml.includes('_next')) technologies.push('React');
  if (lowerHtml.includes('vue') || lowerHtml.includes('nuxt')) technologies.push('Vue.js');
  if (lowerHtml.includes('angular')) technologies.push('Angular');
  if (lowerHtml.includes('svelte')) technologies.push('Svelte');
  if (lowerHtml.includes('gatsby')) technologies.push('Gatsby');
  if (lowerHtml.includes('next.js') || lowerHtml.includes('_next')) technologies.push('Next.js');
  
  if (lowerHtml.includes('amazonaws.com') || lowerHtml.includes('aws.')) technologies.push('AWS');
  if (lowerHtml.includes('googleapis.com') || lowerHtml.includes('google-analytics') || lowerHtml.includes('gcp')) technologies.push('Google Cloud');
  if (lowerHtml.includes('azure') || lowerHtml.includes('microsoft') || lowerHtml.includes('msft')) technologies.push('Azure');
  
  if (lowerHtml.includes('google-analytics') || lowerHtml.includes('gtag') || lowerHtml.includes('ga(')) technologies.push('Google Analytics');
  if (lowerHtml.includes('segment.com') || lowerHtml.includes('segment.io')) technologies.push('Segment');
  if (lowerHtml.includes('hubspot')) technologies.push('HubSpot');
  if (lowerHtml.includes('salesforce') || lowerHtml.includes('pardot')) technologies.push('Salesforce');
  if (lowerHtml.includes('hotjar')) technologies.push('Hotjar');
  if (lowerHtml.includes('mixpanel')) technologies.push('Mixpanel');
  if (lowerHtml.includes('amplitude')) technologies.push('Amplitude');
  if (lowerHtml.includes('intercom')) technologies.push('Intercom');
  if (lowerHtml.includes('zendesk')) technologies.push('Zendesk');
  
  if (lowerHtml.includes('wordpress') || lowerHtml.includes('wp-content')) technologies.push('WordPress');
  if (lowerHtml.includes('shopify')) technologies.push('Shopify');
  if (lowerHtml.includes('contentful')) technologies.push('Contentful');
  if (lowerHtml.includes('strapi')) technologies.push('Strapi');
  if (lowerHtml.includes('typo3')) technologies.push('TYPO3');
  if (lowerHtml.includes('drupal')) technologies.push('Drupal');
  
  if (lowerHtml.includes('cloudflare')) technologies.push('Cloudflare');
  if (lowerHtml.includes('fastly')) technologies.push('Fastly');
  if (lowerHtml.includes('akamai')) technologies.push('Akamai');
  if (lowerHtml.includes('vercel')) technologies.push('Vercel');
  if (lowerHtml.includes('netlify')) technologies.push('Netlify');
  
  if (lowerHtml.includes('sap.')) technologies.push('SAP');
  if (lowerHtml.includes('oracle')) technologies.push('Oracle');
  if (lowerHtml.includes('workday')) technologies.push('Workday');
  
  if (lowerHtml.includes('sentry')) technologies.push('Sentry');
  if (lowerHtml.includes('datadog')) technologies.push('Datadog');
  if (lowerHtml.includes('newrelic')) technologies.push('New Relic');
  
  if (lowerHtml.includes('stripe')) technologies.push('Stripe');
  if (lowerHtml.includes('paypal')) technologies.push('PayPal');
  if (lowerHtml.includes('klarna')) technologies.push('Klarna');
  
  return [...new Set(technologies)];
}

function parseKununuScore(text: string): { score: number; reviews: number } | null {
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

function parseRevenueRange(text: string): string | null {
  const lowerText = text.toLowerCase();
  
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

function parseEmployeeGrowth(currentHeadcount: string | undefined, text: string): string | null {
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

// Determine decision level based on role
function categorizeDecisionLevel(role: string): string {
  const lowerRole = role.toLowerCase();
  if (lowerRole.includes('ceo') || lowerRole.includes('geschäftsführer') || lowerRole.includes('managing director') ||
      lowerRole.includes('cto') || lowerRole.includes('cfo') || lowerRole.includes('coo') || lowerRole.includes('chro') ||
      lowerRole.includes('chief') || lowerRole.includes('founder') || lowerRole.includes('gründer') ||
      lowerRole.includes('vorstand') || lowerRole.includes('inhaber') || lowerRole.includes('owner')) {
    return 'entscheider';
  } else if (lowerRole.includes('head of') || lowerRole.includes('director') || lowerRole.includes('vp') || 
             lowerRole.includes('vice president') || lowerRole.includes('leiter') || lowerRole.includes('lead') ||
             lowerRole.includes('prokurist')) {
    return 'influencer';
  }
  return 'gatekeeper';
}

// Determine functional area based on role
function categorizeFunctionalArea(role: string): string {
  const lowerRole = role.toLowerCase();
  if (lowerRole.includes('hr') || lowerRole.includes('people') || lowerRole.includes('chro') || 
      lowerRole.includes('talent') || lowerRole.includes('personal') || lowerRole.includes('recruiting')) {
    return 'HR';
  } else if (lowerRole.includes('tech') || lowerRole.includes('cto') || lowerRole.includes('engineer') || 
             lowerRole.includes('development') || lowerRole.includes('it ') || lowerRole.includes('software')) {
    return 'Tech';
  } else if (lowerRole.includes('marketing') || lowerRole.includes('cmo') || lowerRole.includes('brand')) {
    return 'Marketing';
  } else if (lowerRole.includes('sales') || lowerRole.includes('vertrieb') || lowerRole.includes('revenue') ||
             lowerRole.includes('business development')) {
    return 'Sales';
  } else if (lowerRole.includes('finance') || lowerRole.includes('cfo') || lowerRole.includes('finanz') ||
             lowerRole.includes('accounting')) {
    return 'Finance';
  } else if (lowerRole.includes('ceo') || lowerRole.includes('geschäftsführer') || lowerRole.includes('managing') || 
             lowerRole.includes('founder') || lowerRole.includes('coo') || lowerRole.includes('vorstand')) {
    return 'Leadership';
  } else if (lowerRole.includes('operations') || lowerRole.includes('betrieb')) {
    return 'Operations';
  }
  return 'Other';
}

// Deduplicate contacts by name
function deduplicateContacts(contacts: KeyExecutive[]): KeyExecutive[] {
  const seen = new Map<string, KeyExecutive>();
  
  for (const contact of contacts) {
    const key = contact.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, { ...contact });
    } else {
      // Merge additional data from other sources
      const existing = seen.get(key)!;
      if (!existing.email && contact.email) existing.email = contact.email;
      if (!existing.linkedin && contact.linkedin) existing.linkedin = contact.linkedin;
      if (!existing.xing && contact.xing) existing.xing = contact.xing;
      if (!existing.phone && contact.phone) existing.phone = contact.phone;
      if (!existing.bio && contact.bio) existing.bio = contact.bio;
      // Append source
      if (contact.source && existing.source && !existing.source.includes(contact.source)) {
        existing.source = `${existing.source}, ${contact.source}`;
      }
    }
  }
  
  return Array.from(seen.values());
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_id, domain, company_name, crawl_news = true, crawl_extended = true, crawl_all_sources = true } = await req.json();

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

    console.log(`[Company Crawl] Starting MULTI-SOURCE crawl for ${companyNameToUse} (${companyDomain})`);

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

    // Source tracking for dashboard widget
    const sourceTracking: Record<string, SourceTrackingEntry> = {};

    // Format domain for URL
    let formattedDomain = companyDomain.trim().toLowerCase();
    if (!formattedDomain.startsWith('http')) {
      formattedDomain = `https://${formattedDomain}`;
    }

    // ======= MULTI-SOURCE CRAWLING =======
    const allContacts: KeyExecutive[] = [];

    // SOURCE 1: Main Website + Tech Stack
    console.log(`[Company Crawl] Source 1: Main website ${formattedDomain}`);
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
            'html',
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
                  technologies_mentioned: { type: 'array', items: { type: 'string' } },
                  cloud_provider: { type: 'string' },
                },
              },
              prompt: 'Extract company information: industry/sector, headquarters city and country, employee count/headcount, founding year. Also extract any technologies, frameworks, programming languages, or cloud providers mentioned.',
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
        
        const fieldsExtracted: string[] = [];
        if (basics) {
          if (basics.industry) { result.industry = basics.industry; fieldsExtracted.push('industry'); }
          if (basics.headquarters_city) { result.city = basics.headquarters_city; fieldsExtracted.push('city'); }
          if (basics.headquarters_country) { result.country = basics.headquarters_country; fieldsExtracted.push('country'); }
          if (basics.employee_count) { result.headcount = basics.employee_count; fieldsExtracted.push('headcount'); }
          if (basics.founded_year) { result.founded_year = basics.founded_year; fieldsExtracted.push('founded_year'); }
          if (basics.cloud_provider) { result.cloud_provider = basics.cloud_provider; fieldsExtracted.push('cloud_provider'); }
          if (basics.technologies_mentioned && Array.isArray(basics.technologies_mentioned)) {
            result.technologies = basics.technologies_mentioned.slice(0, 20);
            fieldsExtracted.push('technologies');
          }
        }
        
        const detectedTech = detectTechnologiesFromHtml(html);
        if (detectedTech.length > 0) {
          result.technologies = [...new Set([...(result.technologies || []), ...detectedTech])].slice(0, 30);
          if (!fieldsExtracted.includes('technologies')) fieldsExtracted.push('technologies');
        }

        sourceTracking['website'] = {
          crawled_at: new Date().toISOString(),
          status: fieldsExtracted.length > 0 ? 'success' : 'no_results',
          fields: fieldsExtracted
        };
      } else {
        sourceTracking['website'] = { crawled_at: new Date().toISOString(), status: 'error' };
      }
    } catch (e) {
      console.error(`[Company Crawl] Source 1 error:`, e);
      sourceTracking['website'] = { crawled_at: new Date().toISOString(), status: 'error', error: String(e) };
    }

    // SOURCE 2: Impressum (Legal Data + Executives)
    if (crawl_all_sources) {
      console.log(`[Company Crawl] Source 2: Impressum/Legal pages`);
      const impressumUrls = [
        `${formattedDomain}/impressum`,
        `${formattedDomain}/legal`,
        `${formattedDomain}/legal-notice`,
        `${formattedDomain}/imprint`,
        `${formattedDomain}/kontakt`,
        `${formattedDomain}/about/impressum`,
      ];
      
      let impressumSuccess = false;
      let contactsFromImpressum = 0;
      
      for (const url of impressumUrls) {
        try {
          const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url,
              formats: [{
                type: 'json',
                schema: {
                  type: 'object',
                  properties: {
                    company_legal_name: { type: 'string' },
                    geschaeftsfuehrer: { type: 'array', items: { type: 'string' } },
                    handelsregister: { type: 'string' },
                    ust_id: { type: 'string' },
                    address: { type: 'string' },
                    city: { type: 'string' },
                    postal_code: { type: 'string' },
                    phone: { type: 'string' },
                    email: { type: 'string' },
                  }
                },
                prompt: 'Extrahiere alle rechtlichen Informationen: Geschäftsführer, Vorstand, CEOs, Managing Directors, Handelsregister-Nummer, USt-ID, vollständige Adresse, Kontaktdaten.'
              }],
              waitFor: 2000,
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            const json = data.data?.json;
            
            if (json) {
              if (json.company_legal_name) result.legal_name = json.company_legal_name;
              if (json.city && !result.city) result.city = json.city;
              if (json.address) result.address = json.address;
              if (json.handelsregister) result.handelsregister = json.handelsregister;
              
              // Extract executives from Impressum
              if (json.geschaeftsfuehrer && Array.isArray(json.geschaeftsfuehrer)) {
                for (const name of json.geschaeftsfuehrer) {
                  if (name && typeof name === 'string' && name.length > 2) {
                    allContacts.push({
                      name: name.trim(),
                      role: 'Geschäftsführer',
                      source: 'impressum'
                    });
                    contactsFromImpressum++;
                  }
                }
                console.log(`[Company Crawl] Impressum: Found ${json.geschaeftsfuehrer.length} executives`);
              }
              impressumSuccess = true;
              break; // Found valid impressum, stop searching
            }
          }
        } catch (e) {
          // Continue to next URL
        }
      }

      sourceTracking['impressum'] = {
        crawled_at: new Date().toISOString(),
        status: impressumSuccess ? 'success' : 'no_results',
        contacts_found: contactsFromImpressum
      };
    }

    // SOURCE 3: Team/About Page
    if (crawl_all_sources) {
      console.log(`[Company Crawl] Source 3: Team/About pages`);
      let teamPageSuccess = false;
      let teamContactsFound = 0;
      
      try {
        // First find team pages via map
        const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: formattedDomain, 
            search: 'team leadership management führung vorstand about', 
            limit: 30 
          })
        });
        
        if (mapResponse.ok) {
          const mapData = await mapResponse.json();
          const teamUrls = (mapData.links || []).filter((url: string) => 
            /team|leadership|management|ueber-uns|about.*team|vorstand|geschaeft|fuehrung|founders/i.test(url)
          ).slice(0, 3);
          
          for (const url of teamUrls) {
            try {
              const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  url,
                  formats: [{
                    type: 'json',
                    schema: {
                      type: 'object',
                      properties: {
                        team_members: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              role: { type: 'string' },
                              email: { type: 'string' },
                              linkedin: { type: 'string' },
                              bio: { type: 'string' },
                            }
                          }
                        }
                      }
                    },
                    prompt: 'Extrahiere ALLE Teammitglieder, Führungskräfte, Gründer, Vorstände mit Name, Rolle/Position, E-Mail, LinkedIn-URL und kurzer Bio.'
                  }],
                  waitFor: 3000,
                })
              });
              
              if (scrapeResponse.ok) {
                const data = await scrapeResponse.json();
                const members = data.data?.json?.team_members || [];
                
                for (const member of members) {
                  if (member.name && typeof member.name === 'string') {
                    allContacts.push({
                      name: member.name.trim(),
                      role: member.role || 'Team Member',
                      email: member.email,
                      linkedin: member.linkedin,
                      bio: member.bio,
                      source: 'team_page'
                    });
                    teamContactsFound++;
                    teamPageSuccess = true;
                  }
                }
                console.log(`[Company Crawl] Team page ${url}: Found ${members.length} members`);
              }
            } catch (e) {
              // Continue
            }
          }
        }
      } catch (e) {
        console.error(`[Company Crawl] Source 3 error:`, e);
      }

      sourceTracking['team_page'] = {
        crawled_at: new Date().toISOString(),
        status: teamPageSuccess ? 'success' : 'no_results',
        contacts_found: teamContactsFound
      };
    }

    // SOURCE 4: LinkedIn Deep Search for Executives
    let linkedinExecutivesFound = 0;
    if (crawl_extended && companyNameToUse) {
      console.log(`[Company Crawl] Source 4: LinkedIn executive search for ${companyNameToUse}`);
      
      const roleQueries = [
        `site:linkedin.com/in "${companyNameToUse}" CEO OR "Chief Executive" OR Geschäftsführer`,
        `site:linkedin.com/in "${companyNameToUse}" CTO OR "Chief Technology" OR "VP Engineering"`,
        `site:linkedin.com/in "${companyNameToUse}" CFO OR "Chief Financial" OR "Finance Director"`,
        `site:linkedin.com/in "${companyNameToUse}" CHRO OR "Head of HR" OR "VP People" OR Personalleiter`,
        `site:linkedin.com/in "${companyNameToUse}" CMO OR "Head of Marketing" OR "Marketing Director"`,
        `site:linkedin.com/in "${companyNameToUse}" "Head of Sales" OR "Sales Director" OR Vertriebsleiter`,
        `site:linkedin.com/in "${companyNameToUse}" COO OR "Operations Director"`,
        `site:linkedin.com/in "${companyNameToUse}" Founder OR Gründer OR "Co-Founder"`,
      ];
      
      const seenNames = new Set<string>();
      
      for (const query of roleQueries) {
        try {
          const response = await fetch('https://api.firecrawl.dev/v1/search', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, limit: 5 })
          });
          
          if (response.ok) {
            const data = await response.json();
            
            for (const r of (data.data || [])) {
              if (!r.url?.includes('linkedin.com/in')) continue;
              
              // Parse "Name - Title at Company | LinkedIn"
              const titleMatch = r.title?.match(/^([^-–]+)\s*[-–]\s*([^|]+)/);
              if (titleMatch) {
                const name = titleMatch[1].trim();
                const role = titleMatch[2].trim();
                
                if (name && name.length > 2 && !seenNames.has(name.toLowerCase())) {
                  seenNames.add(name.toLowerCase());
                  allContacts.push({
                    name,
                    role,
                    linkedin: r.url,
                    source: 'linkedin'
                  });
                  linkedinExecutivesFound++;
                }
              }
            }
          }
        } catch (e) {
          // Continue with next query
        }
      }
      console.log(`[Company Crawl] LinkedIn: Found ${seenNames.size} executives`);

      sourceTracking['linkedin_people'] = {
        crawled_at: new Date().toISOString(),
        status: linkedinExecutivesFound > 0 ? 'success' : 'no_results',
        executives_found: linkedinExecutivesFound
      };
    }

    // SOURCE 5: Xing Search
    if (crawl_all_sources && companyNameToUse) {
      console.log(`[Company Crawl] Source 5: Xing search for ${companyNameToUse}`);
      
      try {
        // Company page
        const companyQuery = `site:xing.com/companies "${companyNameToUse}"`;
        const companyResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: companyQuery, limit: 3 })
        });
        
        if (companyResponse.ok) {
          const data = await companyResponse.json();
          const xingUrl = data.data?.find((r: any) => r.url?.includes('xing.com/companies'))?.url;
          if (xingUrl) {
            result.xing_url = xingUrl;
            console.log(`[Company Crawl] Xing company URL: ${xingUrl}`);
          }
        }
        
        // People search on Xing
        const peopleQuery = `site:xing.com/profile "${companyNameToUse}" Geschäftsführer OR CEO OR "Head of"`;
        const peopleResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: peopleQuery, limit: 10 })
        });
        
        if (peopleResponse.ok) {
          const data = await peopleResponse.json();
          
          for (const r of (data.data || [])) {
            if (!r.url?.includes('xing.com/profile')) continue;
            
            const name = r.title?.split('-')[0]?.split('–')[0]?.trim();
            const roleMatch = r.description?.match(/(CEO|CTO|CFO|Geschäftsführer|Head of[^,]+|Director[^,]+|Leiter[^,]+)/i);
            const role = roleMatch?.[1] || 'Executive';
            
            if (name && name.length > 2 && name.length < 50) {
              allContacts.push({
                name,
                role,
                xing: r.url,
                source: 'xing'
              });
            }
          }
        }
      } catch (e) {
        console.error(`[Company Crawl] Source 5 (Xing) error:`, e);
      }
    }

    // SOURCE 6: Crunchbase
    if (crawl_extended && companyNameToUse) {
      console.log(`[Company Crawl] Source 6: Crunchbase for ${companyNameToUse}`);
      
      try {
        const query = `site:crunchbase.com/organization "${companyNameToUse}"`;
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 3 })
        });
        
        if (response.ok) {
          const data = await response.json();
          const crunchbaseResult = data.data?.find((r: any) => r.url?.includes('crunchbase.com/organization'));
          
          if (crunchbaseResult) {
            const snippet = crunchbaseResult.description || '';
            
            // Extract funding from snippet
            const fundingMatch = snippet.match(/\$[\d.]+[BMK]/);
            const roundMatch = snippet.match(/(Series [A-Z]|Seed|IPO|Pre-Seed)/i);
            
            if (fundingMatch) result.funding_total = fundingMatch[0];
            if (roundMatch) result.funding_stage = roundMatch[1];
            
            console.log(`[Company Crawl] Crunchbase: Funding ${result.funding_total || 'n/a'}, Stage ${result.funding_stage || 'n/a'}`);
          }
        }
      } catch (e) {
        console.error(`[Company Crawl] Source 6 (Crunchbase) error:`, e);
      }
    }

    // ======= CAREER PAGE CRAWLING (keep existing logic) =======
    console.log(`[Company Crawl] Step: Career page mapping ${formattedDomain}`);
    
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

          let careerSubpageLinks: string[] = [];
          let bestJobListingUrl: string | null = null;
          
          try {
            const careerDomain = new URL(careerUrl).origin;
            
            const careerMapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${firecrawlApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                url: careerDomain,
                search: 'jobs positions stellen openings vacancies karriere',
                limit: 300,
              }),
            });

            if (careerMapResponse.ok) {
              const careerMapData = await careerMapResponse.json();
              careerSubpageLinks = careerMapData.links || [];
              bestJobListingUrl = findBestJobListingUrl(careerSubpageLinks, careerDomain);
            }
          } catch (e) {
            // Continue
          }

          const urlToScrape = bestJobListingUrl || careerUrl;
          
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
                    },
                  },
                  prompt: 'Extract all job listings from this career/jobs page. For each job, extract the title, location, and department if available.',
                },
              ],
              onlyMainContent: true,
              waitFor: 5000,
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
                url: urlToScrape,
              }));
            }
            
            if (result.live_jobs.length === 0 && pageLinks.length > 0) {
              const jobLinks = pageLinks.filter((l: string) => 
                /\/job[s]?\/[a-z0-9-]+|\/stelle[n]?\/[a-z0-9-]+|\/position[s]?\/[a-z0-9-]+|\/opening[s]?\/[a-z0-9-]+/i.test(l) &&
                !l.endsWith('/jobs') && !l.endsWith('/careers') && !l.endsWith('/positions')
              );
              
              if (jobLinks.length > 0) {
                result.live_jobs = jobLinks.slice(0, 50).map((url: string) => extractJobFromUrl(url));
              }
            }

            if (result.live_jobs.length === 0 && careerSubpageLinks.length > 0) {
              const individualJobLinks = careerSubpageLinks.filter((l: string) => {
                const lowerLink = l.toLowerCase();
                return (
                  /\/job[s]?\/[a-z0-9-]{5,}/i.test(lowerLink) ||
                  /\/position[s]?\/[a-z0-9-]{5,}/i.test(lowerLink) ||
                  /\/stelle[n]?\/[a-z0-9-]{5,}/i.test(lowerLink)
                ) && 
                !lowerLink.endsWith('/jobs') && 
                !lowerLink.endsWith('/positions');
              });
              
              if (individualJobLinks.length > 0) {
                result.live_jobs = individualJobLinks.slice(0, 50).map((url: string) => extractJobFromUrl(url));
              }
            }

            if (!jsonData?.remote_policy && markdown) {
              result.remote_policy = extractRemotePolicy(markdown) || undefined;
            } else if (jsonData?.remote_policy) {
              result.remote_policy = jsonData.remote_policy;
            }

            result.live_jobs_count = result.live_jobs.length;
            result.hiring_activity = classifyHiringActivity(result.live_jobs_count);
          }
        }
      }
    } catch (e) {
      console.error(`[Company Crawl] Career page error:`, e);
      result.career_page_status = 'error';
    }

    // News search
    if (crawl_news && companyNameToUse) {
      console.log(`[Company Crawl] News search for ${companyNameToUse}`);
      
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
        }
      } catch (e) {
        console.error(`[Company Crawl] News error:`, e);
      }
    }

    // Kununu / Glassdoor
    if (crawl_extended && companyNameToUse) {
      console.log(`[Company Crawl] Employer branding scores for ${companyNameToUse}`);
      
      try {
        const kununuQuery = `site:kununu.com "${companyNameToUse}"`;
        const kununuResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: kununuQuery, limit: 3 })
        });
        
        if (kununuResponse.ok) {
          const data = await kununuResponse.json();
          for (const r of (data.data || [])) {
            const scoreData = parseKununuScore(r.description || r.title || '');
            if (scoreData) {
              result.kununu_score = scoreData.score;
              result.kununu_reviews = scoreData.reviews;
              break;
            }
          }
        }
      } catch (e) {}
      
      try {
        const glassdoorQuery = `site:glassdoor.com "${companyNameToUse}"`;
        const glassdoorResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: glassdoorQuery, limit: 3 })
        });
        
        if (glassdoorResponse.ok) {
          const data = await glassdoorResponse.json();
          for (const r of (data.data || [])) {
            const scoreData = parseKununuScore(r.description || r.title || '');
            if (scoreData) {
              result.glassdoor_score = scoreData.score;
              result.glassdoor_reviews = scoreData.reviews;
              break;
            }
          }
        }
      } catch (e) {}
    }

    // LinkedIn company URL
    if (crawl_extended && companyNameToUse && !result.linkedin_url) {
      try {
        const linkedinQuery = `site:linkedin.com/company "${companyNameToUse}"`;
        const linkedinResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: linkedinQuery, limit: 3 })
        });
        
        if (linkedinResponse.ok) {
          const data = await linkedinResponse.json();
          const linkedinUrl = data.data?.find((r: any) => r.url?.includes('linkedin.com/company'))?.url;
          if (linkedinUrl) {
            result.linkedin_url = linkedinUrl;
          }
        }
      } catch (e) {}
    }

    // Awards search
    if (crawl_extended && companyNameToUse) {
      try {
        const awardsQuery = `"${companyNameToUse}" award OR auszeichnung OR "best employer" OR "top arbeitgeber" 2024 2025`;
        const awardsResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: awardsQuery, limit: 5 })
        });
        
        if (awardsResponse.ok) {
          const data = await awardsResponse.json();
          const awardTitles = (data.data || [])
            .map((r: any) => r.title)
            .filter((t: string) => t && /award|auszeichnung|best|top|winner/i.test(t))
            .slice(0, 5);
          
          if (awardTitles.length > 0) {
            result.awards = awardTitles;
          }
        }
      } catch (e) {}
    }

    // ======= CONSOLIDATE & DEDUPLICATE CONTACTS =======
    console.log(`[Company Crawl] Consolidating ${allContacts.length} contacts from all sources`);
    result.key_executives = deduplicateContacts(allContacts);
    console.log(`[Company Crawl] After dedup: ${result.key_executives.length} unique contacts`);

    // Calculate priority score
    let priorityScore = 0;
    if (result.live_jobs_count >= 10) priorityScore += 30;
    else if (result.live_jobs_count >= 5) priorityScore += 20;
    else if (result.live_jobs_count >= 1) priorityScore += 10;
    
    if (result.recent_news.length > 0) priorityScore += 10;
    if (result.funding_stage) priorityScore += 15;
    if (result.key_executives.length > 0) priorityScore += 15;
    if (result.kununu_score && result.kununu_score >= 4.0) priorityScore += 10;

    // Update company in database
    if (company_id) {
      const updateData: Record<string, any> = {
        ...(result.industry && { industry: result.industry }),
        ...(result.city && { city: result.city }),
        ...(result.country && { country: result.country }),
        ...(result.headcount && { headcount: result.headcount }),
        ...(result.address && { address: result.address }),
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
        if (result.technologies && result.technologies.length > 0) updateData.technologies = result.technologies;
        if (result.cloud_provider) updateData.cloud_provider = result.cloud_provider;
        if (result.development_tools && result.development_tools.length > 0) updateData.development_tools = result.development_tools;
        if (result.kununu_score) updateData.kununu_score = result.kununu_score;
        if (result.glassdoor_score) updateData.glassdoor_score = result.glassdoor_score;
        if (result.revenue_range) updateData.revenue_range = result.revenue_range;
        if (result.employee_growth) updateData.employee_growth = result.employee_growth;
        if (result.company_culture && result.company_culture.length > 0) updateData.company_culture = result.company_culture;
        
        updateData.last_enriched_at = new Date().toISOString();
      }

      // Add source tracking
      if (Object.keys(sourceTracking).length > 0) {
        updateData.crawl_sources = sourceTracking;
      }

      const { error: updateError } = await supabase
        .from('outreach_companies')
        .update(updateData)
        .eq('id', company_id);

      if (updateError) {
        console.error(`[Company Crawl] Update error:`, updateError);
      }
    }

    // ======= AUTO-CREATE CONTACTS FROM ALL SOURCES =======
    if (result.key_executives.length > 0 && company_id) {
      console.log(`[Company Crawl] Auto-creating ${result.key_executives.length} contacts`);
      
      for (const exec of result.key_executives) {
        if (!exec.name || exec.name.length < 2) continue;
        
        // Check if contact already exists (by name OR LinkedIn OR Xing)
        let existingCheck = supabase
          .from('outreach_leads')
          .select('id')
          .eq('company_id', company_id)
          .ilike('contact_name', exec.name);
        
        const { data: existing } = await existingCheck.maybeSingle();
        
        if (!existing) {
          const decisionLevel = categorizeDecisionLevel(exec.role || '');
          const functionalArea = categorizeFunctionalArea(exec.role || '');
          
          // FIX: Use contact_role instead of contact_title
          const { error: insertError } = await supabase
            .from('outreach_leads')
            .insert({
              company_id: company_id,
              company_name: companyNameToUse,
              contact_name: exec.name,
              contact_email: exec.email || generatePlaceholderEmail(exec.name, companyDomain || 'unbekannt.de'),
              contact_role: exec.role, // FIXED: was contact_title
              personal_linkedin_url: exec.linkedin || null,
              lead_source: exec.source || 'multi_source_crawl',
              segment: 'enterprise',
              decision_level: decisionLevel,
              functional_area: functionalArea,
              status: 'neu',
              contact_outreach_status: 'nicht_kontaktiert',
              notes: exec.bio ? `Bio: ${exec.bio}` : (exec.source ? `Quelle: ${exec.source}` : null),
            });
          
          if (insertError) {
            console.error(`[Company Crawl] Failed to create contact ${exec.name}:`, insertError.message);
          } else {
            console.log(`[Company Crawl] Created contact: ${exec.name} (${decisionLevel}, ${functionalArea})`);
          }
        } else {
          console.log(`[Company Crawl] Contact already exists: ${exec.name}`);
        }
      }
    }

    console.log(`[Company Crawl] Completed for ${companyNameToUse} - ${result.key_executives.length} executives, ${result.live_jobs_count} jobs`);

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
