import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AutomationEvent {
  type: string;
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const event: AutomationEvent = await req.json();
    console.log("Automation event received:", event.type, event.table);

    switch (event.table) {
      case "submissions":
        await handleSubmissionEvent(supabase, event);
        break;
      case "placements":
        await handlePlacementEvent(supabase, event);
        break;
      case "payout_requests":
        await handlePayoutEvent(supabase, event);
        break;
      case "interviews":
        await handleInterviewEvent(supabase, event);
        break;
      default:
        console.log("Unhandled table:", event.table);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("Automation hub error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

// deno-lint-ignore no-explicit-any
async function handleSubmissionEvent(supabase: any, event: AutomationEvent) {
  const record = event.record;
  const oldRecord = event.old_record;

  if (event.type === "INSERT") {
    const { data: job } = await supabase
      .from("jobs")
      .select("title, company_name, client_id")
      .eq("id", record.job_id)
      .single();

    if (job) {
      await createNotification(supabase, {
        user_id: job.client_id,
        type: "new_submission",
        title: "Neuer Kandidat eingereicht",
        message: `Ein neuer Kandidat wurde für ${job.title} eingereicht.`,
        related_type: "submission",
        related_id: record.id as string,
      });
    }
  }

  if (event.type === "UPDATE" && oldRecord?.status !== record.status) {
    const { data: submission } = await supabase
      .from("submissions")
      .select("recruiter_id")
      .eq("id", record.id)
      .single();

    if (submission) {
      await createNotification(supabase, {
        user_id: submission.recruiter_id,
        type: "submission_status",
        title: `Status Update: ${record.status}`,
        message: `Der Status wurde auf "${record.status}" geändert.`,
        related_type: "submission",
        related_id: record.id as string,
      });
    }
  }
}

// deno-lint-ignore no-explicit-any
async function handlePlacementEvent(supabase: any, event: AutomationEvent) {
  if (event.type === "INSERT") {
    const { data: placement } = await supabase
      .from("placements")
      .select("submission_id")
      .eq("id", event.record.id)
      .single();

    if (placement) {
      const { data: submission } = await supabase
        .from("submissions")
        .select("recruiter_id, job_id")
        .eq("id", placement.submission_id)
        .single();

      if (submission) {
        await createNotification(supabase, {
          user_id: submission.recruiter_id,
          type: "placement_confirmed",
          title: "Placement bestätigt!",
          message: "Ein Kandidat wurde erfolgreich platziert.",
          related_type: "placement",
          related_id: event.record.id as string,
        });
      }
    }
  }
}

// deno-lint-ignore no-explicit-any
async function handlePayoutEvent(supabase: any, event: AutomationEvent) {
  if (event.type === "UPDATE" && event.record.status === "completed") {
    await createNotification(supabase, {
      user_id: event.record.recruiter_id as string,
      type: "payout_completed",
      title: "Auszahlung abgeschlossen",
      message: `Ihre Auszahlung über €${Number(event.record.amount).toLocaleString("de-DE")} wurde verarbeitet.`,
      related_type: "payout",
      related_id: event.record.id as string,
    });
  }
}

// deno-lint-ignore no-explicit-any
async function handleInterviewEvent(supabase: any, event: AutomationEvent) {
  if (event.type === "INSERT" && event.record.scheduled_at) {
    const { data: interview } = await supabase
      .from("interviews")
      .select("submission_id")
      .eq("id", event.record.id)
      .single();

    if (interview) {
      const { data: submission } = await supabase
        .from("submissions")
        .select("recruiter_id")
        .eq("id", interview.submission_id)
        .single();

      if (submission) {
        await createNotification(supabase, {
          user_id: submission.recruiter_id,
          type: "interview_scheduled",
          title: "Interview geplant",
          message: "Ein Interview wurde geplant.",
          related_type: "interview",
          related_id: event.record.id as string,
        });
      }
    }
  }
}

// deno-lint-ignore no-explicit-any
async function createNotification(supabase: any, notification: {
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_type?: string;
  related_id?: string;
}) {
  const { error } = await supabase.from("notifications").insert(notification);
  if (error) console.error("Notification create error:", error);
}

serve(handler);
