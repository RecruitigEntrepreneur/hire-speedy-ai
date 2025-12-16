import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Lightbulb, Star, RefreshCw, Briefcase, TrendingUp, 
  UserPlus, Rocket, Code, Target
} from "lucide-react";
import { useGenerateCompanyInsights } from "@/hooks/useCompanyEnrichment";
import { useState, useEffect } from "react";

interface Insight {
  id: string;
  type: 'hiring' | 'funding' | 'management' | 'expansion' | 'news' | 'tech';
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  weight: number;
  outreach_angle?: string;
  relevant_roles?: string[];
}

interface InsightsPanelProps {
  companyId: string;
  liveJobs?: any[];
  recentNews?: any[];
  technologies?: string[];
  initialScore?: number;
}

export function InsightsPanel({ 
  companyId, 
  liveJobs = [], 
  recentNews = [], 
  technologies = [],
  initialScore = 0
}: InsightsPanelProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [score, setScore] = useState(initialScore);
  const generateInsights = useGenerateCompanyInsights();

  // Generate insights on mount
  useEffect(() => {
    if (companyId) {
      handleGenerateInsights();
    }
  }, [companyId]);

  const handleGenerateInsights = async () => {
    try {
      const result = await generateInsights.mutateAsync(companyId);
      setInsights(result.insights);
      setScore(result.score);
    } catch (error) {
      console.error('Failed to generate insights:', error);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'hiring':
        return <Briefcase className="h-4 w-4" />;
      case 'funding':
        return <TrendingUp className="h-4 w-4" />;
      case 'management':
        return <UserPlus className="h-4 w-4" />;
      case 'expansion':
        return <Rocket className="h-4 w-4" />;
      case 'tech':
        return <Code className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const getStars = (weight: number) => {
    if (weight >= 70) return 3;
    if (weight >= 40) return 2;
    return 1;
  };

  const getAngleLabel = (angle?: string) => {
    const angleMap: Record<string, string> = {
      'talent_pipeline': 'Talent Pipeline',
      'tech_talent': 'Tech Recruiting',
      'scaling': 'Skalierung',
      'new_leadership': 'Neues Management',
      'efficiency': 'Effizienz',
    };
    return angle ? angleMap[angle] || angle : null;
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          AI-Insights
        </h3>
        <div className="flex items-center gap-2">
          {score > 0 && (
            <Badge variant="outline" className="gap-1">
              Score: <span className={score >= 70 ? 'text-green-500' : score >= 40 ? 'text-yellow-500' : ''}>{score}</span>
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleGenerateInsights}
            disabled={generateInsights.isPending}
          >
            <RefreshCw className={`h-4 w-4 ${generateInsights.isPending ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {insights.length === 0 && !generateInsights.isPending ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Keine Insights verfügbar. Crawlen Sie das Unternehmen für mehr Daten.
        </p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight) => (
            <div 
              key={insight.id} 
              className={`p-3 rounded-lg border ${
                insight.importance === 'high' 
                  ? 'bg-green-500/5 border-green-500/20' 
                  : insight.importance === 'medium'
                    ? 'bg-yellow-500/5 border-yellow-500/20'
                    : 'bg-muted/50 border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {getInsightIcon(insight.type)}
                  </span>
                  <span className="font-medium text-sm">{insight.title}</span>
                </div>
                <div className="flex items-center text-yellow-500">
                  {Array.from({ length: getStars(insight.weight) }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" />
                  ))}
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-1 ml-6">
                {insight.description}
              </p>

              {insight.outreach_angle && (
                <div className="mt-2 ml-6">
                  <Badge variant="secondary" className="text-xs">
                    Angle: {getAngleLabel(insight.outreach_angle)}
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
