import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useFeedbackEnabled } from '@/lib/feedback/api';
import { guestTokenFromPath } from '@/lib/feedback/pageContext';
import { FeedbackWidget } from './FeedbackWidget';

/**
 * Feedback-Lasche auf den Aufnahme-Links (/start/:token, /aufnahme/:draftToken).
 *
 * Läuft im schlanken IntakeApp-Bundle ohne AuthProvider. Ein angemeldeter
 * Admin (Marko beim Testen) sieht die Lasche auch, solange sie für alle aus
 * ist — die Edge Function erkennt ihn dann an seiner Sitzung, nicht am Token.
 */
export function GuestFeedback() {
  const { pathname } = useLocation();
  const { data: enabled = false } = useFeedbackEnabled();
  const { data: isAdmin = false } = useQuery({
    queryKey: ['feedback-admin-session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) return false;
      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin');
      return (roles?.length ?? 0) > 0;
    },
    staleTime: 10 * 60_000,
  });

  const token = guestTokenFromPath(pathname);
  if (!token || (!enabled && !isAdmin)) return null;

  return (
    <FeedbackWidget
      du={isAdmin}
      guestToken={isAdmin ? null : token}
      canNotify={isAdmin}
      adminOnlyHint={isAdmin && !enabled}
    />
  );
}
