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
  
  console.log('Generating embedding for text of length:', text.length);
  
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Embedding API error:', response.status, errorText);
    throw new Error(`Embedding API error: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (!data.data || !data.data[0] || !data.data[0].embedding) {
    console.error('Invalid embedding response:', data);
    throw new Error('Invalid embedding response');
  }
  
  return data.data[0].embedding;
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
                embedding_model: 'text-embedding-3-small'
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
                embedding_model: 'text-embedding-3-small'
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
          embedding_model: 'text-embedding-3-small'
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
          profileTextLength: profileText.length
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
          embedding_model: 'text-embedding-3-small'
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
          jobTextLength: jobText.length
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
