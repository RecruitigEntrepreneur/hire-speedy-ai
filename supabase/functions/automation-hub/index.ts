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

// Stage hierarchy for auto-pipeline
const STAGE_PRIORITY: Record<string, number> = {
  new: 0,
  contacted: 1,
  interview: 2,
  offer: 3,
  placed: 4,
};

// deno-lint-ignore no-explicit-any
async function syncCandidateStatus(supabase: any, candidateId: string) {
  // Get all submissions for this candidate
  const { data: submissions, error } = await supabase
    .from("submissions")
    .select("status, candidate_id")
    .eq("candidate_id", candidateId);

  if (error) {
    console.error("syncCandidateStatus: fetch submissions error:", error);
    return;
  }

  if (!submissions || submissions.length === 0) return;

  // Check if there are any active (non-terminal) submissions
  const terminalStatuses = ["rejected", "withdrawn", "expired", "client_rejected"];
  const activeSubmissions = submissions.filter(
    (s: { status: string }) => !terminalStatuses.includes(s.status)
  );

  // If all submissions are rejected/withdrawn, set candidate to rejected
  if (activeSubmissions.length === 0) {
    await supabase
      .from("candidates")
      .update({ candidate_status: "rejected" })
      .eq("id", candidateId);
    return;
  }

  // Map submission statuses to candidate stages
  let highestStage = "contacted"; // Any submission means at least contacted
  let highestPriority = STAGE_PRIORITY["contacted"];

  for (const sub of activeSubmissions) {
    let mappedStage = "contacted";
    const s = sub.status as string;

    if (s === "hired") {
      mappedStage = "placed";
    } else if (s === "offer") {
      mappedStage = "offer";
    } else if (
      s === "interview" ||
      s === "interview_1" ||
      s === "interview_2" ||
      s === "interview_scheduled"
    ) {
      mappedStage = "interview";
    } else {
      // submitted, accepted, in_review, etc. -> contacted
      mappedStage = "contacted";
    }

    const priority = STAGE_PRIORITY[mappedStage] ?? 0;
    if (priority > highestPriority) {
      highestPriority = priority;
      highestStage = mappedStage;
    }
  }

  // Only update if new stage is higher than current
  const { data: candidate } = await supabase
    .from("candidates")
    .select("candidate_status")
    .eq("id", candidateId)
    .single();

  if (candidate) {
    const currentPriority = STAGE_PRIORITY[candidate.candidate_status] ?? 0;
    if (highestPriority > currentPriority) {
      await supabase
        .from("candidates")
        .update({ candidate_status: highestStage })
        .eq("id", candidateId);
      console.log(
        `Auto-pipeline: candidate ${candidateId} -> ${highestStage}`
      );
    }
  }
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
      case "offers":
        await handleOfferEvent(supabase, event);
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

    // Auto-pipeline: submission created -> at least "contacted"
    if (record.candidate_id) {
      await syncCandidateStatus(supabase, record.candidate_id as string);
    }
  }

  if (event.type === "UPDATE" && oldRecord?.status !== record.status) {
    const { data: submission } = await supabase
      .from("submissions")
      .select("recruiter_id, candidate_id")
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

      // Auto-pipeline: sync on any status change
      await syncCandidateStatus(supabase, submission.candidate_id as string);
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
        .select("recruiter_id, job_id, candidate_id")
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

        // Auto-pipeline: placement -> "placed"
        await syncCandidateStatus(supabase, submission.candidate_id as string);
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
  if (event.type === "INSERT") {
    const { data: interview } = await supabase
      .from("interviews")
      .select("submission_id")
      .eq("id", event.record.id)
      .single();

    if (interview) {
      const { data: submission } = await supabase
        .from("submissions")
        .select("recruiter_id, candidate_id, job_id")
        .eq("id", interview.submission_id)
        .single();

      if (submission) {
        // Auto-pipeline: interview -> "interview"
        await syncCandidateStatus(supabase, submission.candidate_id as string);

        if (event.record.scheduled_at) {
          const { data: candidate } = await supabase
            .from("candidates")
            .select("full_name")
            .eq("id", submission.candidate_id)
            .single();

          const { data: job } = await supabase
            .from("jobs")
            .select("title, client_id")
            .eq("id", submission.job_id)
            .single();

          const scheduledAt = new Date(event.record.scheduled_at as string);
          const formattedDate = scheduledAt.toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          });
          const formattedTime = scheduledAt.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
          });

          await createNotification(supabase, {
            user_id: submission.recruiter_id,
            type: "interview_scheduled",
            title: "Interview geplant",
            message: `Interview mit ${candidate?.full_name || "Kandidat"} am ${formattedDate} um ${formattedTime}`,
            related_type: "interview",
            related_id: event.record.id as string,
          });

          if (job?.client_id) {
            await createNotification(supabase, {
              user_id: job.client_id,
              type: "interview_scheduled",
              title: "Interview geplant",
              message: `Interview für ${job.title} mit ${candidate?.full_name || "Kandidat"} am ${formattedDate} um ${formattedTime}`,
              related_type: "interview",
              related_id: event.record.id as string,
            });
          }
        }
      }
    }
  }
}

// deno-lint-ignore no-explicit-any
async function handleOfferEvent(supabase: any, event: AutomationEvent) {
  if (event.type === "INSERT") {
    const { data: offer } = await supabase
      .from("offers")
      .select("submission_id")
      .eq("id", event.record.id)
      .single();

    if (offer) {
      const { data: submission } = await supabase
        .from("submissions")
        .select("candidate_id")
        .eq("id", offer.submission_id)
        .single();

      if (submission) {
        // Auto-pipeline: offer -> "offer"
        await syncCandidateStatus(supabase, submission.candidate_id as string);
      }
    }
  }
}

// deno-lint-ignore no-explicit-any
async function createNotification(
  supabase: any,
  notification: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    related_type?: string;
    related_id?: string;
  }
) {
  const { error } = await supabase.from("notifications").insert(notification);
  if (error) console.error("Notification create error:", error);
}

serve(handler);
