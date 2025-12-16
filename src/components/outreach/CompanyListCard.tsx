import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, Users, Mail, Flame, Check, Zap } from "lucide-react";
import { CompanyWithLeads } from "@/hooks/useOutreachCompanies";

interface CompanyListCardProps {
  company: CompanyWithLeads;
  onClick: () => void;
}

export function CompanyListCard({ company, onClick }: CompanyListCardProps) {
  const liveJobs = (company.live_jobs as any[]) || [];
  const jobCount = liveJobs.length;

  const getHiringBadge = () => {
    if (company.hiring_activity === 'hot' || jobCount >= 10) {
      return (
        <Badge variant="destructive" className="gap-1">
          <Flame className="h-3 w-3" />
          Hot
        </Badge>
      );
    }
    if (company.hiring_activity === 'active' || jobCount >= 5) {
      return (
        <Badge variant="default" className="gap-1">
          <Zap className="h-3 w-3" />
          Aktiv
        </Badge>
      );
    }
    if (jobCount > 0) {
      return (
        <Badge variant="secondary" className="gap-1">
          <Check className="h-3 w-3" />
          Hiring
        </Badge>
      );
    }
    return null;
  };

  const getStatusBadge = () => {
    switch (company.outreach_status) {
      case 'in_kontakt':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">In Kontakt</Badge>;
      case 'qualifiziert':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Qualifiziert</Badge>;
      case 'deal_gewonnen':
        return <Badge variant="outline" className="text-green-600 border-green-600">Deal</Badge>;
      case 'verloren':
        return <Badge variant="outline" className="text-muted-foreground">Verloren</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card 
      className="p-4 hover:bg-accent/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{company.name}</h3>
              {getHiringBadge()}
              {getStatusBadge()}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              {company.industry && <span>{company.industry}</span>}
              {company.city && <span>· {company.city}</span>}
              {jobCount > 0 && <span>· {jobCount} offene Stellen</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {company.leads_count || 0} Kontakte
            </div>
            <div className="flex items-center gap-1">
              <Mail className="h-4 w-4" />
              {company.warm_score || 0}% warm
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}>
            Details
          </Button>
        </div>
      </div>
    </Card>
  );
}
