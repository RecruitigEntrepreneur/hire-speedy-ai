import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Star, Sparkles, FileText } from "lucide-react";

interface SellingPointsCardProps {
  sellingPoints: string[] | null;
  highlights?: string[] | null;
  onGenerateExpose?: () => void;
}

export function SellingPointsCard({ sellingPoints, highlights, onGenerateExpose }: SellingPointsCardProps) {
  // Combine selling points and highlights, prioritizing selling points
  const allPoints = [
    ...(sellingPoints || []),
    ...(highlights || [])
  ].filter((item, index, arr) => arr.indexOf(item) === index); // Dedupe
  
  if (allPoints.length === 0 && !onGenerateExpose) return null;

  return (
    <Card className="border-amber-500/20 border-l-2 border-l-amber-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="h-5 w-5 text-amber-500" />
          Selling Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {allPoints.length > 0 && (
          <ul className="space-y-2">
            {allPoints.slice(0, 5).map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-muted-foreground">{point}</span>
              </li>
            ))}
          </ul>
        )}
        {onGenerateExpose && (
          <Button variant="outline" size="sm" className="w-full" onClick={onGenerateExpose}>
            <FileText className="h-4 w-4 mr-2" />
            Anonymes Exposé generieren
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
