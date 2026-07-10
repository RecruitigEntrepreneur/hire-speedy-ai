import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Legacy-Route /interview/select/:token → leitet auf das eine Kandidaten-Portal
 * (/interview/respond/:token) um. Die Edge Function get-interview-by-token
 * akzeptiert sowohl response_token als auch die alten selection_token.
 */
export default function SelectSlot() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(token ? `/interview/respond/${token}` : '/', { replace: true });
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
