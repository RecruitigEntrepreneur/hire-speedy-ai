import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Bell, ChevronRight, Clock, Loader2 } from 'lucide-react';

interface Props {
  submissionId: string;
  jobTitle: string;
}

const waitLabel = (iso: string) => {
  const h = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000));
  if (h >= 48) return `seit ${Math.floor(h / 24)} Tagen`;
  if (h >= 1) return `seit ${h} Std`;
  return 'gerade eben';
};

/** Aktiver Status für "Interview angefragt": zeigt Wartezeit, erlaubt Erinnern
 *  und verlinkt zur Interview-Agenda — statt eines toten Text-Chips. */
export function PendingRequestStatus({ submissionId, jobTitle }: Props) {
  const [reminding, setReminding] = useState(false);

  const { data: request } = useQuery({
    queryKey: ['pending-interview-request', submissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interviews')
        .select('id, created_at, status')
        .eq('submission_id', submissionId)
        .in('status', ['pending_response', 'pending', 'counter_proposed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const remind = async () => {
    if (!request) return;
    setReminding(true);
    try {
      const { data: sub } = await supabase.from('submissions').select('recruiter_id').eq('id', submissionId).single();
      if (sub?.recruiter_id) {
        await supabase.from('notifications').insert({
          user_id: sub.recruiter_id,
          type: 'interview_reminder_requested',
          title: 'Kunde bittet um Erinnerung',
          message: `Der Kandidat hat auf die Interview-Anfrage für "${jobTitle}" ${waitLabel(request.created_at)} nicht geantwortet. Bitte nachfassen.`,
          related_type: 'interview',
          related_id: request.id,
        });
      }
      toast.success('Der Recruiter wurde gebeten, beim Kandidaten nachzufassen.');
    } catch (e) {
      console.error('Erinnern-Fehler:', e);
      toast.error('Erinnerung konnte nicht gesendet werden.');
    } finally {
      setReminding(false);
    }
  };

  const isCounter = request?.status === 'counter_proposed';
  const isStale = request && Date.now() - new Date(request.created_at).getTime() > 48 * 3_600_000;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md px-3 py-2 text-xs',
          isCounter ? 'bg-destructive/10 text-destructive' : 'bg-muted/50 text-muted-foreground',
        )}
      >
        <Clock className="h-3.5 w-3.5" />
        {isCounter
          ? 'Gegenvorschlag des Kandidaten — bitte antworten'
          : request
          ? (
            <>
              Interview angefragt — wartet{' '}
              <span className={cn(isStale && 'font-semibold text-amber-600')}>{waitLabel(request.created_at)}</span>
            </>
          )
          : 'Interview angefragt — Opt-In ausstehend'}
      </div>
      {request && !isCounter && (
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={remind} disabled={reminding}>
          {reminding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          Erinnern
        </Button>
      )}
      <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground">
        <Link to="/dashboard/interviews">
          Zur Agenda <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
