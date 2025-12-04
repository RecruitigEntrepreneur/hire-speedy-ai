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

    console.log('Escalation Engine started...');

    const now = new Date();
    let warningsSent = 0;
    let escalationsTriggered = 0;
    let breachesRecorded = 0;

    // 1. Check for warnings to send
    const { data: warningDeadlines, error: warningError } = await supabase
      .from('sla_deadlines')
      .select(`
        *,
        sla_rules (*)
      `)
      .eq('status', 'active')
      .lte('warning_at', now.toISOString())
      .gt('deadline_at', now.toISOString());

    if (warningError) {
      console.error('Error fetching warning deadlines:', warningError);
    } else if (warningDeadlines && warningDeadlines.length > 0) {
      console.log(`Found ${warningDeadlines.length} deadlines needing warnings`);
      
      for (const deadline of warningDeadlines as any[]) {
        const rule = deadline.sla_rules;
        if (!rule) continue;

        // Send warning notification
        await supabase.from('notifications').insert({
          user_id: deadline.responsible_user_id,
          type: 'sla_warning',
          title: 'SLA-Warnung',
          message: `Achtung: Sie haben noch ${rule.warning_hours} Stunden Zeit für "${rule.rule_name}".`,
          related_type: deadline.entity_type,
          related_id: deadline.entity_id,
        });

        // Update deadline status
        await supabase
          .from('sla_deadlines')
          .update({ status: 'warning_sent', last_reminder_at: now.toISOString() })
          .eq('id', deadline.id);

        warningsSent++;
      }
    }

    // 2. Check for breached deadlines
    const { data: breachedDeadlines, error: breachError } = await supabase
      .from('sla_deadlines')
      .select(`
        *,
        sla_rules (*)
      `)
      .in('status', ['active', 'warning_sent'])
      .lte('deadline_at', now.toISOString());

    if (breachError) {
      console.error('Error fetching breached deadlines:', breachError);
    } else if (breachedDeadlines && breachedDeadlines.length > 0) {
      console.log(`Found ${breachedDeadlines.length} breached deadlines`);

      for (const deadline of breachedDeadlines as any[]) {
        const rule = deadline.sla_rules;
        if (!rule) continue;

        // Execute deadline action
        if (rule.deadline_action === 'remind') {
          // Send reminder with escalation warning
          await supabase.from('notifications').insert({
            user_id: deadline.responsible_user_id,
            type: 'sla_breach',
            title: 'SLA-Überschreitung',
            message: `Die Deadline für "${rule.rule_name}" wurde überschritten. Bitte reagieren Sie umgehend.`,
            related_type: deadline.entity_type,
            related_id: deadline.entity_id,
          });

          // Update reminder count
          await supabase
            .from('sla_deadlines')
            .update({
              reminders_sent: deadline.reminders_sent + 1,
              last_reminder_at: now.toISOString(),
            })
            .eq('id', deadline.id);

        } else if (rule.deadline_action === 'escalate') {
          // Mark as escalated and notify admins
          await supabase
            .from('sla_deadlines')
            .update({
              status: 'escalated',
              breached_at: now.toISOString(),
            })
            .eq('id', deadline.id);

          // Notify admins
          const { data: admins } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin');

          if (admins) {
            for (const admin of admins as any[]) {
              await supabase.from('notifications').insert({
                user_id: admin.user_id,
                type: 'escalation',
                title: 'SLA-Eskalation',
                message: `Eine SLA-Deadline wurde eskaliert: ${rule.rule_name}`,
                related_type: deadline.entity_type,
                related_id: deadline.entity_id,
              });
            }
          }

          escalationsTriggered++;
        }

        // Update behavior scores for the responsible user
        await updateBehaviorScore(supabase, deadline.responsible_user_id, false);
        breachesRecorded++;
      }
    }

    // 3. Update behavior scores for users who completed within SLA
    const { data: completedDeadlines, error: completedError } = await supabase
      .from('sla_deadlines')
      .select('responsible_user_id')
      .eq('status', 'completed')
      .gte('completed_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()); // Last 15 minutes

    if (!completedError && completedDeadlines) {
      const uniqueUsers = [...new Set((completedDeadlines as any[]).map(d => d.responsible_user_id))];
      for (const userId of uniqueUsers) {
        await updateBehaviorScore(supabase, userId, true);
      }
    }

    const summary = {
      success: true,
      timestamp: now.toISOString(),
      warnings_sent: warningsSent,
      escalations_triggered: escalationsTriggered,
      breaches_recorded: breachesRecorded,
    };

    console.log('Escalation Engine completed:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in escalation-engine:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function updateBehaviorScore(
  supabase: any,
  userId: string,
  completedOnTime: boolean
) {
  try {
    // Get user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const userType = (roleData as any)?.role || 'unknown';

    // Get existing behavior score or create new
    const { data: existing } = await supabase
      .from('user_behavior_scores')
      .select('*')
      .eq('user_id', userId)
      .single();

    const existingData = existing as any;

    // Calculate metrics from events
    const { data: events } = await supabase
      .from('platform_events')
      .select('response_time_seconds, created_at')
      .eq('user_id', userId)
      .not('response_time_seconds', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    let avgResponseTimeHours = existingData?.avg_response_time_hours || 0;
    let responseCount = existingData?.response_count || 0;

    if (events && (events as any[]).length > 0) {
      const totalSeconds = (events as any[]).reduce((sum, e) => sum + (e.response_time_seconds || 0), 0);
      avgResponseTimeHours = (totalSeconds / (events as any[]).length) / 3600;
      responseCount = (events as any[]).length;
    }

    // Get SLA compliance rate
    const { count: totalDeadlines } = await supabase
      .from('sla_deadlines')
      .select('*', { count: 'exact', head: true })
      .eq('responsible_user_id', userId)
      .in('status', ['completed', 'breached', 'escalated']);

    const { count: completedDeadlines } = await supabase
      .from('sla_deadlines')
      .select('*', { count: 'exact', head: true })
      .eq('responsible_user_id', userId)
      .eq('status', 'completed');

    const slaComplianceRate = totalDeadlines && totalDeadlines > 0
      ? ((completedDeadlines || 0) / totalDeadlines) * 100
      : 100;

    // Calculate ghost rate (no response events within 72 hours)
    const { count: ghostedCount } = await supabase
      .from('sla_deadlines')
      .select('*', { count: 'exact', head: true })
      .eq('responsible_user_id', userId)
      .in('status', ['breached', 'escalated']);

    const ghostRate = totalDeadlines && totalDeadlines > 0
      ? ((ghostedCount || 0) / totalDeadlines) * 100
      : 0;

    // Determine behavior class
    let behaviorClass = 'neutral';
    if (avgResponseTimeHours < 4 && slaComplianceRate > 95) {
      behaviorClass = 'fast_responder';
    } else if (avgResponseTimeHours > 24 && slaComplianceRate < 70) {
      behaviorClass = 'slow_responder';
    } else if (ghostRate > 20) {
      behaviorClass = 'ghoster';
    } else if (slaComplianceRate > 90) {
      behaviorClass = 'high_performer';
    } else if (slaComplianceRate < 50) {
      behaviorClass = 'at_risk';
    }

    // Calculate risk score (0-100, higher = more risk)
    const riskScore = Math.min(100, Math.max(0,
      (ghostRate * 0.4) +
      ((100 - slaComplianceRate) * 0.4) +
      (Math.min(avgResponseTimeHours, 48) / 48 * 20)
    ));

    // Upsert behavior score
    const scoreData = {
      user_id: userId,
      user_type: userType,
      avg_response_time_hours: avgResponseTimeHours,
      response_count: responseCount,
      ghost_rate: ghostRate,
      sla_compliance_rate: slaComplianceRate,
      behavior_class: behaviorClass,
      risk_score: riskScore,
      calculated_at: new Date().toISOString(),
    };

    if (existingData) {
      await supabase
        .from('user_behavior_scores')
        .update(scoreData)
        .eq('user_id', userId);
    } else {
      await supabase
        .from('user_behavior_scores')
        .insert(scoreData);
    }

    console.log(`Updated behavior score for user ${userId}: ${behaviorClass}, risk: ${riskScore}`);

  } catch (error) {
    console.error('Error updating behavior score:', error);
  }
}