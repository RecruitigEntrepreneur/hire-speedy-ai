import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

interface UnlockLog {
  id: string;
  submission_id: string;
  action: string;
  performed_by: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export function useIdentityUnlock() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const requestOptIn = async (submissionId: string, jobIndustry: string) => {
    if (!user) return false;
    setLoading(true);

    try {
      // Update submission with opt-in request
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          opt_in_requested_at: new Date().toISOString(),
          opt_in_response: 'pending',
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      // Log the action
      await logUnlockAction(submissionId, 'opt_in_requested', {
        requested_by: user.id,
        job_industry: jobIndustry,
      });

      // Get recruiter info for notification
      const { data: submission } = await supabase
        .from('submissions')
        .select('recruiter_id, candidate_id')
        .eq('id', submissionId)
        .single();

      if (submission) {
        // Create notification for recruiter
        await supabase.from('notifications').insert({
          user_id: submission.recruiter_id,
          type: 'opt_in_request',
          title: 'Opt-In Anfrage',
          message: `Ein Unternehmen in der Branche "${jobIndustry}" möchte ein Interview mit Ihrem Kandidaten. Bitte bestätigen Sie mit dem Kandidaten.`,
          related_id: submissionId,
          related_type: 'submission',
        });
      }

      toast({ title: 'Opt-In Anfrage gesendet', description: 'Der Recruiter wurde benachrichtigt.' });
      return true;
    } catch (error) {
      console.error('Error requesting opt-in:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const respondToOptIn = async (submissionId: string, approved: boolean, reason?: string) => {
    if (!user) return false;
    setLoading(true);

    try {
      const updateData: Record<string, any> = {
        opt_in_response: approved ? 'approved' : 'denied',
      };

      if (approved) {
        updateData.identity_unlocked = true;
        updateData.unlocked_at = new Date().toISOString();
        updateData.unlocked_by = user.id;
      }

      const { error: updateError } = await supabase
        .from('submissions')
        .update(updateData)
        .eq('id', submissionId);

      if (updateError) throw updateError;

      // Log the action
      await logUnlockAction(submissionId, approved ? 'opt_in_approved' : 'opt_in_denied', {
        responded_by: user.id,
        reason: reason || null,
      });

      // Get client info for notification
      const { data: submission } = await supabase
        .from('submissions')
        .select('job_id, jobs(client_id)')
        .eq('id', submissionId)
        .single();

      if (submission?.jobs) {
        const jobData = submission.jobs as { client_id: string };
        // Create notification for client
        await supabase.from('notifications').insert({
          user_id: jobData.client_id,
          type: approved ? 'opt_in_approved' : 'opt_in_denied',
          title: approved ? 'Kandidat hat zugestimmt' : 'Kandidat hat abgelehnt',
          message: approved 
            ? 'Die Identität des Kandidaten wurde freigegeben. Sie können jetzt die vollständigen Daten sehen.'
            : 'Der Kandidat hat die Freigabe seiner Identität abgelehnt.',
          related_id: submissionId,
          related_type: 'submission',
        });
      }

      toast({ 
        title: approved ? 'Identität freigegeben' : 'Anfrage abgelehnt',
        description: approved ? 'Der Kunde kann jetzt die Kandidatendaten sehen.' : 'Der Kunde wurde informiert.'
      });
      return true;
    } catch (error) {
      console.error('Error responding to opt-in:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const adminOverride = async (submissionId: string, reason: string) => {
    if (!user) return false;
    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('submissions')
        .update({
          identity_unlocked: true,
          unlocked_at: new Date().toISOString(),
          unlocked_by: user.id,
          opt_in_response: 'admin_override',
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      // Log the action
      await logUnlockAction(submissionId, 'admin_override', {
        admin_id: user.id,
        reason,
      });

      toast({ title: 'Admin Override', description: 'Identität wurde manuell freigegeben.' });
      return true;
    } catch (error) {
      console.error('Error with admin override:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logUnlockAction = async (
    submissionId: string, 
    action: string, 
    details: Record<string, any>
  ) => {
    try {
      await supabase.from('identity_unlock_logs').insert({
        submission_id: submissionId,
        action,
        performed_by: user?.id,
        details,
      });
    } catch (error) {
      console.error('Error logging unlock action:', error);
    }
  };

  const fetchUnlockLogs = async (submissionId: string): Promise<UnlockLog[]> => {
    try {
      const { data, error } = await supabase
        .from('identity_unlock_logs')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as UnlockLog[];
    } catch (error) {
      console.error('Error fetching unlock logs:', error);
      return [];
    }
  };

  return {
    loading,
    requestOptIn,
    respondToOptIn,
    adminOverride,
    fetchUnlockLogs,
  };
}
