import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RetrievalFilters {
  jobId?: string;
  location?: { lat: number; lng: number; radiusKm: number };
  remoteOnly?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  seniorityLevels?: string[];
  mustHaveSkills?: string[];
  experienceMin?: number;
  experienceMax?: number;
  limit?: number;
  useSemanticSearch?: boolean; // NEW: Enable hybrid semantic search
}

interface RetrievalResult {
  candidateId: string;
  fullName: string;
  matchedFilters: string[];
  preScore: number; // Quick pre-score for ordering
  semanticScore?: number; // NEW: Semantic similarity score
  keywordScore?: number; // NEW: Keyword match score
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const filters = await req.json() as RetrievalFilters;
    const limit = filters.limit || 200;

    console.log('Retrieval filters:', filters);

    // NEW: Try hybrid semantic search if enabled and job has embedding
    if (filters.useSemanticSearch && filters.jobId) {
      console.log('Attempting hybrid semantic search for job:', filters.jobId);
      
      // Get job's embedding
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('embedding, must_haves')
        .eq('id', filters.jobId)
        .single();
      
      if (!jobError && job?.embedding) {
        console.log('Job has embedding, using hybrid search');
        
        // Use hybrid search RPC function
        const { data: hybridResults, error: hybridError } = await supabase.rpc('search_candidates_hybrid', {
          query_embedding: job.embedding,
          keyword_skills: filters.mustHaveSkills || job.must_haves || [],
          salary_max: filters.salaryMax || null,
          limit_count: limit
        });
        
        if (!hybridError && hybridResults && hybridResults.length > 0) {
          console.log(`Hybrid search returned ${hybridResults.length} candidates`);
          
          // If jobId provided, exclude already submitted candidates
          let excludeIds: string[] = [];
          if (filters.jobId) {
            const { data: existingSubmissions } = await supabase
              .from('submissions')
              .select('candidate_id')
              .eq('job_id', filters.jobId);
            
            excludeIds = (existingSubmissions || []).map(s => s.candidate_id);
          }
          
          const filteredResults = hybridResults
            .filter((r: any) => !excludeIds.includes(r.candidate_id))
            .map((r: any) => ({
              candidateId: r.candidate_id,
              fullName: r.full_name,
              matchedFilters: [r.match_explanation],
              preScore: Math.round(r.hybrid_score * 3000), // Scale for comparison
              semanticScore: r.semantic_score,
              keywordScore: r.keyword_score
            }));
          
          return new Response(
            JSON.stringify({
              candidates: filteredResults,
              stats: {
                totalScanned: hybridResults.length,
                returned: filteredResults.length,
                avgPreScore: filteredResults.length > 0 
                  ? Math.round(filteredResults.reduce((s: number, c: any) => s + c.preScore, 0) / filteredResults.length)
                  : 0,
                searchType: 'hybrid_semantic'
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log('Hybrid search failed or empty, falling back to keyword search', hybridError);
        }
      } else {
        console.log('Job has no embedding, falling back to keyword search');
      }
    }

    // Build query with hard filters
    let query = supabase
      .from('candidates')
      .select(`
        id,
        full_name,
        email,
        skills,
        experience_years,
        expected_salary,
        salary_expectation_min,
        salary_expectation_max,
        city,
        remote_preference,
        work_model,
        seniority,
        availability_date,
        address_lat,
        address_lng
      `)
      .order('updated_at', { ascending: false })
      .limit(limit * 3); // Fetch more to filter

    // If jobId provided, exclude already submitted candidates
    if (filters.jobId) {
      const { data: existingSubmissions } = await supabase
        .from('submissions')
        .select('candidate_id')
        .eq('job_id', filters.jobId);
      
      const excludeIds = (existingSubmissions || []).map(s => s.candidate_id);
      if (excludeIds.length > 0) {
        query = query.not('id', 'in', `(${excludeIds.join(',')})`);
      }
    }

    // Experience filter
    if (filters.experienceMin !== undefined) {
      query = query.gte('experience_years', filters.experienceMin);
    }
    if (filters.experienceMax !== undefined) {
      query = query.lte('experience_years', filters.experienceMax);
    }

    // Seniority filter
    if (filters.seniorityLevels && filters.seniorityLevels.length > 0) {
      query = query.in('seniority', filters.seniorityLevels);
    }

    const { data: candidates, error } = await query;

    if (error) {
      console.error('Error fetching candidates:', error);
      throw new Error('Failed to fetch candidates');
    }

    // Post-filter and score
    const results: RetrievalResult[] = [];

    for (const candidate of candidates || []) {
      const matchedFilters: string[] = [];
      let preScore = 50; // Base score

      // Remote filter
      if (filters.remoteOnly) {
        const isRemote = candidate.remote_preference === 'remote' || 
                        candidate.work_model === 'remote' ||
                        candidate.remote_preference === 'hybrid';
        if (!isRemote) continue;
        matchedFilters.push('remote');
        preScore += 10;
      }

      // Salary filter (soft - warn but include)
      if (filters.salaryMax !== undefined) {
        const candidateSalary = candidate.expected_salary || 
                               candidate.salary_expectation_min || 0;
        if (candidateSalary > 0) {
          if (candidateSalary <= filters.salaryMax) {
            matchedFilters.push('salary_in_range');
            preScore += 15;
          } else if (candidateSalary <= filters.salaryMax * 1.2) {
            matchedFilters.push('salary_negotiable');
            preScore += 5;
          } else {
            // Salary too high - skip
            continue;
          }
        }
      }

      // Location/Distance filter
      if (filters.location && candidate.address_lat && candidate.address_lng) {
        const distance = calculateDistance(
          filters.location.lat,
          filters.location.lng,
          candidate.address_lat,
          candidate.address_lng
        );
        if (distance <= filters.location.radiusKm) {
          matchedFilters.push('location_match');
          preScore += 20;
        } else if (distance <= filters.location.radiusKm * 1.5) {
          matchedFilters.push('location_close');
          preScore += 10;
        }
      }

      // Skills filter
      if (filters.mustHaveSkills && filters.mustHaveSkills.length > 0) {
        const candidateSkills = (candidate.skills || []).map((s: string) => s.toLowerCase());
        let matchedCount = 0;
        
        for (const skill of filters.mustHaveSkills) {
          const skillLower = skill.toLowerCase();
          if (candidateSkills.some((cs: string) => 
            cs.includes(skillLower) || skillLower.includes(cs)
          )) {
            matchedCount++;
          }
        }
        
        const matchRatio = matchedCount / filters.mustHaveSkills.length;
        if (matchRatio >= 0.3) { // At least 30% skill match
          matchedFilters.push('skills_partial');
          preScore += Math.round(matchRatio * 30);
        }
        if (matchRatio >= 0.7) {
          matchedFilters.push('skills_strong');
          preScore += 20;
        }
      }

      // Experience bonus
      if (candidate.experience_years) {
        if (candidate.experience_years >= 5) preScore += 5;
        if (candidate.experience_years >= 10) preScore += 5;
      }

      // Availability bonus (available soon)
      if (candidate.availability_date) {
        const availDate = new Date(candidate.availability_date);
        const daysTillAvailable = Math.ceil((availDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysTillAvailable <= 30) {
          matchedFilters.push('available_soon');
          preScore += 10;
        }
      }

      results.push({
        candidateId: candidate.id,
        fullName: candidate.full_name,
        matchedFilters,
        preScore: Math.min(100, preScore)
      });
    }

    // Sort by pre-score and limit
    results.sort((a, b) => b.preScore - a.preScore);
    const topResults = results.slice(0, limit);

    console.log(`Retrieved ${topResults.length} candidates from ${candidates?.length || 0} total`);

    return new Response(
      JSON.stringify({
        candidates: topResults,
        stats: {
          totalScanned: candidates?.length || 0,
          returned: topResults.length,
          avgPreScore: topResults.length > 0 
            ? Math.round(topResults.reduce((s, c) => s + c.preScore, 0) / topResults.length)
            : 0,
          searchType: 'keyword'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in candidate-retrieval:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
