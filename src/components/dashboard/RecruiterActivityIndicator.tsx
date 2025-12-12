import { Badge } from '@/components/ui/badge';
import { Activity } from 'lucide-react';

interface RecruiterActivityIndicatorProps {
  activeRecruiters: number;
  className?: string;
}

export function RecruiterActivityIndicator({ 
  activeRecruiters,
  className = ''
}: RecruiterActivityIndicatorProps) {
  if (activeRecruiters === 0) {
    return (
      <Badge variant="outline" className={`text-muted-foreground border-muted ${className}`}>
        Keine Recruiter aktiv
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={`border-emerald-300 bg-emerald-50 text-emerald-700 ${className}`}
    >
      <Activity className="h-3 w-3 mr-1 animate-pulse" />
      {activeRecruiters} Recruiter {activeRecruiters === 1 ? 'arbeitet' : 'arbeiten'}
    </Badge>
  );
}
