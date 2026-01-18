import { Calendar, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface InterviewEmptyStateProps {
  type: 'upcoming' | 'past';
}

export function InterviewEmptyState({ type }: InterviewEmptyStateProps) {
  if (type === 'past') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Calendar className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Keine vergangenen Interviews
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          Abgeschlossene Interviews werden hier angezeigt.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-gradient-to-br from-muted/30 to-muted/10">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96">
          <Calendar className="w-full h-full text-primary" strokeWidth={0.5} />
        </div>
      </div>
      
      <div className="relative flex flex-col items-center justify-center py-16 px-4">
        {/* Icon */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-lg">
            <Calendar className="h-10 w-10 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-muted flex items-center justify-center border-2 border-background">
            <span className="text-xs">📅</span>
          </div>
        </div>
        
        {/* Text */}
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Keine Interviews geplant
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
          Sobald Recruiter Interviewtermine für Sie koordinieren, 
          erscheinen diese hier mit allen Details und Aktionen.
        </p>
        
        {/* CTA */}
        <Button variant="outline" asChild className="gap-2">
          <Link to="/dashboard/jobs">
            <Briefcase className="h-4 w-4" />
            Offene Stellen ansehen
          </Link>
        </Button>
      </div>
    </div>
  );
}
