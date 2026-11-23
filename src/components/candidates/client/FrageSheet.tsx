import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, Loader2 } from 'lucide-react';
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
        {/* C1 (22.11.2026): wie ein Gespräch – Verlauf oben, Vorschläge und Eingabe unten */}
        <SheetHeader className="space-y-0.5 text-left">
          <SheetTitle className="text-base">{t('preview.askHh', { name })}</SheetTitle>
          <SheetDescription asChild>
            <div>
              <p className="text-sm font-medium text-foreground">{role || code}</p>
              <p className="text-xs">{role ? `${code} · ` : ''}{jobTitle} · {iv?.interview_date ? t('frage.interviewed') : t('frage.submitted')}</p>
            </div>
          </SheetDescription>
        </SheetHeader>

        {(thread.data?.messages.length ?? 0) > 0 && (
          <div className="mt-4 border-t pt-4">
            <QuestionThreadList messages={thread.data!.messages} name={name} blasen />
          </div>
        )}

        <div className="mt-4 border-t pt-4">
          {(common.length > 0 || fromAssessment.length > 0) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {common.map((q) => <Chip key={q.text} label={q.label} value={q.text} />)}
              {fromAssessment.map((q) => <Chip key={q.text} label={q.label} value={q.text} />)}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setError(''); }}
              placeholder={t('frage.placeholder', { name })}
              className="min-h-[44px] flex-1 text-sm"
              rows={text.length > 60 ? 3 : 1}
              maxLength={1000}
            />
            <Button size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={() => void send()} disabled={busy || !text.trim()} aria-label={t('frage.send')}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </Button>
          </div>
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            {t('frage.footer', { name })}{!identityUnlocked && <> {t('frage.protected')}</>}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
