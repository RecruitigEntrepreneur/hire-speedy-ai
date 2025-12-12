import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PipelineColumn, PipelineColumnSkeleton } from '@/components/pipeline/PipelineColumn';
import { BottleneckSummary } from '@/components/pipeline/BottleneckSummary';
import { useHiringPipeline, PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';
import { 
  ArrowLeft,
  Briefcase,
  ChevronDown,
  Check
} from 'lucide-react';

export default function HiringPipeline() {
  const { jobId } = useParams<{ jobId?: string }>();
  const [searchParams] = useSearchParams();
  const initialJobId = jobId || searchParams.get('job') || undefined;
  const [jobSelectorOpen, setJobSelectorOpen] = useState(false);
  
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

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setJobSelectorOpen(false);
  };

  // Stats for the selected job
  const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = getCandidatesByStage(stage.key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Compact Header */}
        <div className="flex items-center gap-3">
          <Link 
            to="/dashboard" 
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          
          <Popover open={jobSelectorOpen} onOpenChange={setJobSelectorOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                className="text-lg font-semibold gap-2 px-2 h-auto py-1"
              >
                {selectedJob?.title || 'Job auswählen'}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-1" align="start">
              <div className="space-y-0.5">
                {jobs.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Keine Jobs vorhanden
                  </div>
                ) : (
                  jobs.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => handleSelectJob(job.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left transition-colors"
                    >
                      <span className="flex-1 truncate">{job.title}</span>
                      {job.id === selectedJobId && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Inline Stats */}
          {selectedJobId && !loading && (
            <div className="hidden md:flex items-center gap-4 ml-4 text-xs text-muted-foreground">
              {PIPELINE_STAGES.map((stage) => (
                <span key={stage.key} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${stage.color}`} />
                  <span className="font-medium text-foreground">{stageCounts[stage.key] || 0}</span>
                  <span>{stage.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* No Job Selected - Compact */}
        {!selectedJobId && !loading && (
          <Card className="border-dashed border-border/50">
            <CardContent className="flex items-center justify-center py-8 gap-4">
              <Briefcase className="h-8 w-8 text-muted-foreground/40" />
              <div>
                <h3 className="font-medium text-sm">
                  {jobs.length === 0 ? 'Noch keine Jobs vorhanden' : 'Job auswählen'}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {jobs.length === 0 
                    ? 'Erstelle deinen ersten Job, um die Pipeline zu nutzen'
                    : 'Wähle einen Job aus dem Dropdown oben'}
                </p>
              </div>
              {jobs.length === 0 && (
                <Button variant="hero" size="sm" asChild>
                  <Link to="/dashboard/jobs/new">Job erstellen</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Bottleneck Summary */}
        {selectedJobId && !loading && candidates.length > 0 && (
          <BottleneckSummary candidates={candidates} />
        )}

        {/* Pipeline Board - Dynamic Height */}
        {selectedJobId && (
          <TooltipProvider>
            <ScrollArea className="w-full">
              <div className={`flex gap-3 pb-4 ${candidates.length === 0 ? 'min-h-[200px]' : 'min-h-[400px]'}`}>
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
          </TooltipProvider>
        )}
      </div>
    </DashboardLayout>
  );
}
