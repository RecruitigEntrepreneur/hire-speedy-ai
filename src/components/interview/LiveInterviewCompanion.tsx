import React, { useState, useEffect } from 'react';
import { X, Video, ExternalLink, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { CandidateQuickInfo } from './CandidateQuickInfo';
import { InterviewGuide } from './InterviewGuide';
import { LiveNotesPanel } from './LiveNotesPanel';
import { InterviewTimer } from './InterviewTimer';
import { InterviewSummaryDialog } from './InterviewSummaryDialog';
import { useInterviewSession, QuickScores } from '@/hooks/useInterviewSession';
import { useLiveInterviewNotes } from '@/hooks/useLiveInterviewNotes';
import { supabase } from '@/integrations/supabase/client';

interface CandidateData {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  city?: string;
  job_title?: string;
  company?: string;
  experience_years?: number;
  skills?: string[];
  current_salary?: number;
  expected_salary?: number;
  notice_period?: string;
  availability_date?: string;
  cv_url?: string;
  linkedin_url?: string;
}

interface InterviewData {
  id: string;
  scheduled_at: string;
  meeting_link?: string;
  meeting_type?: string;
  interview_type_id?: string;
  submission?: {
    candidate?: CandidateData;
    job?: {
      title?: string;
    };
  };
}

interface LiveInterviewCompanionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: InterviewData | null;
}

export function LiveInterviewCompanion({
  open,
  onOpenChange,
  interview,
}: LiveInterviewCompanionProps) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    session,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    updateQuickScore,
    formatTime,
    elapsedSeconds,
  } = useInterviewSession(interview?.id || null);

  const {
    notes,
    pinnedNotes,
    regularNotes,
    addNote,
    togglePin,
    deleteNote,
  } = useLiveInterviewNotes(interview?.id || null);

  // Auto-start session when opening if interview is scheduled for now/soon
  useEffect(() => {
    if (open && interview && !session.startedAt && !session.endedAt) {
      const scheduledTime = new Date(interview.scheduled_at).getTime();
      const now = Date.now();
      const diffMinutes = (now - scheduledTime) / 1000 / 60;
      
      // Auto-start if within 15 minutes of scheduled time
      if (diffMinutes >= -5 && diffMinutes <= 60) {
        startSession();
      }
    }
  }, [open, interview, session.startedAt, session.endedAt, startSession]);

  const candidate = interview?.submission?.candidate;
  const jobTitle = interview?.submission?.job?.title;

  const handleEndInterview = async () => {
    await endSession();
    setSummaryOpen(true);
  };

  const handleSummarySubmit = async (data: {
    recommendation: 'hire' | 'next_round' | 'reject' | null;
    comment: string;
    quickScores: QuickScores;
  }) => {
    if (!interview) return;

    try {
      // Save feedback to interview_feedback table
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase.from('interview_feedback').upsert({
        interview_id: interview.id,
        evaluator_id: user.id,
        recommendation: data.recommendation,
        notes: data.comment,
        technical_skills_rating: data.quickScores.technical || null,
        communication_rating: data.quickScores.communication || null,
        culture_fit_rating: data.quickScores.culture_fit || null,
      }, {
        onConflict: 'interview_id,evaluator_id'
      });

      toast.success('Feedback gespeichert');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast.error('Fehler beim Speichern');
    }
  };

  const handleManualSave = async () => {
    setSaving(true);
    try {
      // Save quick scores
      if (interview?.id) {
        await supabase
          .from('interviews')
          .update({ quick_scores: session.quickScores })
          .eq('id', interview.id);
      }
      toast.success('Gespeichert');
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (!interview || !candidate) return null;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} Minuten`;
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}min`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className={cn(
            "max-w-[1400px] w-[calc(100vw-48px)] h-[calc(100vh-80px)] max-h-[900px]",
            "p-0 gap-0 overflow-hidden flex flex-col"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-4">
              {/* Candidate info */}
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary">
                    {candidate.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold">{candidate.full_name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {jobTitle || candidate.job_title}
                  </p>
                </div>
              </div>

              <Separator orientation="vertical" className="h-8" />

              {/* Timer */}
              <InterviewTimer
                formattedTime={formatTime()}
                isRunning={session.isRunning}
                hasStarted={!!session.startedAt}
                hasEnded={!!session.endedAt}
                onStart={startSession}
                onPause={pauseSession}
                onResume={resumeSession}
                onEnd={handleEndInterview}
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Join meeting button */}
              {interview.meeting_link && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(interview.meeting_link, '_blank')}
                >
                  <Video className="h-4 w-4" />
                  Beitreten
                  <ExternalLink className="h-3 w-3" />
                </Button>
              )}

              {/* Manual save */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSave}
                disabled={saving}
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Speichert...' : 'Speichern'}
              </Button>

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Main 3-column layout */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Candidate Info */}
            <div className="w-[280px] border-r bg-muted/20 overflow-hidden">
              <CandidateQuickInfo 
                candidate={candidate} 
                jobTitle={jobTitle}
              />
            </div>

            {/* Middle: Interview Guide */}
            <div className="flex-1 border-r overflow-hidden">
              <InterviewGuide
                interviewId={interview.id}
                interviewTypeId={interview.interview_type_id}
                quickScores={session.quickScores}
                onUpdateScore={updateQuickScore}
              />
            </div>

            {/* Right: Live Notes */}
            <div className="w-[320px] overflow-hidden">
              <LiveNotesPanel
                notes={notes}
                pinnedNotes={pinnedNotes}
                elapsedSeconds={elapsedSeconds}
                onAddNote={addNote}
                onTogglePin={togglePin}
                onDeleteNote={deleteNote}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/30">
            <div className="text-xs text-muted-foreground">
              {notes.length} Notizen • Auto-Speichern aktiv
            </div>
            <div className="flex items-center gap-2">
              {!session.endedAt && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleEndInterview}
                  className="gap-2"
                >
                  🔴 Interview beenden
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSummaryOpen(true)}
                className="gap-2"
              >
                📋 Scorecard ausfüllen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Summary Dialog */}
      <InterviewSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        candidateName={candidate.full_name}
        duration={formatDuration(elapsedSeconds)}
        notes={notes}
        quickScores={session.quickScores}
        onSubmit={handleSummarySubmit}
      />
    </>
  );
}
