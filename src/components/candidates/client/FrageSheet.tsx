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
      setError('Bitte zuerst eine Frage eingeben.');
      return;
    }
    if (!submitter?.recruiterId) {
      setError('Der Headhunter zu diesem Kandidaten ist nicht bekannt.');
      return;
    }
    setBusy(true);
    try {
      await thread.ask({ submissionId, text: q });
      setText('');
      toast({ title: `Gesendet an ${name}`, description: 'Sie sehen die Antwort hier im Profil und in der Glocke.' });
    } catch (e) {
      toast({ title: 'Die Frage konnte nicht gesendet werden', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
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
              <SheetTitle className="text-base">Frage an {name}</SheetTitle>
              <SheetDescription className="text-xs">
                Headhunter · {iv?.interview_date ? 'hat den Kandidaten interviewt' : 'hat den Kandidaten eingereicht'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-xs">
          zu <span className="font-medium">{code}</span>{role ? ` · ${role}` : ''}
          <br />
          <span className="text-muted-foreground">für: {jobTitle}</span>
        </div>

        {common.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">Häufige Fragen</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{common.map((q) => <Chip key={q.text} label={q.label} value={q.text} />)}</div>
          </div>
        )}
        {fromAssessment.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-muted-foreground">Aus der Einschätzung</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{fromAssessment.map((q) => <Chip key={q.text} label={q.label} value={q.text} />)}</div>
          </div>
        )}

        <Textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          placeholder={`Ihre Frage an ${name} …`}
          className="mt-4 min-h-[90px] text-sm"
          maxLength={1000}
        />
        {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        {!identityUnlocked && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" />
            Name und Arbeitgeber des Kandidaten bleiben bis zur Interview-Zusage geschützt.
          </p>
        )}
        <Button className="mt-3 w-full" onClick={() => void send()} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Senden
        </Button>
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          {name} bekommt eine Aufgabe „Kunde fragt“ und eine E-Mail. Die Antwort sehen Sie hier im Profil, unter Nachrichten und in der Glocke.
        </p>

        {(thread.data?.messages.length ?? 0) > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 text-xs text-muted-foreground">Bisherige Fragen zu diesem Kandidaten</p>
            <QuestionThreadList messages={thread.data!.messages} name={name} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
