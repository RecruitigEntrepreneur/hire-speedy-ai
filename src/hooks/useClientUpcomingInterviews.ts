import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface UpcomingInterview {
  id: string;
  scheduledAt: string;
  anonId: string;
  meetingFormat: string | null;
  joinUrl: string | null;
  status: string;
}

/**
 * Anstehende (bestätigte, zukünftige) Interviews des eingeloggten Clients.
 * RLS ("Users can view relevant interviews") beschränkt die `interviews`-Query
 * auf Interviews der eigenen Jobs des Clients. Es werden bewusst KEINE
 * Kandidatenfelder geladen (Triple-Blind) – nur ein anonymer Code aus der
 * submission_id. Join-Link-Priorität: Teams → Google Meet → generischer Link.
 */
export function useClientUpcomingInterviews() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-upcoming-interviews', user?.id],
    queryFn: async (): Promise<UpcomingInterview[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('interviews')
        .select('id, submission_id, scheduled_at, status, meeting_format, meeting_link, teams_join_url, google_meet_link')
        .eq('status', 'scheduled')
        .gte('scheduled_at', nowIso)
        .order('scheduled_at', { ascending: true })
        .limit(5);

      if (error) {
        console.error('Error fetching upcoming interviews:', error);
        throw error;
      }

      return (data || []).map((r: any) => ({
        id: r.id,
        scheduledAt: r.scheduled_at,
        anonId: `PR-${String(r.submission_id || '').slice(0, 6).toUpperCase()}`,
        meetingFormat: r.meeting_format ?? null,
        joinUrl: r.teams_join_url ?? r.google_meet_link ?? r.meeting_link ?? null,
        status: r.status,
      }));
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
