import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, User, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RoleSummaryCardProps {
  roleSummary: string | null;
  idealCandidate: string | null;
  mustHaves: string[] | null;
  niceToHaves: string[] | null;
  isAIGenerated?: boolean;
}

export function RoleSummaryCard({ 
  roleSummary, 
  idealCandidate,
  mustHaves,
  niceToHaves,
  isAIGenerated = false
}: RoleSummaryCardProps) {
  return (
    <div className="space-y-4">
      {/* Role Summary */}
      {roleSummary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5 text-primary" />
              Die Rolle
              {isAIGenerated && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI-aufbereitet
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {roleSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Ideal Candidate */}
      {idealCandidate && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-5 w-5 text-primary" />
              Idealer Kandidat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {idealCandidate}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Must-Haves & Nice-to-Haves */}
      {(mustHaves?.length || niceToHaves?.length) && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Must-Haves */}
              {mustHaves && mustHaves.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold mb-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    Must-Haves
                  </h4>
                  <ul className="space-y-2">
                    {mustHaves.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Nice-to-Haves */}
              {niceToHaves && niceToHaves.length > 0 && (
                <div>
                  <h4 className="flex items-center gap-2 text-sm font-semibold mb-3">
                    <Circle className="h-4 w-4 text-blue-500" />
                    Nice-to-Haves
                  </h4>
                  <ul className="space-y-2">
                    {niceToHaves.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Circle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
