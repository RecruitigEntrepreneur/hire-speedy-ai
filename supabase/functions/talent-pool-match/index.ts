import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { job_id } = await req.json();

    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all active talent pool entries
    const { data: poolEntries, error: poolError } = await supabase
      .from('talent_pool')
      .select(`
        *,
        candidates (
          full_name,
          email,
          skills,
          experience_years
        )
      `)
      .eq('is_active', true);

    if (poolError) {
      console.error('Error fetching talent pool:', poolError);
      return new Response(JSON.stringify({ error: 'Failed to fetch talent pool' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const matchResults = [];
    const alertsCreated = [];

    for (const entry of poolEntries || []) {
      const matchReasons = [];
      let totalScore = 0;
      let factors = 0;

      // Skills match
      const candidateSkills = entry.skills_snapshot || entry.candidates?.skills || [];
      const jobSkills = job.skills || [];
      
      if (jobSkills.length > 0 && candidateSkills.length > 0) {
        const matchingSkills = candidateSkills.filter((skill: string) => 
          jobSkills.some((js: string) => 
            js.toLowerCase().includes(skill.toLowerCase()) || 
            skill.toLowerCase().includes(js.toLowerCase())
          )
        );
        const skillScore = (matchingSkills.length / jobSkills.length) * 100;
        totalScore += skillScore;
        factors++;
        
        if (skillScore > 50) {
          matchReasons.push({
            reason: 'Skills Match',
            score: Math.round(skillScore),
            details: `${matchingSkills.length}/${jobSkills.length} Skills übereinstimmend`,
          });
        }
      }

      // Experience match
      const candidateExp = entry.experience_years || entry.candidates?.experience_years;
      if (candidateExp && job.experience_level) {
        const expLevels: Record<string, [number, number]> = {
          'junior': [0, 2],
          'mid': [2, 5],
          'senior': [5, 10],
          'lead': [7, 15],
        };
        const [minExp, maxExp] = expLevels[job.experience_level] || [0, 20];
        
        if (candidateExp >= minExp && candidateExp <= maxExp + 3) {
          const expScore = 100 - Math.abs(candidateExp - (minExp + maxExp) / 2) * 10;
          totalScore += Math.max(0, expScore);
          factors++;
          
          matchReasons.push({
            reason: 'Erfahrung passend',
            score: Math.round(Math.max(0, expScore)),
            details: `${candidateExp} Jahre (gesucht: ${job.experience_level})`,
          });
        }
      }

      // Location match
      const preferredLocations = entry.preferred_locations || [];
      if (preferredLocations.length > 0 && job.location) {
        const locationMatch = preferredLocations.some((loc: string) =>
          job.location.toLowerCase().includes(loc.toLowerCase()) ||
          loc.toLowerCase().includes(job.location.toLowerCase())
        );
        
        if (locationMatch) {
          totalScore += 100;
          factors++;
          matchReasons.push({
            reason: 'Standort passend',
            score: 100,
            details: job.location,
          });
        }
      }

      // Salary match
      if (entry.salary_expectation_max && job.salary_min) {
        if (entry.salary_expectation_min <= job.salary_max && 
            entry.salary_expectation_max >= job.salary_min) {
          totalScore += 80;
          factors++;
          matchReasons.push({
            reason: 'Gehalt passend',
            score: 80,
            details: `${entry.salary_expectation_min}-${entry.salary_expectation_max}€`,
          });
        }
      }

      // Availability match
      if (entry.availability && entry.availability !== 'passive') {
        totalScore += 60;
        factors++;
        matchReasons.push({
          reason: 'Verfügbar',
          score: 60,
          details: entry.availability,
        });
      }

      const matchScore = factors > 0 ? Math.round(totalScore / factors) : 0;

      if (matchScore >= 70) {
        matchResults.push({
          talent_pool_id: entry.id,
          candidate_name: entry.candidates?.full_name,
          match_score: matchScore,
          match_reasons: matchReasons,
        });

        // Check if alert already exists
        const { data: existingAlert } = await supabase
          .from('talent_alerts')
          .select('id')
          .eq('talent_pool_id', entry.id)
          .eq('job_id', job_id)
          .single();

        if (!existingAlert) {
          // Create alert
          const { data: alert, error: alertError } = await supabase
            .from('talent_alerts')
            .insert({
              talent_pool_id: entry.id,
              job_id,
              match_score: matchScore,
              match_reasons: matchReasons,
              status: 'pending',
            })
            .select()
            .single();

          if (!alertError && alert) {
            alertsCreated.push(alert);
          }
        }
      }
    }

    console.log(`Talent pool match for job ${job_id}: ${matchResults.length} matches found, ${alertsCreated.length} alerts created`);

    return new Response(JSON.stringify({
      success: true,
      job_id,
      matches_found: matchResults.length,
      alerts_created: alertsCreated.length,
      matches: matchResults,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in talent-pool-match:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
