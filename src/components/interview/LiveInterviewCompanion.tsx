import React, { useState, useEffect } from 'react';
import { X, Video, ExternalLink, Save, Calendar, ChevronDown, Copy, Edit, Phone, MapPin, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { CandidateQuickInfo } from './CandidateQuickInfo';
import { InterviewGuide } from './InterviewGuide';
import { LiveNotesPanel } from './LiveNotesPanel';
import { InterviewTimer } from './InterviewTimer';
import { InterviewSummaryDialog } from './InterviewSummaryDialog';
import { InterviewEditDialog } from './InterviewEditDialog';
import { useInterviewSession, QuickScores } from '@/hooks/useInterviewSession';
import { useLiveInterviewNotes } from '@/hooks/useLiveInterviewNotes';
import { useClientCandidateSummary } from '@/hooks/useClientCandidateSummary';
import { supabase } from '@/integrations/supabase/client';

// Meeting type configuration
const MEETING_TYPE_CONFIG: Record<string, { icon: typeof Video; label: string; color: string }> = {
  video: { icon: Video, label: 'Video', color: 'text-blue-500' },
  teams: { icon: Video, label: 'Teams', color: 'text-purple-500' },
  meet: { icon: Video, label: 'Google Meet', color: 'text-red-500' },
  zoom: { icon: Video, label: 'Zoom', color: 'text-blue-600' },
  phone: { icon: Phone, label: 'Telefon', color: 'text-green-500' },
  onsite: { icon: MapPin, label: 'Vor Ort', color: 'text-orange-500' },
};

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
  duration_minutes?: number;
  meeting_link?: string;
  meeting_type?: string;
  interview_type_id?: string;
  location?: string;
  notes?: string;
  submission?: {
    candidate?: CandidateData;
    job?: {
      title?: string;
      company_name?: string;
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editProcessing, setEditProcessing] = useState(false);

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
  const companyName = interview?.submission?.job?.company_name;
  const submissionId = (interview?.submission as any)?.id;

  // Fetch client candidate summary
  const { summary: clientSummary } = useClientCandidateSummary(
    candidate?.id,
    submissionId
  );

  // Get meeting type config
  const meetingTypeKey = interview?.meeting_type?.toLowerCase() || 'video';
  const meetingConfig = MEETING_TYPE_CONFIG[meetingTypeKey] || MEETING_TYPE_CONFIG.video;
  const MeetingIcon = meetingConfig.icon;

  // Format interview date/time
  const scheduledDate = interview ? new Date(interview.scheduled_at) : new Date();
  const formattedDate = format(scheduledDate, "EEE, d. MMM", { locale: de });
  const formattedTime = format(scheduledDate, "HH:mm", { locale: de });
  const duration = interview?.duration_minutes || 60;
  const endTime = format(new Date(scheduledDate.getTime() + duration * 60000), "HH:mm", { locale: de });

  // Copy meeting link
  const handleCopyLink = () => {
    if (interview?.meeting_link) {
      navigator.clipboard.writeText(interview.meeting_link);
      toast.success('Link kopiert');
    }
  };

  // Handle edit save
  const handleEditSave = async (updatedData: any) => {
    if (!interview) return;
    setEditProcessing(true);
    try {
      await supabase
        .from('interviews')
        .update({
          scheduled_at: updatedData.scheduled_at,
          duration_minutes: updatedData.duration_minutes,
          meeting_type: updatedData.meeting_type,
          meeting_link: updatedData.meeting_link,
          notes: updatedData.notes,
        })
        .eq('id', interview.id);

      toast.success('Interview aktualisiert');
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating interview:', error);
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setEditProcessing(false);
    }
  };

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
          <div className="flex flex-col border-b bg-muted/30">
            {/* Main header row */}
            <div className="flex items-center justify-between px-4 py-3">
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
                    
                    {/* Clickable Interview Info Chip with Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="flex items-center gap-1.5 mt-0.5 px-2 py-0.5 text-xs rounded-md 
                                           bg-muted/60 hover:bg-muted transition-colors text-muted-foreground
                                           hover:text-foreground cursor-pointer border border-transparent hover:border-border">
                          <Calendar className="h-3 w-3" />
                          <span>{formattedDate} • {formattedTime} Uhr • {duration} Min</span>
                          <Separator orientation="vertical" className="h-2.5 mx-0.5" />
                          <MeetingIcon className={cn("h-3 w-3", meetingConfig.color)} />
                          <span>{meetingConfig.label}</span>
                          <ChevronDown className="h-2.5 w-2.5 ml-0.5 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 p-0" align="start">
                        <div className="p-3 border-b bg-muted/30">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            Interview-Details
                          </h4>
                        </div>
                        <div className="p-3 space-y-3">
                          {/* Date & Time */}
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Datum</p>
                              <p className="font-medium">{format(scheduledDate, "EEEE, d. MMMM yyyy", { locale: de })}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Uhrzeit</p>
                              <p className="font-medium">{formattedTime} – {endTime} Uhr</p>
                            </div>
                          </div>
                          
                          <Separator />
                          
                          {/* Meeting Type */}
                          <div className="text-sm">
                            <p className="text-xs text-muted-foreground mb-1">Meeting-Typ</p>
                            <div className="flex items-center gap-2">
                              <MeetingIcon className={cn("h-4 w-4", meetingConfig.color)} />
                              <span className="font-medium">{meetingConfig.label}</span>
                            </div>
                          </div>
                          
                          {/* Meeting Link */}
                          {interview.meeting_link && (
                            <>
                              <Separator />
                              <div className="text-sm">
                                <p className="text-xs text-muted-foreground mb-1.5">Meeting-Link</p>
                                <div className="flex items-center gap-1.5 p-2 bg-muted/50 rounded-md border">
                                  <span className="flex-1 text-xs font-mono truncate">
                                    {interview.meeting_link}
                                  </span>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 shrink-0"
                                    onClick={handleCopyLink}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => window.open(interview.meeting_link, '_blank')}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                          
                          {/* Job Context */}
                          {(jobTitle || companyName) && (
                            <>
                              <Separator />
                              <div className="text-sm">
                                <p className="text-xs text-muted-foreground mb-1">Position</p>
                                <p className="font-medium">{jobTitle}</p>
                                {companyName && (
                                  <p className="text-muted-foreground text-xs">@ {companyName}</p>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        
                        {/* Edit Button */}
                        <div className="p-2 border-t bg-muted/20">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full gap-2"
                            onClick={() => setEditDialogOpen(true)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            Details bearbeiten
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
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

            {/* Meeting Link Banner - Always visible when link exists */}
            {interview.meeting_link && (
              <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-t border-primary/10">
                <div className="flex items-center gap-2 text-sm">
                  <MeetingIcon className={cn("h-4 w-4", meetingConfig.color)} />
                  <span className="font-mono text-xs text-muted-foreground truncate max-w-[300px]">
                    {interview.meeting_link}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 gap-1.5 text-xs"
                    onClick={handleCopyLink}
                  >
                    <Copy className="h-3 w-3" />
                    Kopieren
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => window.open(interview.meeting_link, '_blank')}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Beitreten
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Main 3-column layout - 35% / 35% / 30% */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Candidate Info - 35% */}
            <div className="w-[35%] min-w-[280px] border-r bg-muted/20 overflow-hidden">
              <CandidateQuickInfo 
                candidate={candidate} 
                jobTitle={jobTitle}
                clientSummary={clientSummary ? {
                  key_selling_points: clientSummary.key_selling_points,
                  change_motivation_summary: clientSummary.change_motivation_summary,
                  risk_factors: clientSummary.risk_factors,
                } : undefined}
              />
            </div>

            {/* Middle: Interview Guide - 35% */}
            <div className="w-[35%] min-w-[280px] border-r overflow-hidden">
              <InterviewGuide
                interviewId={interview.id}
                interviewTypeId={interview.interview_type_id}
                quickScores={session.quickScores}
                onUpdateScore={updateQuickScore}
              />
            </div>

            {/* Right: Live Notes - 30% */}
            <div className="w-[30%] min-w-[260px] overflow-hidden">
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

      {/* Edit Dialog */}
      <InterviewEditDialog
        interview={interview}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleEditSave}
        isProcessing={editProcessing}
      />
    </>
  );
}
