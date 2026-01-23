import { 
  Sparkles, 
  Target, 
  UserCheck, 
  Star, 
  Lightbulb 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AIInsights {
  role_type: string;
  ideal_profile: string;
  unique_selling_point: string;
  hiring_recommendation: string;
}

interface AIInsightsCardProps {
  insights: AIInsights;
}

export function AIInsightsCard({ insights }: AIInsightsCardProps) {
  if (!insights) return null;

  const insightItems = [
    { 
      icon: Target, 
      label: 'Rollentyp', 
      value: insights.role_type,
      colorClass: 'text-blue-600 dark:text-blue-400'
    },
    { 
      icon: UserCheck, 
      label: 'Ideales Profil', 
      value: insights.ideal_profile,
      colorClass: 'text-purple-600 dark:text-purple-400'
    },
    { 
      icon: Star, 
      label: 'USP der Stelle', 
      value: insights.unique_selling_point,
      colorClass: 'text-amber-600 dark:text-amber-400'
    },
    { 
      icon: Lightbulb, 
      label: 'Empfehlung', 
      value: insights.hiring_recommendation,
      colorClass: 'text-emerald-600 dark:text-emerald-400'
    },
  ];

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          KI-Analyse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insightItems.map((item, index) => {
          if (!item.value) return null;
          const Icon = item.icon;
          
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${item.colorClass}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {item.label}
                </span>
              </div>
              <p className="text-sm text-foreground pl-5">
                {item.value}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
