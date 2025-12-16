import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPin, Calendar, Users, TrendingUp, DollarSign, Star, Laptop, Award, BarChart3 } from "lucide-react";

interface OverviewTabProps {
  company: any;
}

export function OverviewTab({ company }: OverviewTabProps) {
  const technologies = company.technologies as string[] | null;
  const investors = company.investors as string[] | null;
  const awards = company.awards as string[] | null;
  const liveJobs = company.live_jobs as any[] | null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Left Column */}
      <div className="space-y-4">
        {/* Company Data */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Firmendaten
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Branche</span>
              <span className="font-medium">{company.industry || "–"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Stadt</span>
              <span className="font-medium">{company.city || "–"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Land</span>
              <span className="font-medium">{company.country || "–"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Gegründet</span>
              <span className="font-medium">{company.founding_year || "–"}</span>
            </div>
            {company.description && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground leading-relaxed">{company.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financials */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Finanzen & Größe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Mitarbeiter</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{company.headcount || "–"}</span>
                {company.headcount_growth && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {company.headcount_growth}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Umsatz</span>
              <span className="font-medium">{company.revenue_range || "–"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Funding Stage</span>
              <span className="font-medium">{company.funding_stage || "–"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Funding</span>
              <span className="font-medium">{company.funding_total || "–"}</span>
            </div>
            {investors && investors.length > 0 && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground text-xs block mb-2">Investoren</span>
                <div className="flex flex-wrap gap-1">
                  {investors.map((inv, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{inv}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ratings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" />
              Bewertungen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Kununu</span>
              <div className="flex items-center gap-1">
                {company.kununu_score ? (
                  <>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{company.kununu_score}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Glassdoor</span>
              <div className="flex items-center gap-1">
                {company.glassdoor_score ? (
                  <>
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium">{company.glassdoor_score}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column */}
      <div className="space-y-4">
        {/* Tech Stack */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Laptop className="h-4 w-4 text-primary" />
              Tech-Stack
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {technologies && technologies.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {technologies.map((tech, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{tech}</Badge>
                ))}
              </div>
            ) : (
              <span className="text-muted-foreground">Keine Technologien hinterlegt</span>
            )}
            {company.cloud_provider && (
              <div className="flex justify-between pt-2 border-t">
                <span className="text-muted-foreground">Cloud</span>
                <span className="font-medium">{company.cloud_provider}</span>
              </div>
            )}
            {company.dev_tools && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dev Tools</span>
                <span className="font-medium">{company.dev_tools}</span>
              </div>
            )}
            {company.marketing_tools && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Marketing</span>
                <span className="font-medium">{company.marketing_tools}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Culture & Awards */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Kultur & Awards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remote Policy</span>
              <span className="font-medium">{company.remote_policy || "–"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kultur</span>
              <span className="font-medium">{company.company_culture || "–"}</span>
            </div>
            {awards && awards.length > 0 && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground text-xs block mb-2">Auszeichnungen</span>
                <div className="flex flex-wrap gap-1">
                  {awards.map((award, i) => (
                    <Badge key={i} className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                      🏆 {award}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scores */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Scores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Intelligence Score</span>
              <Badge variant="secondary">{company.intelligence_score || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Priority Score</span>
              <Badge variant="secondary">{company.priority_score || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Warm Score</span>
              <Badge variant="secondary">{company.warm_score || 0}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Platform Fit</span>
              <Badge variant="secondary">{company.platform_fit_score || 0}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
