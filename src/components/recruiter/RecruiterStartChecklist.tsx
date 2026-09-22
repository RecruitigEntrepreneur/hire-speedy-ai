import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRecruiterGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { tourSeen } from '@/lib/recruiterGuide';
import { START_HIDDEN_KEY, openSummary, startPercent, startSteps, type StartProfile, type StartStepId } from '@/lib/recruiterStart';

const browserStorage = () => { try { return window.localStorage; } catch { return null; } };
const ACTION: Record<StartStepId, string> = { contract: '', tour: 'Rundgang starten', company: 'Firmendaten ergänzen', bank: 'Bankverbindung eintragen' };

/** „Dein Start bei Matchunt“: was nach der Freischaltung noch fehlt, mit direktem Weg dorthin. */
export function RecruiterStartChecklist() {
  const { user } = useAuth();
  const guide = useRecruiterGuide();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StartProfile | null>(null);
  const [hidden, setHidden] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void supabase.from('profiles').select('company_name,company_address,tax_id,bank_iban').eq('user_id', userId).maybeSingle()
      .then(({ data, error }) => {
        if (error) console.warn('[start] Profil nicht geladen', error.message);
        if (active) setProfile(data ?? {});
      });
    return () => { active = false; };
  }, [userId]);

  if (!user || !profile) return null;
  const steps = startSteps(profile, tourSeen(user, browserStorage()));
  const next = steps.find(s => !s.done);
  const act = (id: StartStepId) => {
    if (id === 'tour') guide.start();
    else navigate(`/recruiter/profile/abrechnung#${id === 'bank' ? 'bankverbindung' : 'firmendaten'}`);
  };

  if (!next) {
    if (hidden || user.user_metadata?.[START_HIDDEN_KEY]) return null;
    const hide = () => {
      setHidden(true);
      void supabase.auth.updateUser({ data: { [START_HIDDEN_KEY]: new Date().toISOString() } }).then(({ error }) => {
        if (error) console.warn('[start] Ausblenden nicht gespeichert', error.message);
      });
    };
    return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/30 px-4 py-2.5 text-sm">
      <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success"/>Dein Start ist abgeschlossen · 100 %</span>
      <button type="button" onClick={hide} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">Ausblenden</button>
    </div>;
  }

  const done = steps.filter(s => s.done).length;
  return <Card className="border-border/30 shadow-sm">
    <CardContent className="space-y-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Dein Start bei Matchunt</h2>
        <span className="text-sm text-muted-foreground">{done} von {steps.length} erledigt</span>
      </div>
      <Progress value={startPercent(steps)} className="h-1.5" aria-label={`${startPercent(steps)} Prozent erledigt`}/>
      <div className="flex flex-wrap gap-2">
        {steps.map(s => s.done
          ? <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs text-success"><Check className="h-3 w-3"/>{s.label}</span>
          : <button key={s.id} type="button" onClick={() => act(s.id)} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground hover:bg-muted"><Circle className="h-3 w-3"/>{s.label}</button>)}
      </div>
      <p className="text-sm text-muted-foreground">{openSummary(steps)}</p>
      <Button size="sm" onClick={() => act(next.id)}>{ACTION[next.id]}<ArrowRight className="ml-1 h-4 w-4"/></Button>
    </CardContent>
  </Card>;
}
