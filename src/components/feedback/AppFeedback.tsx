import { useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useFeedbackEnabled } from '@/lib/feedback/api';
import { guestTokenFromPath } from '@/lib/feedback/pageContext';
import { FeedbackWidget } from './FeedbackWidget';

const APP_AREA = /^\/(dashboard|recruiter|admin)(\/|$)/;

/**
 * Feedback-Lasche in der Hauptanwendung: Dashboard (Kunde), Recruiter, Admin
 * und die Aufnahme-Links, falls sie innerhalb der App geöffnet werden.
 * Admins sehen sie immer, alle anderen nur, wenn der Schalter an ist.
 */
export function AppFeedback() {
  const { user, role } = useAuth();
  const { pathname } = useLocation();
  const { data: enabled = false } = useFeedbackEnabled();

  const guestToken = guestTokenFromPath(pathname);
  const inApp = APP_AREA.test(pathname);
  if (!inApp && !guestToken) return null;
  if (inApp && (!user || !role)) return null;

  const isAdmin = role === 'admin';
  if (!enabled && !isAdmin) return null;

  return (
    <FeedbackWidget
      du={role === 'recruiter' || isAdmin}
      guestToken={user ? null : guestToken}
      canNotify={!!user}
      adminOnlyHint={isAdmin && !enabled}
    />
  );
}
