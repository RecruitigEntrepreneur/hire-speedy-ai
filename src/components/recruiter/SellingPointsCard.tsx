import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Sparkles } from "lucide-react";

interface SellingPointsCardProps {
  sellingPoints: string[] | null;
  highlights?: string[] | null;
}

export function SellingPointsCard({ sellingPoints, highlights }: SellingPointsCardProps) {
  // Combine selling points and highlights, prioritizing selling points
  const allPoints = [
    ...(sellingPoints || []),
    ...(highlights || [])
  ].filter((item, index, arr) => arr.indexOf(item) === index); // Dedupe
  
  if (allPoints.length === 0) return null;

  return (
    <Card className="border-amber-500/20 bg-gradient-to-br from-amber-50/50 to-yellow-50/30 dark:from-amber-950/20 dark:to-yellow-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
          <Star className="h-5 w-5" />
          Selling Points
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {allPoints.slice(0, 5).map((point, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{point}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
