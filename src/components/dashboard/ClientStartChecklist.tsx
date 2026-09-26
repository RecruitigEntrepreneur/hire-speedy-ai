import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, CheckCircle2, Circle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { clientTourSeen } from '@/lib/clientGuide';
import { ladeFirmendaten } from '@/lib/firmendaten';
import {
  CLIENT_START_HIDDEN_KEY, clientStartDone, clientStartSteps, currentFramework,
  type ClientStep, type ClientStepId, type StartFramework, type StartJob,
} from '@/lib/clientStart';

const browserStorage = () => { try { return window.localStorage; } catch { return null; } };

/** Was für die Rechnung an Firmendaten fehlt -- dieselbe Regel wie firmendatenVollstaendig. */
const PFLICHT: [keyof Awaited<ReturnType<typeof ladeFirmendaten>>['firma'], string][] = [
  ['legal_name', 'Firmierung'], ['street', 'Straße'], ['postal_code', 'PLZ'], ['city', 'Ort'],
];

const ICON: Record<ClientStep['state'], JSX.Element> = {
  done: <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"><Check className="h-3 w-3" /></span>,
  waiting: <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning"><Clock className="h-3 w-3" /></span>,
  open: <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground"><Circle className="h-2.5 w-2.5" /></span>,
};

/**
 * „Ihr Start bei Matchunt“ (lib/clientStart.ts): Vertrag, erste Position,
 * Firmendaten, Rundgang -- aus echten Daten, mit direktem Weg zum nächsten
 * Schritt. Bei 4 von 4 eine schmale Zeile zum Ausblenden.
 */
export function ClientStartChecklist({ onTour }: { onTour: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(false);

  const { data } = useQuery({
    queryKey: ['client-start', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [rv, jobs, firma] = await Promise.all([
        supabase.from('client_framework_agreements').select('agreement_number,status,countersigned_at'),
        supabase.from('jobs').select('title,status').eq('client_id', user!.id),
        ladeFirmendaten(user!.id),
      ]);
      if (rv.error) console.warn('[start] Rahmenvertrag nicht geladen', rv.error.message);
      if (jobs.error) console.warn('[start] Stellen nicht geladen', jobs.error.message);
      return {
        framework: currentFramework((rv.data ?? []) as StartFramework[]),
        jobs: (jobs.data ?? []) as StartJob[],
        missingCompany: PFLICHT.filter(([key]) => !firma.firma[key]).map(([, label]) => label),
      };
    },
  });

  if (!user || !data) return null;
  const steps = clientStartSteps({ ...data, tourDone: clientTourSeen(user, browserStorage()) });
  const done = clientStartDone(steps);

  const act = (id: ClientStepId) => {
    if (id === 'tour') onTour();
    else if (id === 'position') navigate('/dashboard/aufnahme');
    else if (id === 'company') navigate('/dashboard/settings#firmendaten');
  };

  if (done === steps.length) {
    if (hidden || user.user_metadata?.[CLIENT_START_HIDDEN_KEY]) return null;
    const hide = () => {
      setHidden(true);
      void supabase.auth.updateUser({ data: { [CLIENT_START_HIDDEN_KEY]: new Date().toISOString() } }).then(({ error }) => {
        if (error) console.warn('[start] Ausblenden nicht gespeichert', error.message);
      });
    };
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/30 px-4 py-2.5 text-sm">
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" />Alles eingerichtet</span>
        <button type="button" onClick={hide} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Ausblenden</button>
      </div>
    );
  }

  return (
    <Card className="border-border/30 shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Ihr Start bei Matchunt</h2>
          <span className="text-sm text-muted-foreground">{done} von {steps.length}</span>
        </div>
        <Progress value={Math.round((done / steps.length) * 100)} className="h-1.5" aria-label={`${done} von ${steps.length} erledigt`} />
        <ul className="divide-y divide-border/40">
          {steps.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-2.5">
              {ICON[s.state]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
              {s.action && (
                <button type="button" onClick={() => act(s.id)}
                  className="shrink-0 text-xs text-foreground underline underline-offset-2 hover:text-primary">
                  {s.action}
                </button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
