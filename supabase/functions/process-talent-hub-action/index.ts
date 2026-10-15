import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TalentHubAction {
  action: "request_interview" | "move_candidate" | "reject_candidate" | "give_feedback" | "confirm_opt_in";
  submissionId: string;
  data?: {
    proposedSlots?: string[];
    message?: string;
    newStage?: string;
    rejectionReason?: string;
    rejectionCategory?: string;
    feedbackRating?: "positive" | "neutral" | "negative";
    feedbackNote?: string;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { action, submissionId, data }: TalentHubAction = await req.json();
    console.log(`Processing action: ${action} for submission: ${submissionId}`);

    // Get submission with related data
    const { data: submission, error: submissionError } = await supabase
      .from("submissions")
      .select(`
        *,
        candidate:candidates(*),
        job:jobs(*, client:profiles!jobs_client_id_fkey(*))
      `)
      .eq("id", submissionId)
      .single();

    if (submissionError || !submission) {
      throw new Error(`Submission not found: ${submissionError?.message}`);
    }

    let result: any = { success: true };

    switch (action) {
      case "request_interview": {
        // Create interview with pending_opt_in status
        const { data: interview, error: interviewError } = await supabase
          .from("interviews")
          .insert({
            submission_id: submissionId,
            job_id: submission.job_id,
            candidate_id: submission.candidate_id,
            status: "pending_opt_in",
            pending_opt_in: true,
            proposed_slots: data?.proposedSlots || [],
            client_notes: data?.message || "",
            created_by: user.id,
          })
          .select()
          .single();

        if (interviewError) {
          throw new Error(`Failed to create interview: ${interviewError.message}`);
        }

        // Create notification for recruiter
        await supabase.from("notifications").insert({
          user_id: submission.recruiter_id,
          type: "interview_request",
          title: "Interview-Anfrage von Kunde",
          message: `Ein Kunde möchte ein Interview mit einem Ihrer Kandidaten für "${submission.job?.title}" führen.`,
          metadata: {
            submission_id: submissionId,
            interview_id: interview.id,
            job_id: submission.job_id,
          },
        });

        // Send email to recruiter
        await sendEmail(supabase, {
          to: submission.recruiter_id,
          template: "interview_request_to_recruiter",
          data: {
            jobTitle: submission.job?.title,
            companyName: submission.job?.client?.company_name || "Unternehmen",
            candidateAnonymId: `Kandidat #${submission.id.slice(0, 8).toUpperCase()}`,
            proposedSlots: data?.proposedSlots,
            message: data?.message,
            interviewId: interview.id,
          },
        });

        // Log activity
        await supabase.from("activity_logs").insert({
          action: "interview_requested",
          entity_type: "interview",
          entity_id: interview.id,
          user_id: user.id,
          details: {
            submission_id: submissionId,
            proposed_slots: data?.proposedSlots,
          },
        });

        result = { ...result, interviewId: interview.id };
        break;
      }

      case "confirm_opt_in": {
        // Das Opt-In gibt nur der Kandidat selbst (Klick in der Einladung,
        // interview-service). Früher setzte diese Aktion identity_revealed und
        // gab damit Name und Kontakt frei — ohne Einwilligung (14.10.2026).
        throw new Error("Das Opt-In kann nur der Kandidat selbst geben (Klick in der Einladung).");
      }

      case "move_candidate": {
        const newStage = data?.newStage || getNextStage(submission.stage);
        // Stufen ab dem Opt-In geben über trg_sync_identity_unlock die Identität
        // frei. Ohne Einwilligung des Kandidaten nicht dorthin verschieben.
        if (!submission.identity_unlocked && OPTED_IN_STAGES.includes(newStage)) {
          throw new Error("Das Opt-In kann nur der Kandidat selbst geben (Klick in der Einladung).");
        }
        
        // Update submission stage
        await supabase
          .from("submissions")
          .update({
            stage: newStage,
            updated_at: new Date().toISOString(),
          })
          .eq("id", submissionId);

        // Create notification for recruiter
        await supabase.from("notifications").insert({
          user_id: submission.recruiter_id,
          type: "candidate_moved",
          title: "Kandidat weitergeleitet",
          message: `Ihr Kandidat wurde zu "${getStageLabel(newStage)}" für "${submission.job?.title}" verschoben.`,
          metadata: {
            submission_id: submissionId,
            old_stage: submission.stage,
            new_stage: newStage,
          },
        });

        // Send email to recruiter
        await sendEmail(supabase, {
          to: submission.recruiter_id,
          template: "candidate_moved_to_recruiter",
          data: {
            candidateName: submission.candidate?.full_name,
            jobTitle: submission.job?.title,
            companyName: submission.job?.client?.company_name,
            oldStage: getStageLabel(submission.stage),
            newStage: getStageLabel(newStage),
          },
        });

        // Log activity
        await supabase.from("activity_logs").insert({
          action: "candidate_moved",
          entity_type: "submission",
          entity_id: submissionId,
          user_id: user.id,
          details: {
            old_stage: submission.stage,
            new_stage: newStage,
          },
        });

        // Handle special stages
        if (newStage === "offer") {
          await supabase.from("offers").insert({
            submission_id: submissionId,
            job_id: submission.job_id,
            candidate_id: submission.candidate_id,
            status: "draft",
            created_by: user.id,
          });
        }

        if (newStage === "hired") {
          await supabase.from("placements").insert({
            submission_id: submissionId,
            job_id: submission.job_id,
            candidate_id: submission.candidate_id,
            recruiter_id: submission.recruiter_id,
            client_id: submission.job?.client_id,
            status: "pending",
            placement_date: new Date().toISOString(),
          });
        }

        result = { ...result, newStage };
        break;
      }

      case "reject_candidate": {
        // Update submission status
        await supabase
          .from("submissions")
          .update({
            status: "rejected",
            rejection_reason: data?.rejectionReason,
            rejection_category: data?.rejectionCategory,
            rejected_at: new Date().toISOString(),
            rejected_by: user.id,
          })
          .eq("id", submissionId);

        // Create notification for recruiter
        await supabase.from("notifications").insert({
          user_id: submission.recruiter_id,
          type: "candidate_rejected",
          title: "Kandidat abgelehnt",
          message: `Leider wurde Ihr Kandidat für "${submission.job?.title}" abgelehnt.`,
          metadata: {
            submission_id: submissionId,
            rejection_reason: data?.rejectionReason,
            rejection_category: data?.rejectionCategory,
          },
        });

        // Send email to recruiter
        await sendEmail(supabase, {
          to: submission.recruiter_id,
          template: "candidate_rejected_to_recruiter",
          data: {
            candidateName: submission.candidate?.full_name,
            jobTitle: submission.job?.title,
            companyName: submission.job?.client?.company_name,
            rejectionReason: data?.rejectionReason,
            rejectionCategory: data?.rejectionCategory,
          },
        });

        // Log activity
        await supabase.from("activity_logs").insert({
          action: "candidate_rejected",
          entity_type: "submission",
          entity_id: submissionId,
          user_id: user.id,
          details: {
            rejection_reason: data?.rejectionReason,
            rejection_category: data?.rejectionCategory,
          },
        });

        result = { ...result, rejected: true };
        break;
      }

      case "give_feedback": {
        // Find the latest interview for this submission
        const { data: interview } = await supabase
          .from("interviews")
          .select("*")
          .eq("submission_id", submissionId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (interview) {
          // Update interview with feedback
          await supabase
            .from("interviews")
            .update({
              status: "completed",
              client_feedback: data?.feedbackRating,
              client_feedback_notes: data?.feedbackNote,
              completed_at: new Date().toISOString(),
            })
            .eq("id", interview.id);
        }

        // Handle based on feedback rating
        if (data?.feedbackRating === "positive") {
          // Move to next stage
          const newStage = getNextStage(submission.stage);
          await supabase
            .from("submissions")
            .update({ stage: newStage })
            .eq("id", submissionId);

          result = { ...result, action: "moved", newStage };
        } else if (data?.feedbackRating === "negative") {
          // Prepare for rejection (but don't auto-reject, let client confirm)
          result = { ...result, action: "pending_rejection" };
        } else {
          // Neutral feedback - no automatic action
          result = { ...result, action: "noted" };
        }

        // Create notification for recruiter
        await supabase.from("notifications").insert({
          user_id: submission.recruiter_id,
          type: "interview_feedback",
          title: "Interview-Feedback erhalten",
          message: `Der Kunde hat Feedback zum Interview mit Ihrem Kandidaten gegeben.`,
          metadata: {
            submission_id: submissionId,
            interview_id: interview?.id,
            feedback_rating: data?.feedbackRating,
          },
        });

        // Log activity
        await supabase.from("activity_logs").insert({
          action: "feedback_given",
          entity_type: "interview",
          entity_id: interview?.id || submissionId,
          user_id: user.id,
          details: {
            rating: data?.feedbackRating,
            note: data?.feedbackNote,
          },
        });

        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Action ${action} completed successfully:`, result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing talent hub action:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

// Helper function to send emails
async function sendEmail(
  supabase: any,
  { to, template, data }: { to: string; template: string; data: Record<string, any> }
) {
  try {
    // Get user email from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", to)
      .single();

    if (!profile?.email) {
      console.warn(`No email found for user: ${to}`);
      return;
    }

    // Call send-email function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        to: profile.email,
        template,
        data,
      }),
    });

    console.log(`Email sent to ${profile.email} with template: ${template}`);
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

// Helper functions for stage management
// Wie in sync_identity_unlock_with_stage (Migration 20260710100000), dazu das
// alte Stufen-Vokabular dieser Function.
const OPTED_IN_STAGES = [
  "candidate_opted_in", "interview_scheduled", "second_interview", "offer", "hired", "placed", "interview",
];

function getNextStage(currentStage: string): string {
  const stageOrder = ["new", "screening", "interview", "offer", "hired"];
  const currentIndex = stageOrder.indexOf(currentStage);
  return currentIndex < stageOrder.length - 1
    ? stageOrder[currentIndex + 1]
    : currentStage;
}

function getStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    new: "Neu",
    screening: "Prüfung",
    interview: "Interview",
    offer: "Angebot",
    hired: "Eingestellt",
  };
  return labels[stage] || stage;
}

serve(handler);
