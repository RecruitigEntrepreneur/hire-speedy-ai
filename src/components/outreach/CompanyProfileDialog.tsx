import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Globe, Linkedin, Briefcase, ExternalLink, Users, MapPin, Flame } from "lucide-react";
import { OverviewTab } from "./company-profile/OverviewTab";
import { ContactsTab } from "./company-profile/ContactsTab";
import { JobsTab } from "./company-profile/JobsTab";
import { IntelligenceTab } from "./company-profile/IntelligenceTab";

interface CompanyProfileDialogProps {
  companyId: string | null;
  onClose: () => void;
}

export function CompanyProfileDialog({ companyId, onClose }: CompanyProfileDialogProps) {
  const { data: company, isLoading } = useQuery({
    queryKey: ['company-profile', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_companies')
        .select('*')
        .eq('id', companyId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: leadsCount } = useQuery({
    queryKey: ['company-leads-count', companyId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('outreach_leads')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'in_contact': return <Badge className="bg-green-500">In Kontakt</Badge>;
      case 'qualified': return <Badge className="bg-blue-500">Qualifiziert</Badge>;
      case 'nurturing': return <Badge className="bg-yellow-500">Nurturing</Badge>;
      case 'cold': return <Badge variant="secondary">Cold</Badge>;
      default: return <Badge variant="outline">Neu</Badge>;
    }
  };

  const getHiringBadge = (activity: string | null) => {
    switch (activity) {
      case 'hot': return <Badge className="bg-red-500 text-white"><Flame className="h-3 w-3 mr-1" />HOT</Badge>;
      case 'warm': return <Badge className="bg-orange-500 text-white">WARM</Badge>;
      default: return null;
    }
  };

  const getDomainInitials = (domain: string) => {
    return domain.replace('www.', '').split('.')[0].slice(0, 2).toUpperCase();
  };

  const liveJobsCount = (company?.live_jobs as any[])?.length || 0;

  return (
    <Dialog open={!!companyId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Laden...</div>
        ) : company ? (
          <>
            {/* Header */}
            <DialogHeader className="pb-4 border-b">
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xl font-bold">
                    {company.domain ? getDomainInitials(company.domain) : <Building2 className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  {/* Domain as primary identifier */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-primary">{company.domain || 'Keine Domain'}</span>
                    {getHiringBadge(company.hiring_activity)}
                  </div>
                  
                  {/* Company name */}
                  <DialogTitle className="text-xl mb-2">{company.name}</DialogTitle>
                  
                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {company.industry && <span>{company.industry}</span>}
                    {company.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {company.city}{company.country && `, ${company.country}`}
                      </span>
                    )}
                    {company.headcount && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {company.headcount} MA
                      </span>
                    )}
                    {getStatusBadge(company.outreach_status)}
                  </div>
                </div>

                {/* Quick Links */}
                <div className="flex items-center gap-2">
                  {company.website && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={company.website} target="_blank" rel="noopener noreferrer">
                        <Globe className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {company.linkedin_url && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {company.career_page_url && (
                    <Button variant="outline" size="icon" asChild>
                      <a href={company.career_page_url} target="_blank" rel="noopener noreferrer">
                        <Briefcase className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent">
                <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                  Übersicht
                </TabsTrigger>
                <TabsTrigger value="contacts" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                  Kontakte ({leadsCount})
                </TabsTrigger>
                <TabsTrigger value="jobs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                  Jobs ({liveJobsCount})
                </TabsTrigger>
                <TabsTrigger value="intelligence" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                  Intelligence
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto py-4">
                <TabsContent value="overview" className="mt-0">
                  <OverviewTab company={company} />
                </TabsContent>
                <TabsContent value="contacts" className="mt-0">
                  <ContactsTab companyId={company.id} />
                </TabsContent>
                <TabsContent value="jobs" className="mt-0">
                  <JobsTab company={company} />
                </TabsContent>
                <TabsContent value="intelligence" className="mt-0">
                  <IntelligenceTab company={company} />
                </TabsContent>
              </div>
            </Tabs>
          </>
        ) : (
          <div className="py-12 text-center text-muted-foreground">Unternehmen nicht gefunden</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
