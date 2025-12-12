import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { PipelineColumn, PipelineColumnSkeleton } from '@/components/pipeline/PipelineColumn';
import { useHiringPipeline, PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  Briefcase,
  Users,
  Loader2,
  LayoutGrid
} from 'lucide-react';

export default function HiringPipeline() {
  const { jobId } = useParams<{ jobId?: string }>();
  const [searchParams] = useSearchParams();
  const initialJobId = jobId || searchParams.get('job') || undefined;
  
  const {
    jobs,
    selectedJobId,
    setSelectedJobId,
    loading,
    moveCandidate,
    rejectCandidate,
    getCandidatesByStage,
    candidates,
  } = useHiringPipeline(initialJobId);
  
  const [processing, setProcessing] = useState(false);
  
  usePageViewTracking('hiring_pipeline');

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  const handleMove = async (submissionId: string, newStage: string) => {
    setProcessing(true);
    try {
      await moveCandidate(submissionId, newStage);
      const stageLabel = PIPELINE_STAGES.find(s => s.key === newStage)?.label || newStage;
      toast.success(`Kandidat in "${stageLabel}" verschoben`);
    } catch (error) {
      toast.error('Fehler beim Verschieben');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (submissionId: string) => {
    setProcessing(true);
    try {
      await rejectCandidate(submissionId);
      toast.success('Kandidat abgelehnt');
    } catch (error) {
      toast.error('Fehler beim Ablehnen');
    } finally {
      setProcessing(false);
    }
  };

  // Stats for the selected job
  const totalCandidates = candidates.length;
  const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = getCandidatesByStage(stage.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Link */}
        <Link 
          to="/dashboard" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zum Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <LayoutGrid className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hiring Pipeline</h1>
              <p className="text-muted-foreground">
                {selectedJob ? selectedJob.title : 'Wählen Sie einen Job'}
              </p>
            </div>
          </div>

          {/* Job Selector */}
          <div className="flex items-center gap-3">
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger className="w-[280px]">
                <Briefcase className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Job auswählen" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Row */}
        {selectedJobId && !loading && (
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{totalCandidates}</span>
              <span className="text-muted-foreground">Kandidaten gesamt</span>
            </div>
            {PIPELINE_STAGES.slice(0, 4).map((stage) => (
              <div key={stage.key} className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                <span className="font-medium">{stageCounts[stage.key] || 0}</span>
                <span className="text-muted-foreground">{stage.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* No Job Selected */}
        {!selectedJobId && !loading && (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-muted-foreground">Kein Job ausgewählt</h3>
              <p className="text-sm text-muted-foreground/70 mb-4">
                Wählen Sie einen Job, um die Pipeline anzuzeigen
              </p>
              {jobs.length === 0 && (
                <Button variant="hero" size="sm" asChild>
                  <Link to="/dashboard/jobs/new">
                    Ersten Job erstellen
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pipeline Board */}
        {selectedJobId && (
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4 min-h-[calc(100vh-280px)]">
              {loading ? (
                PIPELINE_STAGES.map((stage) => (
                  <PipelineColumnSkeleton key={stage.key} />
                ))
              ) : (
                PIPELINE_STAGES.map((stage) => (
                  <PipelineColumn
                    key={stage.key}
                    stage={stage}
                    candidates={getCandidatesByStage(stage.key)}
                    onMove={handleMove}
                    onReject={handleReject}
                    isProcessing={processing}
                  />
                ))
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </div>
    </DashboardLayout>
  );
}
