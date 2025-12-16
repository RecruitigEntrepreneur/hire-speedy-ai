import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Globe, 
  Linkedin, 
  Users, 
  RefreshCw,
  Flame,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useCompanyWithLeads, useCrawlCompanyData } from '@/hooks/useOutreachCompanies';
import { useUpdateCompanyOutreach } from '@/hooks/useCompanyOutreach';
import { CompanyOverviewTab } from '@/components/outreach/CompanyOverviewTab';
import { CompanyContactsTab } from '@/components/outreach/CompanyContactsTab';
import { CompanyOutreachTab } from '@/components/outreach/CompanyOutreachTab';
import { CompanyJobsTab } from '@/components/outreach/CompanyJobsTab';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

export default function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data, isLoading } = useCompanyWithLeads(companyId || null);
  const crawlMutation = useCrawlCompanyData();
  const updateMutation = useUpdateCompanyOutreach();

  const company = data?.company;
  const leads = data?.leads || [];

  const getOutreachStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'in_kontakt':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">In Kontakt</Badge>;
      case 'qualifiziert':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Qualifiziert</Badge>;
      case 'deal_gewonnen':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Deal Gewonnen</Badge>;
      case 'verloren':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Verloren</Badge>;
      default:
        return <Badge variant="outline">Unberührt</Badge>;
    }
  };

  const getHiringBadge = () => {
    switch (company?.hiring_activity) {
      case 'hot':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><Flame className="h-3 w-3 mr-1" /> Hot</Badge>;
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" /> Aktiv</Badge>;
      case 'low':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Wenig</Badge>;
      default:
        return <Badge variant="outline">Nicht geprüft</Badge>;
    }
  };

  const handleStatusChange = (newStatus: string) => {
    if (companyId) {
      updateMutation.mutate({ id: companyId, outreach_status: newStatus });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!company) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unternehmen nicht gefunden</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/outreach')}>
            Zurück zur Übersicht
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/admin/outreach')}
              className="mt-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              
              <div>
                <h1 className="text-2xl font-bold">{company.name}</h1>
                <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                  <span>{company.domain}</span>
                  {company.city && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {company.city}
                      </span>
                    </>
                  )}
                  {company.headcount && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {company.headcount} MA
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => crawlMutation.mutate(company.id)}
              disabled={crawlMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${crawlMutation.isPending ? 'animate-spin' : ''}`} />
              Aktualisieren
            </Button>
            {company.website && (
              <Button variant="outline" size="sm" asChild>
                <a href={company.website} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-4 w-4 mr-2" />
                  Website
                </a>
              </Button>
            )}
            {company.linkedin_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-4 w-4 mr-2" />
                  LinkedIn
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Status Row */}
        <div className="flex items-center gap-3 flex-wrap">
          {getOutreachStatusBadge(company.outreach_status)}
          {getHiringBadge()}
          {company.industry && <Badge variant="secondary">{company.industry}</Badge>}
          {company.live_jobs_count && company.live_jobs_count > 0 && (
            <Badge variant="outline">{company.live_jobs_count} offene Stellen</Badge>
          )}
          {company.warm_score && company.warm_score > 0 && (
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
              Warm Score: {company.warm_score}
            </Badge>
          )}
          {company.last_activity_at && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Letzte Aktivität: {formatDistanceToNow(new Date(company.last_activity_at), { addSuffix: true, locale: de })}
            </span>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="contacts">
              Kontakte ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="outreach">Outreach & Timeline</TabsTrigger>
            <TabsTrigger value="jobs">Jobs & Signale</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <CompanyOverviewTab 
              company={company} 
              leads={leads}
              onStatusChange={handleStatusChange}
            />
          </TabsContent>

          <TabsContent value="contacts">
            <CompanyContactsTab 
              company={company} 
              leads={leads}
            />
          </TabsContent>

          <TabsContent value="outreach">
            <CompanyOutreachTab 
              company={company} 
              leads={leads}
            />
          </TabsContent>

          <TabsContent value="jobs">
            <CompanyJobsTab company={company} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
