import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Plus, 
  Briefcase, 
  Users, 
  Calendar, 
  TrendingUp,
  Target,
  AlertTriangle
} from 'lucide-react';
import { JobCommandCard } from '@/components/command/JobCommandCard';
import { useJobCommandData } from '@/hooks/useJobCommandData';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RecruitingHealthScore } from '@/components/dashboard/RecruitingHealthScore';
import { ClientTaskWidget } from '@/components/dashboard/ClientTaskWidget';
import { VerificationStatusBanner } from '@/components/verification/VerificationStatusBanner';
import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';

export default function JobCommandCenter() {
  const navigate = useNavigate();
  const { jobs, loading, rejectSubmission, refetch } = useJobCommandData();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; submissionId: string | null }>({
    open: false,
    submissionId: null,
  });
  
  // Interview dialog state
  const [interviewDialog, setInterviewDialog] = useState<{
    open: boolean;
    submissionId: string;
    candidateAnonymousId: string;
    jobTitle: string;
    jobIndustry: string;
  } | null>(null);

  // Calculate totals
  const totals = jobs.reduce((acc, job) => ({
    activeJobs: acc.activeJobs + 1,
    totalCandidates: acc.totalCandidates + job.stats.total,
    interviewsThisWeek: acc.interviewsThisWeek + job.upcomingInterviews.length,
    pendingActions: acc.pendingActions + job.pendingActions,
    offers: acc.offers + job.stats.offer,
    newCandidates: acc.newCandidates + job.stats.new,
  }), { activeJobs: 0, totalCandidates: 0, interviewsThisWeek: 0, pendingActions: 0, offers: 0, newCandidates: 0 });

  const handleRequestInterview = (submissionId: string) => {
    // Find the job data for this submission
    const jobData = jobs.find(j => 
      j.submissions.some(s => s.id === submissionId)
    );
    const submission = jobData?.submissions.find(s => s.id === submissionId);
    
    // Generate anonymous ID
    const anonymousId = `${jobData?.job.title?.slice(0, 2).toUpperCase() || 'XX'}-${submissionId.slice(0, 6).toUpperCase()}`;
    
    setInterviewDialog({
      open: true,
      submissionId,
      candidateAnonymousId: anonymousId,
      jobTitle: jobData?.job.title || 'Position',
      jobIndustry: 'IT', // Default as industry not in current job select
    });
  };

  const handleReject = (submissionId: string) => {
    setRejectDialog({ open: true, submissionId });
  };

  const confirmReject = async () => {
    if (!rejectDialog.submissionId) return;
    
    const { error } = await rejectSubmission(rejectDialog.submissionId);
    if (error) {
      toast.error('Fehler beim Ablehnen des Kandidaten');
    } else {
      toast.success('Kandidat wurde abgelehnt');
    }
    setRejectDialog({ open: false, submissionId: null });
  };

  const handleAskQuestion = (submissionId: string) => {
    navigate(`/dashboard/messages?submission=${submissionId}`);
  };

  const handleViewDetails = (submissionId: string) => {
    navigate(`/dashboard/candidates/${submissionId}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Verification Banner */}
        <VerificationStatusBanner />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Command Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Alle Jobs und Kandidaten zentral steuern
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard/jobs/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            Neuen Job erstellen
          </Button>
        </div>

        {/* Health Score & Tasks Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RecruitingHealthScore
            activeJobs={totals.activeJobs}
            totalCandidates={totals.totalCandidates}
            pendingInterviews={totals.interviewsThisWeek}
            placements={totals.offers}
            newCandidatesLast7Days={totals.newCandidates}
          />
          <ClientTaskWidget maxTasks={3} />
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard
            icon={Briefcase}
            label="Aktive Jobs"
            value={totals.activeJobs}
            loading={loading}
          />
          <StatCard
            icon={Users}
            label="Kandidaten"
            value={totals.totalCandidates}
            loading={loading}
          />
          <StatCard
            icon={Calendar}
            label="Interviews"
            value={totals.interviewsThisWeek}
            subtitle="geplant"
            loading={loading}
          />
          <StatCard
            icon={TrendingUp}
            label="Angebote"
            value={totals.offers}
            loading={loading}
            highlight
          />
          {totals.pendingActions > 0 && (
            <StatCard
              icon={AlertTriangle}
              label="Ausstehend"
              value={totals.pendingActions}
              subtitle=">48h"
              loading={loading}
              warning
            />
          )}
        </div>

        {/* Job Cards */}
        <div className="space-y-4">
          {loading ? (
            <>
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </>
          ) : jobs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Keine aktiven Jobs</h3>
                <p className="text-muted-foreground mb-4">
                  Erstellen Sie Ihren ersten Job, um Kandidaten zu empfangen.
                </p>
                <Button onClick={() => navigate('/dashboard/jobs/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Job erstellen
                </Button>
              </CardContent>
            </Card>
          ) : (
            jobs.map((jobData) => (
              <JobCommandCard
                key={jobData.job.id}
                data={jobData}
                onRequestInterview={handleRequestInterview}
                onReject={handleReject}
                onAskQuestion={handleAskQuestion}
                onViewDetails={handleViewDetails}
              />
            ))
          )}
        </div>
      </div>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kandidat ablehnen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie diesen Kandidaten wirklich ablehnen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ablehnen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Professional Interview Wizard */}
      {interviewDialog && (
        <ProfessionalInterviewWizard
          open={interviewDialog.open}
          onOpenChange={(open) => !open && setInterviewDialog(null)}
          submissionId={interviewDialog.submissionId}
          candidateAnonymousId={interviewDialog.candidateAnonymousId}
          jobTitle={interviewDialog.jobTitle}
          onSuccess={refetch}
        />
      )}
    </DashboardLayout>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  subtitle?: string;
  loading?: boolean;
  highlight?: boolean;
  warning?: boolean;
}

function StatCard({ icon: Icon, label, value, subtitle, loading, highlight, warning }: StatCardProps) {
  return (
    <Card className={`${highlight ? 'border-success/50 bg-success/5' : ''} ${warning ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <CardContent className="p-4">
        {loading ? (
          <Skeleton className="h-12 w-full" />
        ) : (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${highlight ? 'bg-success/10' : warning ? 'bg-destructive/10' : 'bg-muted'}`}>
              <Icon className={`h-5 w-5 ${highlight ? 'text-success' : warning ? 'text-destructive' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">{value}</span>
                {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
              </div>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
