import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, TrendingDown, Minus, Calendar, Users, 
  DollarSign, Building2, Sparkles
} from "lucide-react";

interface CompanyIntelligenceCardProps {
  company: {
    revenue_range?: string | null;
    revenue_trend?: string | null;
    employee_growth?: string | null;
    founding_year?: number | null;
    headcount?: number | null;
    description?: string | null;
    intelligence_score?: number | null;
  };
}

export function CompanyIntelligenceCard({ company }: CompanyIntelligenceCardProps) {
  const getTrendIcon = (trend: string | null | undefined) => {
    switch (trend) {
      case 'growing':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendLabel = (trend: string | null | undefined) => {
    switch (trend) {
      case 'growing':
        return 'steigend ↗';
      case 'declining':
        return 'fallend ↘';
      case 'stable':
        return 'stabil →';
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-muted-foreground';
  };

  const hasData = company.revenue_range || company.headcount || company.founding_year || company.employee_growth;

  if (!hasData) {
    return null;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Wirtschaftsdaten
        </h3>
        {company.intelligence_score !== null && company.intelligence_score !== undefined && (
          <Badge variant="outline" className="gap-1">
            <Sparkles className="h-3 w-3" />
            <span className={getScoreColor(company.intelligence_score)}>
              {company.intelligence_score}
            </span>
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        {company.revenue_range && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Umsatz
            </span>
            <span className="flex items-center gap-2">
              €{company.revenue_range}
              {company.revenue_trend && (
                <>
                  {getTrendIcon(company.revenue_trend)}
                  <span className="text-xs text-muted-foreground">
                    ({getTrendLabel(company.revenue_trend)})
                  </span>
                </>
              )}
            </span>
          </div>
        )}

        {company.headcount && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Mitarbeiter
            </span>
            <span className="flex items-center gap-2">
              {company.headcount.toLocaleString()}
              {company.employee_growth && (
                <span className={`text-xs ${
                  company.employee_growth.startsWith('+') ? 'text-green-500' : 
                  company.employee_growth.startsWith('-') ? 'text-red-500' : 'text-muted-foreground'
                }`}>
                  ({company.employee_growth} YoY)
                </span>
              )}
            </span>
          </div>
        )}

        {company.founding_year && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Gegründet
            </span>
            <span>{company.founding_year}</span>
          </div>
        )}

        {company.description && (
          <p className="text-sm text-muted-foreground pt-2 border-t">
            {company.description}
          </p>
        )}
      </div>
    </Card>
  );
}
