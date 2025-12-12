import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FunnelMetrics {
  entity_type: string;
  entity_id: string | null;
  period_days: number;
  total_submissions: number;
  submissions_to_opt_in: number;
  opt_in_to_interview: number;
  interview_to_offer: number;
  offer_to_placement: number;
  opt_in_rate: number;
  interview_rate: number;
  offer_rate: number;
  acceptance_rate: number;
  avg_time_to_fill_days: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { action, period_days = 30 } = await req.json()

    if (action === 'calculate_funnel_metrics') {
      // Calculate platform-wide funnel metrics
      const periodStart = new Date()
      periodStart.setDate(periodStart.getDate() - period_days)

      // Get submission counts by status
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, status, stage, submitted_at, job_id')
        .gte('submitted_at', periodStart.toISOString())

      const totalSubmissions = submissions?.length || 0
      const optedIn = submissions?.filter(s => 
        ['opted_in', 'interview', 'second_interview', 'offer', 'hired'].includes(s.status || '')
      ).length || 0
      const interviewed = submissions?.filter(s => 
        ['interview', 'second_interview', 'offer', 'hired'].includes(s.status || '')
      ).length || 0
      const offered = submissions?.filter(s => 
        ['offer', 'hired'].includes(s.status || '')
      ).length || 0
      const placed = submissions?.filter(s => s.status === 'hired').length || 0

      // Calculate rates
      const optInRate = totalSubmissions > 0 ? (optedIn / totalSubmissions) * 100 : 0
      const interviewRate = optedIn > 0 ? (interviewed / optedIn) * 100 : 0
      const offerRate = interviewed > 0 ? (offered / interviewed) * 100 : 0
      const acceptanceRate = offered > 0 ? (placed / offered) * 100 : 0

      // Get average time to fill
      const { data: placements } = await supabase
        .from('placements')
        .select('created_at, submission:submissions(submitted_at)')
        .gte('created_at', periodStart.toISOString())

      let avgTimeToFill = null
      if (placements && placements.length > 0) {
        const times = placements
          .filter((p: any) => p.submission?.submitted_at)
          .map((p: any) => {
            const start = new Date(p.submission.submitted_at)
            const end = new Date(p.created_at)
            return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          })
        if (times.length > 0) {
          avgTimeToFill = times.reduce((a, b) => a + b, 0) / times.length
        }
      }

      // Upsert platform metrics
      const platformMetrics: FunnelMetrics = {
        entity_type: 'platform',
        entity_id: null,
        period_days,
        total_submissions: totalSubmissions,
        submissions_to_opt_in: optedIn,
        opt_in_to_interview: interviewed,
        interview_to_offer: offered,
        offer_to_placement: placed,
        opt_in_rate: Math.round(optInRate * 100) / 100,
        interview_rate: Math.round(interviewRate * 100) / 100,
        offer_rate: Math.round(offerRate * 100) / 100,
        acceptance_rate: Math.round(acceptanceRate * 100) / 100,
        avg_time_to_fill_days: avgTimeToFill ? Math.round(avgTimeToFill * 10) / 10 : null,
      }

      const { error: upsertError } = await supabase
        .from('funnel_metrics')
        .upsert(
          { ...platformMetrics, calculated_at: new Date().toISOString() },
          { onConflict: 'entity_type,period_days' }
        )

      if (upsertError) {
        console.error('Error upserting metrics:', upsertError)
      }

      return new Response(JSON.stringify({ 
        success: true, 
        metrics: platformMetrics 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'calculate_deal_health') {
      // Get active submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          stage,
          submitted_at,
          updated_at,
          candidate:candidates(full_name),
          job:jobs(title, company_name)
        `)
        .not('status', 'in', '("rejected","hired","withdrawn")')

      if (!submissions) {
        return new Response(JSON.stringify({ success: true, processed: 0 }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const now = new Date()
      const dealHealthRecords = []

      for (const submission of submissions) {
        const lastActivity = submission.updated_at || submission.submitted_at
        const daysSinceActivity = lastActivity 
          ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : 0

        // Calculate health score (100 = healthy, 0 = critical)
        let healthScore = 100

        // Penalize for inactivity
        if (daysSinceActivity > 3) healthScore -= 10
        if (daysSinceActivity > 7) healthScore -= 20
        if (daysSinceActivity > 14) healthScore -= 30
        if (daysSinceActivity > 30) healthScore -= 40

        // Determine risk level
        let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
        if (healthScore < 70) riskLevel = 'medium'
        if (healthScore < 50) riskLevel = 'high'
        if (healthScore < 30) riskLevel = 'critical'

        // Determine bottleneck
        let bottleneck = null
        if (submission.status === 'submitted' && daysSinceActivity > 3) {
          bottleneck = 'waiting_for_review'
        } else if (submission.status === 'screening' && daysSinceActivity > 5) {
          bottleneck = 'slow_screening'
        } else if (submission.status === 'interview' && daysSinceActivity > 7) {
          bottleneck = 'interview_scheduling'
        } else if (submission.status === 'offer' && daysSinceActivity > 5) {
          bottleneck = 'offer_pending'
        }

        // Calculate drop-off probability
        const dropOffProbability = Math.min(100, Math.max(0, 100 - healthScore + daysSinceActivity * 2))

        dealHealthRecords.push({
          submission_id: submission.id,
          health_score: Math.max(0, healthScore),
          risk_level: riskLevel,
          drop_off_probability: dropOffProbability,
          days_since_last_activity: daysSinceActivity,
          bottleneck: bottleneck,
          bottleneck_days: bottleneck ? daysSinceActivity : 0,
          risk_factors: daysSinceActivity > 7 ? ['Lange Inaktivität'] : [],
          recommended_actions: bottleneck ? ['Follow-up durchführen'] : [],
          calculated_at: now.toISOString(),
        })
      }

      // Upsert deal health records
      for (const record of dealHealthRecords) {
        await supabase
          .from('deal_health')
          .upsert(record, { onConflict: 'submission_id' })
      }

      return new Response(JSON.stringify({ 
        success: true, 
        processed: dealHealthRecords.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'calculate_all') {
      // Calculate both funnel metrics and deal health
      const funnel = await fetch(req.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate_funnel_metrics', period_days })
      })

      const dealHealth = await fetch(req.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate_deal_health' })
      })

      return new Response(JSON.stringify({ 
        success: true, 
        funnel: await funnel.json(),
        dealHealth: await dealHealth.json()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})