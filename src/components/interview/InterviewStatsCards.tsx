import { useMemo } from 'react';
import { Calendar, Clock, MessageSquare, TrendingUp } from 'lucide-react';
import { isToday, isThisWeek, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface Interview {
  id: string;
  scheduled_at: string | null;
  status: string | null;
  feedback: string | null;
  submission: {
    candidate: {
      full_name: string;
    };
    job: {
      title: string;
    };
  };
}

interface InterviewStatsCardsProps {
  interviews: Interview[];
  onFilterChange?: (filter: 'today' | 'week' | 'feedback' | 'completed' | null) => void;
  activeFilter?: 'today' | 'week' | 'feedback' | 'completed' | null;
}

export function InterviewStatsCards({ interviews, onFilterChange, activeFilter }: InterviewStatsCardsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    
    const activeInterviews = interviews.filter(i => 
      i.status !== 'cancelled' && i.scheduled_at
    );
    
    const todayInterviews = activeInterviews.filter(i => 
      i.scheduled_at && isToday(new Date(i.scheduled_at)) && i.status !== 'completed'
    );
    
    const weekInterviews = activeInterviews.filter(i => 
      i.scheduled_at && isThisWeek(new Date(i.scheduled_at), { weekStartsOn: 1 }) && i.status !== 'completed'
    );
    
    const pendingFeedback = interviews.filter(i => 
      i.status === 'completed' && !i.feedback
    );
    
    const completedThisMonth = interviews.filter(i => {
      if (!i.scheduled_at || i.status !== 'completed') return false;
      const date = new Date(i.scheduled_at);
      return date >= monthStart && date <= monthEnd;
    });

    return {
      today: todayInterviews.length,
      week: weekInterviews.length,
      pendingFeedback: pendingFeedback.length,
      completedMonth: completedThisMonth.length,
    };
  }, [interviews]);

  const cards = [
    {
      key: 'today' as const,
      title: 'Heute',
      value: stats.today,
      subtitle: 'Interviews',
      icon: Calendar,
      gradient: 'from-primary/10 to-primary/5',
      iconColor: 'text-primary',
      iconBg: 'bg-primary/10',
      activeRing: 'ring-primary/50',
    },
    {
      key: 'week' as const,
      title: 'Diese Woche',
      value: stats.week,
      subtitle: 'Interviews',
      icon: Clock,
      gradient: 'from-emerald-500/10 to-emerald-600/5',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-500/10',
      activeRing: 'ring-emerald-500/50',
    },
    {
      key: 'feedback' as const,
      title: 'Feedback',
      value: stats.pendingFeedback,
      subtitle: 'Ausstehend',
      icon: MessageSquare,
      gradient: 'from-amber-500/10 to-amber-600/5',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-500/10',
      warning: stats.pendingFeedback > 0,
      activeRing: 'ring-amber-500/50',
    },
    {
      key: 'completed' as const,
      title: 'Diesen Monat',
      value: stats.completedMonth,
      subtitle: 'Abgeschlossen',
      icon: TrendingUp,
      gradient: 'from-purple-500/10 to-purple-600/5',
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-500/10',
      activeRing: 'ring-purple-500/50',
    },
  ];

  const handleCardClick = (cardKey: typeof cards[number]['key']) => {
    if (onFilterChange) {
      // Toggle filter if clicking the same card
      onFilterChange(activeFilter === cardKey ? null : cardKey);
    }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const isActive = activeFilter === card.key;
        const isClickable = !!onFilterChange;
        
        return (
          <button
            key={card.title}
            type="button"
            disabled={!isClickable}
            onClick={() => handleCardClick(card.key)}
            className={cn(
              "glass-card rounded-xl p-4 text-left",
              "bg-gradient-to-br", card.gradient,
              "transition-all duration-300",
              isClickable && "cursor-pointer hover:shadow-lg hover:scale-[1.02]",
              isActive && `ring-2 ${card.activeRing} shadow-lg scale-[1.02]`,
              card.warning && !isActive && "ring-2 ring-amber-500/30"
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {card.title}
                </p>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">
                    {card.value}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {card.subtitle}
                  </span>
                </div>
                {card.warning && card.value > 0 && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    ⚠️ Bitte geben
                  </p>
                )}
                {isActive && (
                  <p className="text-xs text-primary mt-1 font-medium">
                    ✓ Filter aktiv
                  </p>
                )}
              </div>
              <div className={cn(card.iconBg, "p-2.5 rounded-lg")}>
                <card.icon className={cn("h-5 w-5", card.iconColor)} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
