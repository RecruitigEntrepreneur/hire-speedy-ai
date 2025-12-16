import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentResult {
  name: string;
  description?: string;
  industry?: string;
  city?: string;
  country?: string;
  headcount?: number;
  founding_year?: number;
  technologies?: string[];
  social_linkedin?: string;
  social_twitter?: string;
  revenue_range?: string;
  employee_growth?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();

    if (!domain) {
      return new Response(
        JSON.stringify({ success: false, error: 'Domain is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'FIRECRAWL_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize domain
    let normalizedDomain = domain.trim().toLowerCase();
    normalizedDomain = normalizedDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    
    const websiteUrl = `https://${normalizedDomain}`;
    console.log(`[Enrich] Starting enrichment for domain: ${normalizedDomain}`);

    // Step 1: Scrape homepage with structured extraction
    console.log(`[Enrich] Step 1: Scraping homepage ${websiteUrl}`);
    
    let homepageData: any = null;
    let homepageMarkdown = '';
    
    try {
      const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: websiteUrl,
          formats: [
            'markdown',
            {
              type: 'json',
              schema: {
                type: 'object',
                properties: {
                  company_name: { type: 'string', description: 'The official company name' },
                  tagline: { type: 'string', description: 'Company tagline or slogan' },
                  description: { type: 'string', description: 'Brief company description' },
                  industry: { type: 'string', description: 'Industry or sector' },
                  headquarters: { type: 'string', description: 'Headquarters location/city' },
                  employee_count: { type: 'string', description: 'Number of employees if mentioned' },
                  founding_year: { type: 'string', description: 'Year the company was founded' },
                },
              },
              prompt: 'Extract company information from this website. Focus on finding the company name, what they do, their industry, location, and size.',
            },
          ],
          onlyMainContent: true,
        }),
      });

      if (scrapeResponse.ok) {
        const scrapeData = await scrapeResponse.json();
        homepageData = scrapeData.data?.json || scrapeData.json;
        homepageMarkdown = scrapeData.data?.markdown || scrapeData.markdown || '';
        console.log(`[Enrich] Homepage scraped successfully`);
      }
    } catch (e) {
      console.error(`[Enrich] Homepage scrape error:`, e);
    }

    // Step 2: Try to find and scrape Impressum/About page for more details
    console.log(`[Enrich] Step 2: Looking for Impressum/About page`);
    
    let aboutData: any = null;
    
    try {
      // First, map the site to find about/impressum pages
      const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: websiteUrl,
          limit: 50,
        }),
      });

      if (mapResponse.ok) {
        const mapData = await mapResponse.json();
        const links = mapData.links || [];
        
        // Find about/impressum page
        const aboutPatterns = [/impressum/i, /about/i, /über-uns/i, /ueber-uns/i, /company/i, /unternehmen/i];
        const aboutUrl = links.find((link: string) => 
          aboutPatterns.some(pattern => pattern.test(link))
        );

        if (aboutUrl) {
          console.log(`[Enrich] Found about page: ${aboutUrl}`);
          
          const aboutResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url: aboutUrl,
              formats: [
                {
                  type: 'json',
                  schema: {
                    type: 'object',
                    properties: {
                      company_name: { type: 'string' },
                      address: { type: 'string' },
                      city: { type: 'string' },
                      country: { type: 'string' },
                      founding_year: { type: 'string' },
                      ceo_name: { type: 'string' },
                      employee_count: { type: 'string' },
                      registration_number: { type: 'string' },
                    },
                  },
                  prompt: 'Extract company details from this impressum/about page. Look for address, city, founding year, CEO name, and any registration numbers.',
                },
              ],
              onlyMainContent: true,
            }),
          });

          if (aboutResponse.ok) {
            const aboutScrape = await aboutResponse.json();
            aboutData = aboutScrape.data?.json || aboutScrape.json;
            console.log(`[Enrich] About page scraped successfully`);
          }
        }
      }
    } catch (e) {
      console.error(`[Enrich] About page error:`, e);
    }

    // Step 3: Use AI to consolidate and infer missing data
    console.log(`[Enrich] Step 3: AI consolidation`);
    
    let result: EnrichmentResult = {
      name: homepageData?.company_name || aboutData?.company_name || capitalizeFirstLetter(normalizedDomain.split('.')[0]),
    };

    // Merge data from homepage and about page
    if (homepageData) {
      if (homepageData.description) result.description = homepageData.description;
      if (homepageData.industry) result.industry = homepageData.industry;
      if (homepageData.headquarters) result.city = homepageData.headquarters;
      if (homepageData.employee_count) {
        const count = parseEmployeeCount(homepageData.employee_count);
        if (count) result.headcount = count;
      }
      if (homepageData.founding_year) {
        const year = parseInt(homepageData.founding_year);
        if (year > 1800 && year <= new Date().getFullYear()) {
          result.founding_year = year;
        }
      }
    }

    if (aboutData) {
      if (!result.city && aboutData.city) result.city = aboutData.city;
      if (!result.founding_year && aboutData.founding_year) {
        const year = parseInt(aboutData.founding_year);
        if (year > 1800 && year <= new Date().getFullYear()) {
          result.founding_year = year;
        }
      }
      if (!result.headcount && aboutData.employee_count) {
        const count = parseEmployeeCount(aboutData.employee_count);
        if (count) result.headcount = count;
      }
    }

    // Step 4: If we have Lovable API key and missing critical data, use AI to infer
    if (lovableApiKey && (!result.industry || !result.description) && homepageMarkdown) {
      console.log(`[Enrich] Step 4: Using AI to infer missing data`);
      
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a company research assistant. Analyze website content and extract company information. Be concise and accurate. Respond only with valid JSON.',
              },
              {
                role: 'user',
                content: `Analyze this website content and extract company information. Return JSON with these fields:
{
  "industry": "primary industry/sector",
  "description": "1-2 sentence company description",
  "technologies": ["tech1", "tech2"] // if it's a tech company
}

Website content (first 3000 chars):
${homepageMarkdown.slice(0, 3000)}`,
              },
            ],
            temperature: 0.3,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiContent = aiData.choices?.[0]?.message?.content || '';
          
          // Try to parse JSON from response
          const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (!result.industry && parsed.industry) result.industry = parsed.industry;
            if (!result.description && parsed.description) result.description = parsed.description;
            if (parsed.technologies && Array.isArray(parsed.technologies)) {
              result.technologies = parsed.technologies.slice(0, 10);
            }
          }
        }
      } catch (aiError) {
        console.error(`[Enrich] AI inference error:`, aiError);
      }
    }

    console.log(`[Enrich] Completed enrichment for ${normalizedDomain}:`, result);

    return new Response(
      JSON.stringify({
        success: true,
        domain: normalizedDomain,
        data: result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[Enrich] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function parseEmployeeCount(str: string): number | null {
  if (!str) return null;
  
  // Extract numbers
  const numbers = str.match(/\d+/g);
  if (!numbers) return null;
  
  // If range like "100-500", take average
  if (numbers.length >= 2) {
    return Math.round((parseInt(numbers[0]) + parseInt(numbers[1])) / 2);
  }
  
  // If single number with k/K suffix
  if (str.toLowerCase().includes('k')) {
    return parseInt(numbers[0]) * 1000;
  }
  
  return parseInt(numbers[0]);
}
