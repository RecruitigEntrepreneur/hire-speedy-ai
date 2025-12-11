import { Card, CardContent } from '@/components/ui/card';
import { Users, UserPlus, Calendar, Briefcase } from 'lucide-react';

interface CandidateStatsBarProps {
  totalCandidates: number;
  addedThisWeek: number;
  availableSoon: number;
  activeAssignments: number;
}

export function CandidateStatsBar({
  totalCandidates,
  addedThisWeek,
  availableSoon,
  activeAssignments,
}: CandidateStatsBarProps) {
  const stats = [
    {
      label: 'Gesamt',
      value: totalCandidates,
      icon: Users,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Diese Woche',
      value: addedThisWeek,
      icon: UserPlus,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      label: 'Bald verfügbar',
      value: availableSoon,
      icon: Calendar,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      label: 'Aktive Jobs',
      value: activeAssignments,
      icon: Briefcase,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
