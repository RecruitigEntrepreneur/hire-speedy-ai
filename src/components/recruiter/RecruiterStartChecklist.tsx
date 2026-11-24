import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useRecruiterGuide } from '@/components/recruiter/guide/RecruiterGuide';
import { useRecruiterPending } from '@/components/verification/RecruiterAccessGate';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { tourSeen } from '@/lib/recruiterGuide';
import { START_HIDDEN_KEY, startPercent, startSteps, type StartProfile, type StartStepId } from '@/lib/recruiterStart';

const browserStorage = () => { try { return window.localStorage; } catch { return null; } };

/** „Dein Start bei Matchunt“: was nach der Freischaltung noch fehlt, mit direktem Weg dorthin. */
export function RecruiterStartChecklist() {
  // Lädt auch die Texte für startSteps und openSummary (lib/recruiterStart.ts)
  const { t } = useTranslation('recruiterDashboard');
  const { user } = useAuth();
  const guide = useRecruiterGuide();
  const pending = useRecruiterPending();
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
  const steps = startSteps(profile, tourSeen(user, browserStorage()), pending);
  const next = steps.find(s => !s.done && !s.waiting);
  const act = (id: StartStepId) => {
    if (id === 'tour') guide.start();
    else navigate(`/recruiter/profile/abrechnung#${id === 'bank' ? 'bankverbindung' : 'firmendaten'}`);
  };

  if (!next && !pending) {
    if (hidden || user.user_metadata?.[START_HIDDEN_KEY]) return null;
    const hide = () => {
      setHidden(true);
      void supabase.auth.updateUser({ data: { [START_HIDDEN_KEY]: new Date().toISOString() } }).then(({ error }) => {
        if (error) console.warn('[start] Ausblenden nicht gespeichert', error.message);
      });
    };
    return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-sm">
      <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-muted-foreground"/>{t('start.complete')}</span>
      <button type="button" onClick={hide} className="text-xs text-klick hover:underline">{t('start.hide')}</button>
    </div>;
  }

  const done = steps.filter(s => s.done).length;
  const offen = steps.filter(s => !s.done).map(s => s.label).join(', ');
  return <Card>
    <CardContent className="space-y-2.5 p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[15px] font-semibold tracking-tight">{t('start.title')}</h2>
        {next && next.id !== 'contract' && <button type="button" onClick={() => act(next.id)} className="text-sm text-klick hover:underline">{t(`start.actions.${next.id}`)} ›</button>}
      </div>
      <Progress value={startPercent(steps)} className="h-1.5 [&>div]:bg-klick" aria-label={t('start.percentAria', { percent: startPercent(steps) })}/>
      <p className="text-sm text-muted-foreground">{t('start.progress', { done, total: steps.length })}{offen && <> · {t('start.open', { list: offen })}</>}</p>
    </CardContent>
  </Card>;
}
