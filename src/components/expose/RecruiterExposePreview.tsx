import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { CandidateExpose } from './CandidateExpose';
import { useExposeData } from '@/hooks/useExposeData';
import { Skeleton } from '@/components/ui/skeleton';

interface RecruiterExposePreviewProps {
  submissionId: string;
  candidateName: string;
}

export function RecruiterExposePreview({ submissionId, candidateName }: RecruiterExposePreviewProps) {
  const [open, setOpen] = useState(false);
  const { data, loading, error, generateExpose } = useExposeData(submissionId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Eye className="h-4 w-4" />
          Kunden-Ansicht
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>So sieht der Kunde diesen Kandidaten</DialogTitle>
          <DialogDescription>
            Vorschau des Kandidaten-Exposés wie es dem Kunden angezeigt wird.
            Keine Rohdaten, nur destillierte Informationen.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={generateExpose}>Exposé generieren</Button>
            </div>
          ) : data ? (
            <CandidateExpose
              candidateId={data.candidateId}
              candidateName={data.candidateName}
              isAnonymized={data.isAnonymized}
              currentRole={data.currentRole}
              matchScore={data.matchScore}
              dealProbability={data.dealProbability}
              dealHealthScore={data.dealHealthScore}
              dealHealthRisk={data.dealHealthRisk}
              dealHealthReason={data.dealHealthReason}
              status={data.status}
              executiveSummary={data.executiveSummary}
              hardFacts={data.hardFacts}
              onRequestInterview={() => {}}
              onReject={() => {}}
              onAskQuestion={() => {}}
              onBookmark={() => {}}
            />
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Kein Exposé vorhanden. Generieren Sie eines, um die Kunden-Ansicht zu sehen.
              </p>
              <Button onClick={generateExpose}>Exposé generieren</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
