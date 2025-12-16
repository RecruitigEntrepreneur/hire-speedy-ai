import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    console.log("Processing sequences...");

    // Aktive Sequenzen mit fälligen E-Mails finden
    const { data: sequences, error: seqError } = await supabase
      .from("outreach_sequences")
      .select(`
        *,
        lead:outreach_leads(*),
        campaign:outreach_campaigns(*)
      `)
      .eq("status", "active")
      .lte("next_email_at", new Date().toISOString())
      .limit(100);

    if (seqError) {
      console.error("Error fetching sequences:", seqError);
      throw seqError;
    }

    if (!sequences || sequences.length === 0) {
      console.log("No sequences to process");
      return new Response(
        JSON.stringify({ processed: 0, generated: 0, completed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${sequences.length} sequences...`);

    let processed = 0;
    let generated = 0;
    let completed = 0;

    for (const seq of sequences) {
      try {
        const campaign = seq.campaign;
        const lead = seq.lead;
        
        if (!campaign || !lead) {
          console.error(`Missing campaign or lead for sequence ${seq.id}`);
          continue;
        }

        const steps = campaign.sequence_steps || [];
        const currentStepConfig = steps.find((s: any) => s.step === seq.current_step);

        if (!currentStepConfig) {
          // Sequenz abgeschlossen
          console.log(`Sequence ${seq.id} completed - no more steps`);
          await supabase
            .from("outreach_sequences")
            .update({ status: "completed" })
            .eq("id", seq.id);
          completed++;
          continue;
        }

        // Prüfen ob Lead in der Zwischenzeit geantwortet hat
        if (lead.last_replied_at && new Date(lead.last_replied_at) > new Date(seq.created_at)) {
          console.log(`Sequence ${seq.id} paused - lead replied`);
          await supabase
            .from("outreach_sequences")
            .update({ status: "replied", pause_reason: "Lead hat geantwortet" })
            .eq("id", seq.id);
          continue;
        }

        // E-Mail generieren
        console.log(`Generating email for sequence ${seq.id}, step ${seq.current_step}`);
        
        const baseUrl = Deno.env.get("SUPABASE_URL");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        const genResponse = await fetch(`${baseUrl}/functions/v1/generate-outreach-email`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            lead_id: lead.id,
            campaign_id: campaign.id,
            sequence_step: seq.current_step
          })
        });

        if (!genResponse.ok) {
          const errorText = await genResponse.text();
          console.error(`Error generating email for sequence ${seq.id}:`, errorText);
          continue;
        }

        const genData = await genResponse.json();

        if (genData?.email) {
          console.log(`Email ${genData.email.id} generated for sequence ${seq.id}`);

          // In Queue einreihen (mit kleinem Delay für Staffelung)
          await supabase
            .from("outreach_send_queue")
            .insert({
              email_id: genData.email.id,
              scheduled_at: new Date(Date.now() + Math.random() * 60000).toISOString(), // 0-60 Sekunden Verzögerung
              priority: 0
            });

          generated++;

          // Nächsten Schritt berechnen
          const nextStepNum = seq.current_step + 1;
          const nextStep = steps.find((s: any) => s.step === nextStepNum);

          if (nextStep) {
            const nextDate = new Date();
            nextDate.setDate(nextDate.getDate() + (nextStep.day - currentStepConfig.day));

            await supabase
              .from("outreach_sequences")
              .update({
                current_step: nextStepNum,
                next_email_at: nextDate.toISOString()
              })
              .eq("id", seq.id);
            
            console.log(`Sequence ${seq.id} advanced to step ${nextStepNum}, next at ${nextDate.toISOString()}`);
          } else {
            // Keine weiteren Schritte
            await supabase
              .from("outreach_sequences")
              .update({ status: "completed" })
              .eq("id", seq.id);
            completed++;
            console.log(`Sequence ${seq.id} completed`);
          }
        }

        processed++;

      } catch (seqError: any) {
        console.error(`Error processing sequence ${seq.id}:`, seqError);
      }
    }

    console.log(`Sequence processing complete: ${processed} processed, ${generated} emails generated, ${completed} completed`);

    return new Response(
      JSON.stringify({ processed, generated, completed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Sequence processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
