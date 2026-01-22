import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Industry classification mapping
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'FinTech': ['fintech', 'banking', 'payment', 'financial', 'bank', 'insurance', 'versicherung', 'zahlungs'],
  'HealthTech': ['health', 'medical', 'healthcare', 'gesundheit', 'pharma', 'biotech', 'medizin', 'klinik'],
  'E-Commerce': ['ecommerce', 'e-commerce', 'retail', 'online shop', 'marketplace', 'handel'],
  'Automotive': ['automotive', 'car', 'vehicle', 'mobility', 'automobil', 'fahrzeug'],
  'Technology': ['software', 'saas', 'cloud', 'tech', 'digital', 'it-', 'platform'],
  'EdTech': ['education', 'learning', 'edtech', 'bildung', 'schule', 'university'],
  'CleanTech': ['energy', 'renewable', 'solar', 'wind', 'sustainability', 'clean', 'green', 'energie'],
  'Consulting': ['consulting', 'beratung', 'advisory', 'professional services'],
  'Manufacturing': ['manufacturing', 'industrial', 'produktion', 'fertigung', 'machinery'],
  'Media': ['media', 'entertainment', 'gaming', 'medien', 'content', 'streaming'],
  'Real Estate': ['real estate', 'property', 'proptech', 'immobilien'],
  'Logistics': ['logistics', 'supply chain', 'shipping', 'transport', 'logistik', 'lieferkette'],
};

// Tech stack normalization mapping
const TECH_NORMALIZATIONS: Record<string, string[]> = {
  'React': ['react', 'reactjs', 'react.js', 'react 18', 'react 17'],
  'Vue.js': ['vue', 'vuejs', 'vue.js', 'vue3', 'vue 3', 'nuxt', 'nuxtjs'],
  'Angular': ['angular', 'angularjs', 'angular.js'],
  'TypeScript': ['typescript', 'ts'],
  'JavaScript': ['javascript', 'js', 'es6', 'ecmascript'],
  'Node.js': ['node', 'nodejs', 'node.js', 'express', 'expressjs'],
  'Python': ['python', 'python3', 'django', 'flask', 'fastapi'],
  'Java': ['java', 'spring', 'spring boot', 'springboot', 'jakarta'],
  'AWS': ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'cloudfront'],
  'Azure': ['azure', 'microsoft azure', 'azure devops'],
  'GCP': ['gcp', 'google cloud', 'google cloud platform', 'bigquery'],
  'Docker': ['docker', 'container', 'containerization'],
  'Kubernetes': ['kubernetes', 'k8s', 'helm', 'kubectl'],
  'PostgreSQL': ['postgresql', 'postgres', 'psql'],
  'MySQL': ['mysql', 'mariadb'],
  'MongoDB': ['mongodb', 'mongo'],
  'Redis': ['redis', 'caching'],
  'GraphQL': ['graphql', 'apollo', 'hasura'],
  'REST API': ['rest', 'restful', 'rest api', 'api'],
  'CI/CD': ['ci/cd', 'cicd', 'jenkins', 'github actions', 'gitlab ci'],
  'Terraform': ['terraform', 'iac', 'infrastructure as code'],
  '.NET': ['.net', 'dotnet', 'c#', 'csharp', 'asp.net'],
  'Go': ['go', 'golang'],
  'Rust': ['rust', 'rustlang'],
  'Kafka': ['kafka', 'event streaming', 'apache kafka'],
  'Elasticsearch': ['elasticsearch', 'elastic', 'elk', 'opensearch'],
  'Machine Learning': ['ml', 'machine learning', 'tensorflow', 'pytorch', 'keras', 'ai/ml'],
};

// Company size estimation from headcount
function estimateCompanySizeBand(headcount: number | null): string | null {
  if (!headcount) return null;
  if (headcount <= 50) return '1-50';
  if (headcount <= 200) return '51-200';
  if (headcount <= 500) return '201-500';
  if (headcount <= 1000) return '501-1000';
  return '1000+';
}

// Classify industry from text
function classifyIndustry(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return industry;
      }
    }
  }
  
  return null;
}

// Normalize tech stack
function normalizeTechStack(skills: string[]): string[] {
  const normalized = new Set<string>();
  
  for (const skill of skills) {
    const lowerSkill = skill.toLowerCase().trim();
    let matched = false;
    
    for (const [normalizedName, variants] of Object.entries(TECH_NORMALIZATIONS)) {
      for (const variant of variants) {
        if (lowerSkill === variant || lowerSkill.includes(variant)) {
          normalized.add(normalizedName);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    
    // Keep original skill if no normalization found (but capitalize first letter)
    if (!matched && skill.trim()) {
      normalized.add(skill.trim().charAt(0).toUpperCase() + skill.trim().slice(1));
    }
  }
  
  return Array.from(normalized);
}

// Map hiring activity to urgency
function mapHiringUrgency(hiringActivity: string | null, liveJobsCount: number | null): string {
  if (hiringActivity === 'hot' || (liveJobsCount && liveJobsCount >= 10)) {
    return 'ASAP';
  }
  if (hiringActivity === 'active' || (liveJobsCount && liveJobsCount >= 5)) {
    return 'urgent';
  }
  return 'standard';
}

interface EnrichmentRequest {
  jobData: {
    title: string;
    company_name: string;
    description: string | null;
    skills: string[];
    location: string | null;
    remote_type: string | null;
  };
  companyDomain?: string;
}

interface EnrichmentResult {
  industry: string | null;
  company_size_band: string | null;
  funding_stage: string | null;
  tech_environment: string[];
  hiring_urgency: string;
  normalized_skills: string[];
  company_insights: {
    live_jobs_count: number | null;
    career_page_url: string | null;
    linkedin_url: string | null;
    recent_news: string | null;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    const { jobData, companyDomain }: EnrichmentRequest = await req.json();

    if (!jobData) {
      return new Response(
        JSON.stringify({ error: "jobData is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting job enrichment for:", jobData.company_name);

    // Initialize result
    const result: EnrichmentResult = {
      industry: null,
      company_size_band: null,
      funding_stage: null,
      tech_environment: [],
      hiring_urgency: 'standard',
      normalized_skills: [],
      company_insights: {
        live_jobs_count: null,
        career_page_url: null,
        linkedin_url: null,
        recent_news: null,
      },
    };

    // Step 1: Normalize tech stack from skills
    if (jobData.skills && jobData.skills.length > 0) {
      result.normalized_skills = normalizeTechStack(jobData.skills);
      result.tech_environment = result.normalized_skills.slice(0, 10); // Top 10 for display
    }

    // Step 2: Classify industry from description + company name
    const textForClassification = `${jobData.company_name} ${jobData.description || ''} ${jobData.title}`;
    result.industry = classifyIndustry(textForClassification);

    // Step 3: If we have Firecrawl API key and company domain, crawl for more info
    if (FIRECRAWL_API_KEY && companyDomain) {
      try {
        console.log("Crawling company domain:", companyDomain);
        
        // Search for company info
        const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `${jobData.company_name} company funding employees`,
            limit: 3,
          }),
        });

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          console.log("Search results found:", searchData.data?.length || 0);
          
          // Try to extract funding stage and size from search results
          if (searchData.data && searchData.data.length > 0) {
            const combinedText = searchData.data.map((r: any) => `${r.title} ${r.description || ''}`).join(' ').toLowerCase();
            
            // Detect funding stage
            if (combinedText.includes('series c') || combinedText.includes('series d') || combinedText.includes('ipo')) {
              result.funding_stage = 'Series C+';
            } else if (combinedText.includes('series b')) {
              result.funding_stage = 'Series B';
            } else if (combinedText.includes('series a')) {
              result.funding_stage = 'Series A';
            } else if (combinedText.includes('seed')) {
              result.funding_stage = 'Seed';
            } else if (combinedText.includes('bootstrapped') || combinedText.includes('profitable')) {
              result.funding_stage = 'Bootstrapped';
            }
            
            // Extract employee count
            const employeeMatch = combinedText.match(/(\d+(?:,\d+)?(?:\+)?)\s*(?:employees?|mitarbeiter|beschäftigte)/i);
            if (employeeMatch) {
              const count = parseInt(employeeMatch[1].replace(/,/g, '').replace('+', ''));
              result.company_size_band = estimateCompanySizeBand(count);
            }
          }
        }

        // Try to find career page
        const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: `https://${companyDomain}`,
            search: 'career jobs',
            limit: 50,
          }),
        });

        if (mapResponse.ok) {
          const mapData = await mapResponse.json();
          
          if (mapData.links) {
            // Find career page
            const careerPage = mapData.links.find((url: string) => 
              url.toLowerCase().includes('career') || 
              url.toLowerCase().includes('jobs') ||
              url.toLowerCase().includes('stellenangebot')
            );
            if (careerPage) {
              result.company_insights.career_page_url = careerPage;
              
              // Estimate live jobs from number of job-like URLs
              const jobUrls = mapData.links.filter((url: string) => 
                url.toLowerCase().includes('/job') || 
                url.toLowerCase().includes('/position') ||
                url.toLowerCase().includes('/stelle')
              );
              result.company_insights.live_jobs_count = Math.min(jobUrls.length, 50);
            }
          }
        }
      } catch (crawlError) {
        console.warn("Error crawling company:", crawlError);
        // Continue without crawl data
      }
    }

    // Step 4: Use AI to enhance classification if we have API key and missing data
    if (LOVABLE_API_KEY && (!result.industry || !result.company_size_band)) {
      try {
        console.log("Using AI for enhanced classification...");
        
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { 
                role: "system", 
                content: "You are a company research expert. Analyze job postings to identify company characteristics." 
              },
              { 
                role: "user", 
                content: `Analyze this job posting and classify the company:
                
Company: ${jobData.company_name}
Title: ${jobData.title}
Location: ${jobData.location || 'Not specified'}
Description: ${(jobData.description || '').substring(0, 1500)}

Classify and return structured data.` 
              }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "classify_company",
                  description: "Classify company characteristics from job posting",
                  parameters: {
                    type: "object",
                    properties: {
                      industry: { 
                        type: "string",
                        enum: ["FinTech", "HealthTech", "E-Commerce", "Automotive", "Technology", "EdTech", "CleanTech", "Consulting", "Manufacturing", "Media", "Real Estate", "Logistics", "Other"],
                        description: "Company industry"
                      },
                      estimated_size: {
                        type: "string",
                        enum: ["1-50", "51-200", "201-500", "501-1000", "1000+"],
                        description: "Estimated company size based on context clues"
                      },
                      funding_stage: {
                        type: "string",
                        enum: ["Bootstrapped", "Seed", "Series A", "Series B", "Series C+", "Public", "Unknown"],
                        description: "Estimated funding stage"
                      },
                      hiring_urgency: {
                        type: "string",
                        enum: ["ASAP", "urgent", "standard"],
                        description: "Hiring urgency based on job posting language"
                      }
                    },
                    required: ["industry", "estimated_size", "hiring_urgency"]
                  }
                }
              }
            ],
            tool_choice: { type: "function", function: { name: "classify_company" } }
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          
          if (toolCall) {
            const classification = JSON.parse(toolCall.function.arguments);
            
            // Only fill in missing data
            if (!result.industry && classification.industry !== 'Other') {
              result.industry = classification.industry;
            }
            if (!result.company_size_band) {
              result.company_size_band = classification.estimated_size;
            }
            if (!result.funding_stage && classification.funding_stage !== 'Unknown') {
              result.funding_stage = classification.funding_stage;
            }
            if (classification.hiring_urgency) {
              result.hiring_urgency = classification.hiring_urgency;
            }
            
            console.log("AI classification complete:", classification);
          }
        }
      } catch (aiError) {
        console.warn("Error with AI classification:", aiError);
        // Continue with existing data
      }
    }

    // Final urgency calculation based on live jobs count
    if (result.company_insights.live_jobs_count) {
      result.hiring_urgency = mapHiringUrgency(null, result.company_insights.live_jobs_count);
    }

    console.log("Enrichment complete:", {
      industry: result.industry,
      size: result.company_size_band,
      funding: result.funding_stage,
      tech_count: result.tech_environment.length,
      urgency: result.hiring_urgency
    });

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error enriching job:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
