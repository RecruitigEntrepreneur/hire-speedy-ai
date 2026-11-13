import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCandidateFitAssessment } from '@/hooks/useCandidateFitAssessment';
import { questionSuggestions } from '@/lib/clientQuestions';
import { useCandidateInsights } from './useCandidateInsights';
import { useClientQuestions } from './useClientQuestions';
import { submitterName, type Submitter } from './useSubmitter';
import { QuestionThreadList } from './QuestionThreadList';
import { useTranslation } from 'react-i18next';

export const initialsOf = (name: string) =>
  name.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join('').toUpperCase() || 'HH';

interface FrageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitter: Submitter | null | undefined;
  submissionId: string;
  jobId: string;
  candidateId: string;
  jobTitle: string;
  code: string;
  role: string | null;
  identityUnlocked: boolean;
  /** Kündigungsfrist aus dem Profil, falls das Gespräch keine liefert. */
  noticeFallback?: string | null;
}

/**
 * „Frage an <Headhunter>“: Vorschläge nur für das, was das Profil nicht beantwortet
 * und noch nicht gefragt wurde (clientQuestions.ts), dazu eine eigene Frage.
 */
export function FrageSheet({ open, onOpenChange, submitter, submissionId, jobId, candidateId, jobTitle, code, role, identityUnlocked, noticeFallback = null }: FrageSheetProps) {
  const { toast } = useToast();
  const { t } = useTranslation('clientCandidates');
  const name = submitterName(submitter);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const thread = useClientQuestions(jobId, candidateId);
  const insights = useCandidateInsights(open ? submissionId : undefined).data;
  const fit = useCandidateFitAssessment(open ? submissionId : undefined);
  const { data: budgetMax } = useQuery({
    queryKey: ['job-budget-max', jobId],
    enabled: open && !!jobId,
    queryFn: async () => {
      const { data } = await supabase.from('jobs').select('salary_max, salary_min').eq('id', jobId).maybeSingle();
      return (data?.salary_max ?? data?.salary_min ?? null) as number | null;
    },
  });

  const iv = insights?.interview ?? null;
  const { common, fromAssessment } = questionSuggestions({
    changeMotivation: iv?.change_motivation ?? null,
    noticePeriod: iv?.notice_period ?? noticeFallback,
    salaryWish: iv?.salary_wish ?? null,
    budgetMax: budgetMax ?? null,
    gaps: fit.assessment?.gap_analysis ?? [],
    asked: thread.data?.asked ?? [],
  });

  const send = async () => {
    const q = text.trim();
    if (!q) {
      setError(t('frage.enterFirst'));
      return;
    }
    if (!submitter?.recruiterId) {
      setError(t('frage.unknownHh'));
      return;
    }
    setBusy(true);
    try {
      await thread.ask({ submissionId, text: q });
      setText('');
      toast({ title: t('frage.sentTo', { name }), description: t('frage.sentHint') });
    } catch (e) {
      toast({ title: t('frage.sendError'), description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const Chip = ({ label, value }: { label: string; value: string }) => (
    <button
      type="button"
      onClick={() => { setText(value); setError(''); }}
      className="rounded-full border px-2.5 py-1 text-left text-xs hover:bg-muted"
    >
      {label}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-0 text-left">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              {submitter?.photo && <AvatarImage src={submitter.photo} alt="" />}
              <AvatarFallback className="bg-primary/10 text-xs text-primary">{initialsOf(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <SheetTitle className="text-base">{t('preview.askHh', { name })}</SheetTitle>
              <SheetDescription className="text-xs">
                {iv?.interview_date ? t('frage.interviewed') : t('frage.submitted')}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-xs">
          {t('frage.about')} <span className="font-medium">{code}</span>{role ? ` · ${role}` : ''}
          <br />
          <span className="text-muted-foreground">{t('card.for', { job: jobTitle })}</span>
        </div>

        {common.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{t('frage.common')}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{common.map((q) => <Chip key={q.text} label={q.label} value={q.text} />)}</div>
          </div>
        )}
        {fromAssessment.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">{t('frage.fromAssessment')}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{fromAssessment.map((q) => <Chip key={q.text} label={q.label} value={q.text} />)}</div>
          </div>
        )}

        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          placeholder={t('frage.placeholder', { name })}
          className="mt-4 min-h-[90px] text-sm"
          maxLength={1000}
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        {!identityUnlocked && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" />
            {t('frage.protected')}
          </p>
        )}
        <Button className="mt-3 w-full" onClick={() => void send()} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('frage.send')}
        </Button>
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          {t('frage.footer', { name })}
        </p>

        {(thread.data?.messages.length ?? 0) > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs text-muted-foreground">{t('frage.previous')}</p>
            <QuestionThreadList messages={thread.data!.messages} name={name} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
