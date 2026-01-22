import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Percent, Euro } from "lucide-react";

interface FeeCalculatorCardProps {
  feePercentage: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
}

export function FeeCalculatorCard({ 
  feePercentage, 
  salaryMin, 
  salaryMax 
}: FeeCalculatorCardProps) {
  const fee = feePercentage || 15;
  
  const calculateEarning = (salary: number) => {
    return Math.round(salary * (fee / 100));
  };

  const minEarning = salaryMin ? calculateEarning(salaryMin) : null;
  const maxEarning = salaryMax ? calculateEarning(salaryMax) : null;
  
  // Use average for display
  const avgEarning = minEarning && maxEarning 
    ? Math.round((minEarning + maxEarning) / 2)
    : maxEarning || minEarning;

  return (
    <Card className="border-green-500/20 bg-gradient-to-br from-green-50/50 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-green-700 dark:text-green-400">
          <Euro className="h-5 w-5" />
          Dein Verdienst
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Earning Display */}
        {avgEarning ? (
          <div className="text-center py-2">
            <span className="text-3xl font-bold text-green-700 dark:text-green-400">
              €{avgEarning.toLocaleString('de-DE')}
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              Dein Verdienst bei erfolgreicher Vermittlung
            </p>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground italic py-4">
            Gehalt nicht angegeben
          </p>
        )}

        {/* Details */}
        {avgEarning && (
          <div className="pt-3 border-t border-green-200 dark:border-green-800 space-y-2">
            {/* Salary Range */}
            {(salaryMin || salaryMax) && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Gehaltsspanne
                </span>
                <span className="font-medium">
                  {formatSalaryRange(salaryMin, salaryMax)}
                </span>
              </div>
            )}
            
            {/* Fee Percentage as secondary info */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-1">
                <Percent className="h-4 w-4" />
                Fee
              </span>
              <span className="font-medium">{fee}%</span>
            </div>

            {/* Earning Range if different */}
            {minEarning && maxEarning && minEarning !== maxEarning && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Range: €{minEarning.toLocaleString('de-DE')} - €{maxEarning.toLocaleString('de-DE')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatSalaryRange(min: number | null, max: number | null): string {
  if (min && max) {
    return `€${(min / 1000).toFixed(0)}k - €${(max / 1000).toFixed(0)}k`;
  }
  if (max) {
    return `bis €${(max / 1000).toFixed(0)}k`;
  }
  if (min) {
    return `ab €${(min / 1000).toFixed(0)}k`;
  }
  return "k.A.";
}
