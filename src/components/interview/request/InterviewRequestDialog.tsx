import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { interviewApi, type SendResult } from '@/lib/interviewScheduling';
import { RequestForm } from './RequestForm';

export interface InterviewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  onSent?: (r: SendResult) => void;
  /** offene Anfrage oder Termin, der durch diese Anfrage ersetzt wird */
  replacesInterviewId?: string | null;
}

function LoadingState() {
  return (
    <>
      <DialogHeader className="space-y-2 border-b px-4 py-4 pr-12 text-left sm:px-6">
        <DialogTitle>Interview anfragen</DialogTitle>
        <DialogDescription asChild>
          <div>
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-6 px-4 py-4 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    </>
  );
}

function DialogBody({ submissionId, onOpenChange, onSent, replacesInterviewId }: Omit<InterviewRequestDialogProps, 'open'>) {
  const context = useQuery({
    queryKey: ['interview-request-context', submissionId],
    queryFn: () => interviewApi.context(submissionId),
    // bei jedem Öffnen frisch laden, während das Fenster offen ist nicht neu laden
    staleTime: Infinity,
    gcTime: 0,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  if (context.isLoading) return <LoadingState />;

  if (context.error || !context.data) {
    return (
      <>
        <DialogHeader className="border-b px-4 py-4 pr-12 text-left sm:px-6">
          <DialogTitle>Interview anfragen</DialogTitle>
          <DialogDescription>Die Angaben zu dieser Bewerbung konnten nicht geladen werden.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <p className="max-w-md text-sm text-muted-foreground">
            {context.error?.message || 'Das hat nicht geklappt. Bitte erneut versuchen.'}
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => context.refetch()} disabled={context.isFetching}>
            <RefreshCw className={context.isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Erneut versuchen
          </Button>
        </div>
      </>
    );
  }

  return (
    <RequestForm
      key={submissionId}
      ctx={context.data}
      replacesInterviewId={replacesInterviewId}
      onClose={() => onOpenChange(false)}
      onSent={onSent}
    />
  );
}

/**
 * Kundenfenster „Interview anfragen“: Termine aus dem eigenen Kalender vorschlagen,
 * Teilnehmer wählen, Kandidat und Headhunter benachrichtigen. Lädt seinen Kontext
 * beim Öffnen selbst (interview-request › context).
 */
export function InterviewRequestDialog({ open, onOpenChange, submissionId, onSent, replacesInterviewId }: InterviewRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        {open && submissionId ? (
          <DialogBody
            submissionId={submissionId}
            onOpenChange={onOpenChange}
            onSent={onSent}
            replacesInterviewId={replacesInterviewId}
          />
        ) : (
          <DialogHeader className="sr-only">
            <DialogTitle>Interview anfragen</DialogTitle>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}
