import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Building2, Users, Mail, Flame, Check, Zap, AlertCircle, CircleDot } from "lucide-react";
import { CompanyWithLeads } from "@/hooks/useOutreachCompanies";

interface CompanyListCardProps {
  company: CompanyWithLeads;
  onClick: () => void;
}

export function CompanyListCard({ company, onClick }: CompanyListCardProps) {
  const liveJobs = (company.live_jobs as any[]) || [];
  const jobCount = liveJobs.length;
  const hasContacts = company.leads_count > 0;

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
    if (!hasContacts) {
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600 gap-1">
          <AlertCircle className="h-3 w-3" />
          Kontakte fehlen
        </Badge>
      );
    }
    
    switch (company.outreach_status) {
      case 'in_kontakt':
        return <Badge variant="outline" className="text-blue-600 border-blue-600">In Kontakt</Badge>;
      case 'qualifiziert':
        return <Badge variant="outline" className="text-green-600 border-green-600">Qualifiziert</Badge>;
      case 'deal_gewonnen':
        return <Badge variant="outline" className="text-green-600 border-green-600 bg-green-50">Deal ✓</Badge>;
      case 'verloren':
        return <Badge variant="outline" className="text-muted-foreground">Verloren</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Neu</Badge>;
    }
  };

  // Contact status summary
  const getContactStatusSummary = () => {
    if (!hasContacts) return null;
    
    const warmScore = company.warm_score || 0;
    if (warmScore >= 80) {
      return <span className="text-green-600">🟢 Warm</span>;
    }
    if (warmScore >= 40) {
      return <span className="text-yellow-600">🟡 In Bearbeitung</span>;
    }
    return <span className="text-muted-foreground">⚪ Nicht kontaktiert</span>;
  };

  return (
    <Card 
      className={`p-4 hover:bg-accent/50 cursor-pointer transition-colors ${!hasContacts ? 'border-yellow-200 bg-yellow-50/30' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${hasContacts ? 'bg-muted' : 'bg-yellow-100'}`}>
            <Building2 className={`h-6 w-6 ${hasContacts ? 'text-muted-foreground' : 'text-yellow-600'}`} />
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
          <div className="flex items-center gap-4 text-sm">
            <div className={`flex items-center gap-1 ${hasContacts ? 'text-muted-foreground' : 'text-yellow-600 font-medium'}`}>
              <Users className="h-4 w-4" />
              {company.leads_count || 0} Kontakte
            </div>
            {hasContacts && (
              <div className="flex items-center gap-1 text-sm">
                {getContactStatusSummary()}
              </div>
            )}
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
