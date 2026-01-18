import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  Calendar, 
  XCircle, 
  Video, 
  MessageSquare,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { CancelInterviewDialog } from './CancelInterviewDialog';
import { NoShowReportDialog } from './NoShowReportDialog';

interface InterviewActionsMenuProps {
  interviewId: string;
  status: string;
  scheduledAt: string;
  meetingLink?: string | null;
  onReschedule?: () => void;
  onCancelled?: () => void;
  onNoShowReported?: () => void;
  onMarkComplete?: () => void;
}

export function InterviewActionsMenu({
  interviewId,
  status,
  scheduledAt,
  meetingLink,
  onReschedule,
  onCancelled,
  onNoShowReported,
  onMarkComplete
}: InterviewActionsMenuProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [noShowDialogOpen, setNoShowDialogOpen] = useState(false);

  const isPast = new Date(scheduledAt) < new Date();
  const canCancel = status !== 'cancelled' && status !== 'completed';
  const canReportNoShow = isPast && status === 'confirmed';
  const canMarkComplete = isPast && status !== 'completed' && status !== 'cancelled';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {meetingLink && (
            <DropdownMenuItem asChild>
              <a href={meetingLink} target="_blank" rel="noopener noreferrer">
                <Video className="h-4 w-4 mr-2" />
                Meeting beitreten
              </a>
            </DropdownMenuItem>
          )}

          {!isPast && canCancel && (
            <DropdownMenuItem onClick={onReschedule}>
              <Calendar className="h-4 w-4 mr-2" />
              Verschieben
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={() => {}}>
            <MessageSquare className="h-4 w-4 mr-2" />
            Nachricht senden
          </DropdownMenuItem>

          {canMarkComplete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onMarkComplete}>
                <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                Als durchgeführt markieren
              </DropdownMenuItem>
            </>
          )}

          {canReportNoShow && (
            <DropdownMenuItem 
              onClick={() => setNoShowDialogOpen(true)}
              className="text-amber-600"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              No-Show melden
            </DropdownMenuItem>
          )}

          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setCancelDialogOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Absagen
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CancelInterviewDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        interviewId={interviewId}
        onCancelled={() => {
          setCancelDialogOpen(false);
          onCancelled?.();
        }}
      />

      <NoShowReportDialog
        open={noShowDialogOpen}
        onOpenChange={setNoShowDialogOpen}
        interviewId={interviewId}
        onReported={() => {
          setNoShowDialogOpen(false);
          onNoShowReported?.();
        }}
      />
    </>
  );
}
