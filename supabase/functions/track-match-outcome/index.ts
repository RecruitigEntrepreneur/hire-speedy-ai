import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutcomeRequest {
  submissionId: string;
  outcome: 'hired' | 'rejected' | 'withdrew' | 'expired';
  stage: string;
  rejectionReason?: string;
  rejectionCategory?: 'skills' | 'experience' | 'salary' | 'culture' | 'availability' | 'other';
}

interface CalibrationStats {
  version: string;
  totalPredictions: number;
  outcomes: {
    hired: number;
    rejected: number;
    withdrew: number;
    expired: number;
  };
  accuracy: {
    overall: number;
    byScoreBucket: Record<string, { predicted: number; actual: number; accuracy: number }>;
  };
  calibration: {
    overconfident: number;
    underconfident: number;
    wellCalibrated: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'record';

    if (action === 'record') {
      // Record an outcome
      const { submissionId, outcome, stage, rejectionReason, rejectionCategory } = await req.json() as OutcomeRequest;

      if (!submissionId || !outcome) {
        return new Response(
          JSON.stringify({ error: 'submissionId and outcome are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get submission and existing prediction
      const { data: matchOutcome, error: getError } = await supabase
        .from('match_outcomes')
        .select('*')
        .eq('submission_id', submissionId)
        .single();

      if (getError && getError.code !== 'PGRST116') {
        throw getError;
      }

      // Calculate days to outcome
      let daysToOutcome: number | null = null;
      if (matchOutcome) {
        const created = new Date(matchOutcome.created_at);
        daysToOutcome = Math.ceil((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Update or insert
      const outcomeData = {
        submission_id: submissionId,
        actual_outcome: outcome,
        outcome_stage: stage,
        rejection_reason: rejectionReason || null,
        rejection_category: rejectionCategory || null,
        days_to_outcome: daysToOutcome,
        outcome_recorded_at: new Date().toISOString()
      };

      if (matchOutcome) {
        const { error: updateError } = await supabase
          .from('match_outcomes')
          .update(outcomeData)
          .eq('id', matchOutcome.id);
        
        if (updateError) throw updateError;
      } else {
        // Need to also fetch job/candidate from submission
        const { data: submission } = await supabase
          .from('submissions')
          .select('job_id, candidate_id')
          .eq('id', submissionId)
          .single();

        if (submission) {
          const { error: insertError } = await supabase
            .from('match_outcomes')
            .insert({
              ...outcomeData,
              job_id: submission.job_id,
              candidate_id: submission.candidate_id,
              match_version: 'v3'
            });
          
          if (insertError) throw insertError;
        }
      }

      console.log(`Recorded outcome: ${outcome} for submission ${submissionId} at stage ${stage}`);

      return new Response(
        JSON.stringify({ success: true, outcome, stage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'calibrate') {
      // Get calibration stats
      const version = url.searchParams.get('version') || 'v3';
      
      const { data: outcomes, error } = await supabase
        .from('match_outcomes')
        .select('*')
        .eq('match_version', version)
        .not('actual_outcome', 'is', null);

      if (error) throw error;

      const stats: CalibrationStats = {
        version,
        totalPredictions: outcomes?.length || 0,
        outcomes: { hired: 0, rejected: 0, withdrew: 0, expired: 0 },
        accuracy: { overall: 0, byScoreBucket: {} },
        calibration: { overconfident: 0, underconfident: 0, wellCalibrated: 0 }
      };

      if (!outcomes || outcomes.length === 0) {
        return new Response(
          JSON.stringify(stats),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Count outcomes
      for (const o of outcomes) {
        const outcome = o.actual_outcome as keyof typeof stats.outcomes;
        if (stats.outcomes[outcome] !== undefined) {
          stats.outcomes[outcome]++;
        }
      }

      // Calculate accuracy by score buckets
      const buckets: Record<string, { predicted: number; actualHires: number; count: number }> = {
        '0-30': { predicted: 0, actualHires: 0, count: 0 },
        '31-50': { predicted: 0, actualHires: 0, count: 0 },
        '51-70': { predicted: 0, actualHires: 0, count: 0 },
        '71-85': { predicted: 0, actualHires: 0, count: 0 },
        '86-100': { predicted: 0, actualHires: 0, count: 0 }
      };

      for (const o of outcomes) {
        const score = o.predicted_overall_score || 50;
        let bucket = '51-70';
        
        if (score <= 30) bucket = '0-30';
        else if (score <= 50) bucket = '31-50';
        else if (score <= 70) bucket = '51-70';
        else if (score <= 85) bucket = '71-85';
        else bucket = '86-100';

        buckets[bucket].predicted += score;
        buckets[bucket].count++;
        if (o.actual_outcome === 'hired') {
          buckets[bucket].actualHires++;
        }
      }

      // Calculate accuracy per bucket
      let totalCorrect = 0;
      for (const [bucket, data] of Object.entries(buckets)) {
        if (data.count === 0) continue;
        
        const avgPredicted = data.predicted / data.count;
        const actualRate = (data.actualHires / data.count) * 100;
        const accuracy = 100 - Math.abs(avgPredicted - actualRate);
        
        stats.accuracy.byScoreBucket[bucket] = {
          predicted: Math.round(avgPredicted),
          actual: Math.round(actualRate),
          accuracy: Math.round(accuracy)
        };

        // Calibration
        const diff = avgPredicted - actualRate;
        if (diff > 15) {
          stats.calibration.overconfident += data.count;
        } else if (diff < -15) {
          stats.calibration.underconfident += data.count;
        } else {
          stats.calibration.wellCalibrated += data.count;
          totalCorrect += data.count;
        }
      }

      stats.accuracy.overall = Math.round((totalCorrect / outcomes.length) * 100);

      console.log(`Calibration stats for ${version}: ${stats.totalPredictions} predictions, ${stats.accuracy.overall}% well-calibrated`);

      return new Response(
        JSON.stringify(stats),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'rejection-analysis') {
      // Analyze rejection patterns
      const { data: rejections, error } = await supabase
        .from('match_outcomes')
        .select('*')
        .eq('actual_outcome', 'rejected')
        .not('rejection_category', 'is', null);

      if (error) throw error;

      const analysis: Record<string, { count: number; avgPredictedScore: number; stages: Record<string, number> }> = {};

      for (const r of rejections || []) {
        const cat = r.rejection_category;
        if (!analysis[cat]) {
          analysis[cat] = { count: 0, avgPredictedScore: 0, stages: {} };
        }
        analysis[cat].count++;
        analysis[cat].avgPredictedScore += r.predicted_overall_score || 0;
        
        const stage = r.outcome_stage || 'unknown';
        analysis[cat].stages[stage] = (analysis[cat].stages[stage] || 0) + 1;
      }

      // Calculate averages
      for (const cat of Object.keys(analysis)) {
        analysis[cat].avgPredictedScore = Math.round(analysis[cat].avgPredictedScore / analysis[cat].count);
      }

      return new Response(
        JSON.stringify({
          totalRejections: rejections?.length || 0,
          byCategory: analysis
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in track-match-outcome:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
