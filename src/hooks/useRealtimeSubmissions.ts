import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface Submission {
  id: string;
  job_id: string;
  candidate_id: string;
  recruiter_id: string;
  status: string;
  stage: string;
  match_score: number | null;
  recruiter_notes: string | null;
  client_notes: string | null;
  submitted_at: string;
  updated_at: string;
}

export function useRealtimeSubmissions(jobId?: string) {
  const { user, role } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    if (!user) return;

    let query = supabase.from("submissions").select("*");

    if (role === "recruiter") {
      query = query.eq("recruiter_id", user.id);
    } else if (role === "client" && jobId) {
      query = query.eq("job_id", jobId);
    } else if (role === "client") {
      // Get all submissions for client's jobs
      const { data: jobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("client_id", user.id);
      
      if (jobs?.length) {
        query = query.in("job_id", jobs.map((j) => j.id));
      }
    }

    const { data, error } = await query.order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching submissions:", error);
      return;
    }

    setSubmissions(data || []);
    setLoading(false);
  }, [user, role, jobId]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    fetchSubmissions();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`submissions-${jobId || "all"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "submissions",
          filter: jobId ? `job_id=eq.${jobId}` : undefined,
        },
        (payload) => {
          const newSubmission = payload.new as Submission;
          
          // Check if relevant to current user
          const isRelevant = 
            (role === "recruiter" && newSubmission.recruiter_id === user.id) ||
            (role === "client");

          if (isRelevant) {
            setSubmissions((prev) => [newSubmission, ...prev]);
            toast.success("Neue Einreichung", {
              description: "Ein neuer Kandidat wurde eingereicht.",
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "submissions",
          filter: jobId ? `job_id=eq.${jobId}` : undefined,
        },
        (payload) => {
          const updatedSubmission = payload.new as Submission;
          const oldSubmission = payload.old as Submission;
          
          setSubmissions((prev) =>
            prev.map((s) => (s.id === updatedSubmission.id ? updatedSubmission : s))
          );

          // Notify on status change
          if (oldSubmission.status !== updatedSubmission.status) {
            toast.info("Status Update", {
              description: `Status wurde auf "${updatedSubmission.status}" geändert.`,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, role, jobId, fetchSubmissions]);

  return {
    submissions,
    loading,
    refetch: fetchSubmissions,
  };
}
