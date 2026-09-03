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
  /** Vertragsrelevante Felder aus dem Impressum.
   *
   *  Sie wurden hier schon immer aus der Impressum-Seite extrahiert (Schema
   *  unten) und dann nicht ins Ergebnis uebernommen -- ausgerechnet die drei,
   *  die eine Vereinbarung braucht. Ein deutsches Impressum traegt sie nach
   *  Paragraph 5 TMG verpflichtend, es ist die genaueste Quelle, die es fuer
   *  Firmierung, Adresse und Registernummer gibt. */
  legal_name?: string;
  street?: string;
  postal_code?: string;
  registration_number?: string;
  vat_id?: string;
  ceo_name?: string;
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

    /**
     * Diagnose. Bisher hat diese Function jeden Fehlschlag verschluckt: die
     * drei Firecrawl-Aufrufe stehen hinter `if (response.ok)`, und was sonst
     * passiert, erfaehrt niemand. Ergebnis war ein `success: true` mit einem
     * einzigen Feld -- dem aus der Domain abgeleiteten Namen. Von aussen sah
     * das aus, als haette die Seite nichts hergegeben.
     */
    const warnings: { step: string; status?: number; detail?: string }[] = [];
    const merke = async (step: string, r: Response) => {
      if (r.ok) return true;
      let detail = '';
      try { detail = (await r.clone().text()).slice(0, 200); } catch { /* egal */ }
      warnings.push({ step, status: r.status, detail });
      console.error(`[Enrich] ${step} fehlgeschlagen: ${r.status} ${detail}`);
      return false;
    };

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

      if (await merke('startseite', scrapeResponse)) {
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

      if (await merke('seitenkarte', mapResponse)) {
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
                      legal_name: { type: 'string', description: 'Full legal name including legal form, e.g. "Muster GmbH"' },
                      street: { type: 'string', description: 'Street and house number only, without city' },
                      postal_code: { type: 'string' },
                      address: { type: 'string' },
                      city: { type: 'string' },
                      country: { type: 'string' },
                      founding_year: { type: 'string' },
                      ceo_name: { type: 'string' },
                      employee_count: { type: 'string' },
                      registration_number: { type: 'string', description: 'Commercial register entry, e.g. "HRB 288632"' },
                      vat_id: { type: 'string', description: 'VAT identification number, e.g. "DE123456789"' },
                    },
                  },
                  prompt: 'Extract company details from this impressum/about page. A German Impressum '
                    + 'legally contains the full legal name, street address, commercial register '
                    + 'number (Handelsregister/HRB), VAT ID (USt-IdNr.) and the managing director '
                    + '(Geschaeftsfuehrer). Extract them verbatim, do not guess or complete missing '
                    + 'values -- a wrong register or VAT number ends up in a contract.',
                },
              ],
              onlyMainContent: true,
            }),
          });

          if (await merke('impressum', aboutResponse)) {
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
      // Genau diese Felder fehlten bisher. Ohne sie muss der Kunde Firmierung,
      // Adresse und Registernummer abtippen, obwohl sie auf seiner eigenen
      // Impressum-Seite stehen.
      if (aboutData.legal_name) result.legal_name = String(aboutData.legal_name).trim();
      if (aboutData.street) result.street = String(aboutData.street).trim();
      if (aboutData.postal_code) result.postal_code = String(aboutData.postal_code).trim();
      if (aboutData.registration_number) result.registration_number = String(aboutData.registration_number).trim();
      if (aboutData.vat_id) result.vat_id = String(aboutData.vat_id).trim();
      if (aboutData.ceo_name) result.ceo_name = String(aboutData.ceo_name).trim();
      // Fallback: manche Impressen fuehren nur eine Adresszeile.
      if (!result.street && aboutData.address) {
        const m = String(aboutData.address).match(/^(.+?)[,\n]\s*(\d{4,5})\s+(.+)$/);
        if (m) {
          result.street = m[1].trim();
          result.postal_code = result.postal_code ?? m[2];
          if (!result.city) result.city = m[3].trim();
        } else {
          result.street = String(aboutData.address).trim();
        }
      }
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
        // Leer heisst: alle drei Schritte liefen. Steht hier etwas, hat
        // Firecrawl abgelehnt -- und der duenne Datensatz ist kein Befund
        // ueber die Website, sondern ein Betriebsproblem.
        warnings,
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
