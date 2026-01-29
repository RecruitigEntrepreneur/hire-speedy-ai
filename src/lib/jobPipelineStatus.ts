// Job Pipeline Status calculation and styling utilities

export type PipelineStage = 'new' | 'sourcing' | 'screening' | 'interviewing' | 'offering' | 'filled';
export type HealthLevel = 'excellent' | 'good' | 'warning' | 'critical' | 'paused';

export interface PipelineStats {
  totalCandidates: number;
  inScreening: number;
  inInterview: number;
  offersOut: number;
  hired: number;
  rejected: number;
}

export interface JobHealthStatus {
  level: HealthLevel;
  label: string;
  description: string;
  color: {
    bg: string;
    text: string;
    border: string;
  };
}

export function calculatePipelineStage(stats: PipelineStats): PipelineStage {
  if (stats.hired > 0) return 'filled';
  if (stats.offersOut > 0) return 'offering';
  if (stats.inInterview > 0) return 'interviewing';
  if (stats.inScreening > 0) return 'screening';
  if (stats.totalCandidates > 0) return 'sourcing';
  return 'new';
}

export function getJobHealthStatus(
  candidatesCount: number,
  interviewsCount: number,
  activeRecruiters: number,
  daysOpen: number,
  isPaused: boolean
): JobHealthStatus {
  if (isPaused) {
    return {
      level: 'paused',
      label: 'Pausiert',
      description: 'Suche ist pausiert',
      color: {
        bg: 'bg-muted',
        text: 'text-muted-foreground',
        border: 'border-muted',
      },
    };
  }

  let score = 0;

  // Factor 1: Candidates in pipeline
  if (candidatesCount >= 5) score += 30;
  else if (candidatesCount >= 2) score += 20;
  else if (candidatesCount >= 1) score += 10;

  // Factor 2: Interview activity
  if (interviewsCount >= 2) score += 30;
  else if (interviewsCount >= 1) score += 20;

  // Factor 3: Recruiter engagement
  if (activeRecruiters >= 3) score += 25;
  else if (activeRecruiters >= 1) score += 15;

  // Factor 4: Time factor
  if (daysOpen < 14) score += 15;
  else if (daysOpen < 30) score += 10;

  if (score >= 70) {
    return {
      level: 'excellent',
      label: 'Läuft gut',
      description: 'Aktive Pipeline mit guter Aktivität',
      color: {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-600',
        border: 'border-emerald-500/20',
      },
    };
  } else if (score >= 45) {
    return {
      level: 'good',
      label: 'In Bearbeitung',
      description: 'Kandidaten werden bearbeitet',
      color: {
        bg: 'bg-blue-500/10',
        text: 'text-blue-600',
        border: 'border-blue-500/20',
      },
    };
  } else if (score >= 20) {
    return {
      level: 'warning',
      label: 'Braucht Aufmerksamkeit',
      description: 'Wenig Aktivität in letzter Zeit',
      color: {
        bg: 'bg-amber-500/10',
        text: 'text-amber-600',
        border: 'border-amber-500/20',
      },
    };
  } else {
    return {
      level: 'critical',
      label: 'Startphase',
      description: 'Noch wenig Kandidaten im Prozess',
      color: {
        bg: 'bg-muted',
        text: 'text-muted-foreground',
        border: 'border-muted',
      },
    };
  }
}

export function getPipelineStageLabel(stage: string): string {
  const labels: Record<string, string> = {
    submitted: 'Neu',
    screening: 'Prüfung',
    interview: 'Interview',
    second_interview: 'Zweitgespräch',
    offer: 'Angebot',
    hired: 'Eingestellt',
    rejected: 'Abgelehnt',
  };
  return labels[stage] || stage;
}

export function getPipelineStageColor(stage: string): string {
  const colors: Record<string, string> = {
    submitted: 'bg-blue-500',
    screening: 'bg-yellow-500',
    interview: 'bg-purple-500',
    second_interview: 'bg-indigo-500',
    offer: 'bg-orange-500',
    hired: 'bg-emerald-500',
    rejected: 'bg-red-500',
  };
  return colors[stage] || 'bg-muted';
}
