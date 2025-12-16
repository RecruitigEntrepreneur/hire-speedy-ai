import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, ExternalLink, Flame, MapPin, Clock, Building2 } from "lucide-react";

interface JobsTabProps {
  company: any;
}

export function JobsTab({ company }: JobsTabProps) {
  const liveJobs = (company.live_jobs as any[]) || [];
  const jobCategories = company.job_categories as string[] | null;

  const getHiringBadge = (activity: string | null) => {
    switch (activity) {
      case 'hot':
        return <Badge className="bg-red-500 text-white"><Flame className="h-3 w-3 mr-1" /> HOT</Badge>;
      case 'warm':
        return <Badge className="bg-orange-500 text-white">WARM</Badge>;
      case 'cold':
        return <Badge variant="secondary">COLD</Badge>;
      default:
        return <Badge variant="outline">Unbekannt</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Hiring Activity Header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Hiring Activity</span>
              {getHiringBadge(company.hiring_activity)}
            </div>
            {company.career_page_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={company.career_page_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Karriereseite
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Job Categories */}
      {jobCategories && jobCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Job-Kategorien</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {jobCategories.map((cat, i) => (
                <Badge key={i} variant="outline">{cat}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            Offene Stellen ({liveJobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {liveJobs.length > 0 ? (
            <div className="space-y-3">
              {liveJobs.map((job, i) => (
                <div 
                  key={i} 
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => job.url && window.open(job.url, '_blank')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{job.title || 'Unbenannte Stelle'}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {job.location}
                          </span>
                        )}
                        {job.department && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {job.department}
                          </span>
                        )}
                        {job.posted_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(job.posted_at).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    </div>
                    {job.url && (
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Keine offenen Stellen gefunden</p>
              <p className="text-sm mt-1">Karriereseite crawlen für aktuelle Jobs</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
