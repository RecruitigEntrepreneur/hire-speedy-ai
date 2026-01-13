import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TalentHubActionType = 
  | 'request_interview' 
  | 'move_candidate' 
  | 'reject_candidate' 
  | 'give_feedback' 
  | 'confirm_opt_in';

interface ActionData {
  proposedSlots?: string[];
  message?: string;
  newStage?: string;
  rejectionReason?: string;
  rejectionCategory?: string;
  feedbackRating?: 'positive' | 'neutral' | 'negative';
  feedbackNote?: string;
}

interface ActionResult {
  success: boolean;
  interviewId?: string;
  newStage?: string;
  rejected?: boolean;
  revealed?: boolean;
  action?: string;
  error?: string;
}

export function useTalentHubActions() {
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const { toast } = useToast();

  const executeAction = useCallback(async (
    action: TalentHubActionType,
    submissionId: string,
    data?: ActionData
  ): Promise<ActionResult> => {
    setLoading(true);
    setActionInProgress(action);

    try {
      const { data: result, error } = await supabase.functions.invoke('process-talent-hub-action', {
        body: { action, submissionId, data },
      });

      if (error) {
        throw new Error(error.message);
      }

      // Show success toast based on action
      const toastMessages: Record<TalentHubActionType, { title: string; description: string }> = {
        request_interview: {
          title: 'Interview angefragt',
          description: 'Der Recruiter wird den Kandidaten kontaktieren.',
        },
        move_candidate: {
          title: 'Kandidat verschoben',
          description: `Kandidat wurde zu "${getStageLabel(result.newStage || data?.newStage || '')}" verschoben.`,
        },
        reject_candidate: {
          title: 'Kandidat abgelehnt',
          description: 'Der Recruiter wurde über die Entscheidung informiert.',
        },
        give_feedback: {
          title: 'Feedback gespeichert',
          description: getFeedbackDescription(data?.feedbackRating),
        },
        confirm_opt_in: {
          title: 'Zustimmung bestätigt',
          description: 'Die Kandidaten-Details sind jetzt verfügbar.',
        },
      };

      toast(toastMessages[action]);

      return { success: true, ...result };
    } catch (error) {
      console.error(`Action ${action} failed:`, error);
      toast({
        title: 'Fehler',
        description: error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten',
        variant: 'destructive',
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      setLoading(false);
      setActionInProgress(null);
    }
  }, [toast]);

  const requestInterview = useCallback(async (
    submissionId: string,
    proposedSlots: string[],
    message?: string
  ) => {
    return executeAction('request_interview', submissionId, { proposedSlots, message });
  }, [executeAction]);

  const moveCandidate = useCallback(async (
    submissionId: string,
    newStage?: string
  ) => {
    return executeAction('move_candidate', submissionId, { newStage });
  }, [executeAction]);

  const rejectCandidate = useCallback(async (
    submissionId: string,
    rejectionReason: string,
    rejectionCategory?: string
  ) => {
    return executeAction('reject_candidate', submissionId, { rejectionReason, rejectionCategory });
  }, [executeAction]);

  const giveFeedback = useCallback(async (
    submissionId: string,
    feedbackRating: 'positive' | 'neutral' | 'negative',
    feedbackNote?: string
  ) => {
    return executeAction('give_feedback', submissionId, { feedbackRating, feedbackNote });
  }, [executeAction]);

  const confirmOptIn = useCallback(async (submissionId: string) => {
    return executeAction('confirm_opt_in', submissionId);
  }, [executeAction]);

  return {
    loading,
    actionInProgress,
    executeAction,
    requestInterview,
    moveCandidate,
    rejectCandidate,
    giveFeedback,
    confirmOptIn,
  };
}

// Helper functions
function getStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    new: 'Neu',
    screening: 'Prüfung',
    interview: 'Interview',
    offer: 'Angebot',
    hired: 'Eingestellt',
  };
  return labels[stage] || stage;
}

function getFeedbackDescription(rating?: string): string {
  switch (rating) {
    case 'positive':
      return 'Kandidat wurde automatisch zur nächsten Phase verschoben.';
    case 'negative':
      return 'Sie können den Kandidaten jetzt ablehnen.';
    default:
      return 'Das Feedback wurde für den Recruiter gespeichert.';
  }
}
