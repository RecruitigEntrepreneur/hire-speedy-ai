import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Candidate {
  id: string;
  full_name: string;
  job_title: string | null;
  company: string | null;
  skills: string[] | null;
  cv_ai_summary: string | null;
  experience_years: number | null;
  seniority: string | null;
  city: string | null;
  remote_preference: string | null;
  specializations: any | null;
  industry_experience: any | null;
}

interface Job {
  id: string;
  title: string;
  company_name: string | null;
  description: string | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  experience_level: string | null;
  location: string | null;
  work_model: string | null;
  industry: string | null;
}

// 64-dimensional feature vector dimensions for semantic matching
const FEATURE_DIMENSIONS = `
[0]: frontend_score (0-1)
[1]: backend_score (0-1)
[2]: fullstack_score (0-1)
[3]: devops_score (0-1)
[4]: data_engineering_score (0-1)
[5]: mobile_score (0-1)
[6]: security_score (0-1)
[7]: cloud_score (0-1)
[8]: ai_ml_score (0-1)
[9]: architecture_score (0-1)
[10-19]: top_10_skill_proficiency (react, node, python, java, typescript, kubernetes, aws, sql, go, rust)
[20]: junior_level (0-1)
[21]: mid_level (0-1)
[22]: senior_level (0-1)
[23]: lead_level (0-1)
[24]: architect_level (0-1)
[25]: startup_fit (0-1)
[26]: enterprise_fit (0-1)
[27]: agency_fit (0-1)
[28]: consulting_fit (0-1)
[29]: remote_preference (0-1)
[30]: hybrid_preference (0-1)
[31]: onsite_preference (0-1)
[32-41]: industry_experience (fintech, healthcare, ecommerce, saas, gaming, automotive, logistics, media, energy, manufacturing)
[42]: leadership_experience (0-1)
[43]: team_management (0-1)
[44]: project_complexity (0-1)
[45]: communication_skills (0-1)
[46]: problem_solving (0-1)
[47]: innovation_mindset (0-1)
[48]: adaptability (0-1)
[49]: technical_depth (0-1)
[50]: breadth_of_knowledge (0-1)
[51]: years_experience_normalized (0-1, 0=0yrs, 1=20+yrs)
[52-63]: reserved for future dimensions
`;

function buildCandidateProfileText(c: Candidate): string {
  const parts: string[] = [];
  
  if (c.job_title) {
    parts.push(`${c.job_title}${c.experience_years ? ` mit ${c.experience_years} Jahren Erfahrung` : ''}.`);
  }
  
  if (c.company) {
    parts.push(`Aktuell bei ${c.company}.`);
  }
  
  if (c.skills && c.skills.length > 0) {
    parts.push(`Kernkompetenzen: ${c.skills.join(', ')}.`);
  }
  
  if (c.seniority) {
    parts.push(`Seniority: ${c.seniority}.`);
  }
  
  if (c.cv_ai_summary) {
    parts.push(c.cv_ai_summary);
  }
  
  if (c.city) {
    parts.push(`Standort: ${c.city}${c.remote_preference ? `, ${c.remote_preference}` : ''}.`);
  }
  
  if (c.specializations && Array.isArray(c.specializations) && c.specializations.length > 0) {
    parts.push(`Spezialisierungen: ${c.specializations.join(', ')}.`);
  }
  
  if (c.industry_experience && Array.isArray(c.industry_experience) && c.industry_experience.length > 0) {
    parts.push(`Branchenerfahrung: ${c.industry_experience.join(', ')}.`);
  }
  
  return parts.join(' ').trim().slice(0, 8000);
}

function buildJobProfileText(j: Job): string {
  const parts: string[] = [];
  
  parts.push(`${j.title}${j.company_name ? ` bei ${j.company_name}` : ''}.`);
  
  if (j.description) {
    parts.push(j.description);
  }
  
  if (j.must_haves && j.must_haves.length > 0) {
    parts.push(`Erforderliche Skills: ${j.must_haves.join(', ')}.`);
  }
  
  if (j.nice_to_haves && j.nice_to_haves.length > 0) {
    parts.push(`Nice-to-have: ${j.nice_to_haves.join(', ')}.`);
  }
  
  if (j.experience_level) {
    parts.push(`Erfahrungslevel: ${j.experience_level}.`);
  }
  
  if (j.location) {
    parts.push(`Standort: ${j.location}${j.work_model ? `, ${j.work_model}` : ''}.`);
  }
  
  if (j.industry) {
    parts.push(`Branche: ${j.industry}.`);
  }
  
  return parts.join(' ').trim().slice(0, 8000);
}

async function generateEmbedding(text: string): Promise<number[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }
  
  console.log('Generating Gemini feature vector for text of length:', text.length);
  
  const prompt = `Analyze this profile and extract a 64-dimensional feature vector for semantic matching.

Profile:
${text}

Feature dimensions:
${FEATURE_DIMENSIONS}

INSTRUCTIONS:
1. Analyze the profile carefully
2. Score each dimension from 0.0 to 1.0 based on the profile content
3. If information is not available for a dimension, use 0.5 as neutral
4. Return ONLY a JSON array of exactly 64 floating point numbers
5. No explanations, no markdown, just the array

Example output format:
[0.8, 0.3, 0.6, 0.2, 0.1, 0.0, 0.4, 0.7, 0.5, 0.6, 0.9, 0.8, 0.7, 0.3, 0.9, 0.2, 0.6, 0.4, 0.1, 0.0, 0.0, 0.2, 0.8, 0.0, 0.0, 0.7, 0.3, 0.2, 0.4, 0.8, 0.2, 0.0, 0.6, 0.3, 0.5, 0.4, 0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.7, 0.5, 0.6, 0.7, 0.8, 0.6, 0.7, 0.8, 0.6, 0.65, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent outputs
      max_tokens: 1000,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
    console.error('Invalid Gemini response:', data);
    throw new Error('Invalid Gemini response structure');
  }
  
  const content = data.choices[0].message.content.trim();
  console.log('Gemini response:', content.slice(0, 200));
  
  // Parse the JSON array from the response
  let embedding: number[];
  try {
    // Handle potential markdown code blocks
    let jsonStr = content;
    if (jsonStr.includes('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }
    embedding = JSON.parse(jsonStr);
  } catch (parseError) {
    console.error('Failed to parse embedding JSON:', content);
    throw new Error(`Failed to parse embedding: ${parseError}`);
  }
  
  // Validate the embedding
  if (!Array.isArray(embedding) || embedding.length !== 64) {
    console.error('Invalid embedding length:', embedding?.length);
    throw new Error(`Invalid embedding length: expected 64, got ${embedding?.length}`);
  }
  
  // Ensure all values are valid numbers between 0 and 1
  embedding = embedding.map((v, i) => {
    if (typeof v !== 'number' || isNaN(v)) {
      console.warn(`Invalid value at index ${i}, defaulting to 0.5`);
      return 0.5;
    }
    return Math.max(0, Math.min(1, v));
  });
  
  return embedding;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, id, batch, batchSize = 10 } = await req.json();

    // Batch processing mode - process queue
    if (batch) {
      console.log('Processing embedding queue, batch size:', batchSize);
      
      // Get pending items from queue
      const { data: queueItems, error: queueError } = await supabase
        .from('embedding_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(batchSize);
      
      if (queueError) {
        throw new Error(`Queue fetch error: ${queueError.message}`);
      }
      
      if (!queueItems || queueItems.length === 0) {
        return new Response(
          JSON.stringify({ processed: 0, message: 'Queue is empty' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const results: { id: string; status: string; error?: string }[] = [];
      
      for (const item of queueItems) {
        // Mark as processing
        await supabase
          .from('embedding_queue')
          .update({ status: 'processing' })
          .eq('id', item.id);
        
        try {
          if (item.entity_type === 'candidate') {
            const { data: candidate, error } = await supabase
              .from('candidates')
              .select('id, full_name, job_title, company, skills, cv_ai_summary, experience_years, seniority, city, remote_preference, specializations, industry_experience')
              .eq('id', item.entity_id)
              .single();
            
            if (error || !candidate) {
              throw new Error(`Candidate not found: ${item.entity_id}`);
            }
            
            const profileText = buildCandidateProfileText(candidate);
            console.log('Candidate profile text:', profileText.slice(0, 200) + '...');
            
            const embedding = await generateEmbedding(profileText);
            
            // Convert embedding array to pgvector format
            const embeddingString = `[${embedding.join(',')}]`;
            
            const { error: updateError } = await supabase
              .from('candidates')
              .update({ 
                embedding: embeddingString,
                embedding_updated_at: new Date().toISOString(),
                embedding_model: 'gemini-2.5-flash-64d'
              })
              .eq('id', item.entity_id);
            
            if (updateError) {
              throw new Error(`Update error: ${updateError.message}`);
            }
          } else if (item.entity_type === 'job') {
            const { data: job, error } = await supabase
              .from('jobs')
              .select('id, title, company_name, description, must_haves, nice_to_haves, experience_level, location, work_model, industry')
              .eq('id', item.entity_id)
              .single();
            
            if (error || !job) {
              throw new Error(`Job not found: ${item.entity_id}`);
            }
            
            const jobText = buildJobProfileText(job);
            console.log('Job profile text:', jobText.slice(0, 200) + '...');
            
            const embedding = await generateEmbedding(jobText);
            
            // Convert embedding array to pgvector format
            const embeddingString = `[${embedding.join(',')}]`;
            
            const { error: updateError } = await supabase
              .from('jobs')
              .update({ 
                embedding: embeddingString,
                embedding_updated_at: new Date().toISOString(),
                embedding_model: 'gemini-2.5-flash-64d'
              })
              .eq('id', item.entity_id);
            
            if (updateError) {
              throw new Error(`Update error: ${updateError.message}`);
            }
          }
          
          // Mark as completed
          await supabase
            .from('embedding_queue')
            .update({ status: 'completed', processed_at: new Date().toISOString() })
            .eq('id', item.id);
          
          results.push({ id: item.id, status: 'completed' });
          
        } catch (error) {
          console.error('Error processing queue item:', item.id, error);
          
          await supabase
            .from('embedding_queue')
            .update({ 
              status: 'failed', 
              error_message: error instanceof Error ? error.message : 'Unknown error' 
            })
            .eq('id', item.id);
          
          results.push({ 
            id: item.id, 
            status: 'failed', 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
      
      // Check remaining queue
      const { count } = await supabase
        .from('embedding_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      
      return new Response(
        JSON.stringify({ 
          processed: results.length,
          results,
          remaining: count || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single entity processing
    if (!type || !id) {
      return new Response(
        JSON.stringify({ error: 'Missing type or id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'candidate') {
      const { data: candidate, error } = await supabase
        .from('candidates')
        .select('id, full_name, job_title, company, skills, cv_ai_summary, experience_years, seniority, city, remote_preference, specializations, industry_experience')
        .eq('id', id)
        .single();
      
      if (error || !candidate) {
        throw new Error(`Candidate not found: ${id}`);
      }
      
      const profileText = buildCandidateProfileText(candidate);
      const embedding = await generateEmbedding(profileText);
      
      const embeddingString = `[${embedding.join(',')}]`;
      
      const { error: updateError } = await supabase
        .from('candidates')
        .update({ 
          embedding: embeddingString,
          embedding_updated_at: new Date().toISOString(),
          embedding_model: 'gemini-2.5-flash-64d'
        })
        .eq('id', id);
      
      if (updateError) {
        throw new Error(`Update error: ${updateError.message}`);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          type: 'candidate',
          id,
          profileTextLength: profileText.length,
          embeddingDimensions: 64
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'job') {
      const { data: job, error } = await supabase
        .from('jobs')
        .select('id, title, company_name, description, must_haves, nice_to_haves, experience_level, location, work_model, industry')
        .eq('id', id)
        .single();
      
      if (error || !job) {
        throw new Error(`Job not found: ${id}`);
      }
      
      const jobText = buildJobProfileText(job);
      const embedding = await generateEmbedding(jobText);
      
      const embeddingString = `[${embedding.join(',')}]`;
      
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ 
          embedding: embeddingString,
          embedding_updated_at: new Date().toISOString(),
          embedding_model: 'gemini-2.5-flash-64d'
        })
        .eq('id', id);
      
      if (updateError) {
        throw new Error(`Update error: ${updateError.message}`);
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          type: 'job',
          id,
          jobTextLength: jobText.length,
          embeddingDimensions: 64
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid type. Must be "candidate" or "job"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-embeddings:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
