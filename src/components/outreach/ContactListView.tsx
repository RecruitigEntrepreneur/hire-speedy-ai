import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Search, Users, Mail, Sparkles, Building2, 
  Filter, X, ChevronRight, Loader2 
} from "lucide-react";
import { useFilteredLeads, FilteredLead } from "@/hooks/useFilteredLeads";
import { GenerateEmailsDialog } from "./GenerateEmailsDialog";
import { CompanyDetailDialog } from "./CompanyDetailDialog";
import { useOutreachCampaigns } from "@/hooks/useOutreach";
import { cn } from "@/lib/utils";

export function ContactListView() {
  const { 
    leads, 
    isLoading, 
    filters, 
    filterOptions, 
    updateFilter, 
    resetFilters 
  } = useFilteredLeads();
  const { data: campaigns = [] } = useOutreachCampaigns();
  
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  const hasActiveFilters = 
    filters.search || 
    filters.roles.length > 0 || 
    filters.decisionLevels.length > 0 ||
    filters.functionalAreas.length > 0 ||
    filters.outreachStatuses.length > 0;

  const toggleLead = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const toggleAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)));
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'geantwortet':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Geantwortet</Badge>;
      case 'geöffnet':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Geöffnet</Badge>;
      case 'kontaktiert':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Kontaktiert</Badge>;
      default:
        return <Badge variant="secondary">Neu</Badge>;
    }
  };

  const getDecisionLevelBadge = (level: string | null) => {
    switch (level) {
      case 'entscheider':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Entscheider</Badge>;
      case 'influencer':
        return <Badge variant="outline">Influencer</Badge>;
      case 'gatekeeper':
        return <Badge variant="secondary">Gatekeeper</Badge>;
      default:
        return null;
    }
  };

  // Convert filtered leads to the format expected by GenerateEmailsDialog
  const leadsForDialog = leads
    .filter(l => selectedLeads.has(l.id))
    .map(l => ({
      id: l.id,
      contact_name: l.contact_name || `${l.first_name || ''} ${l.last_name || ''}`.trim(),
      company_name: l.company_name || '',
      status: l.contact_outreach_status === 'kontaktiert' ? 'contacted' : 'new',
      hiring_signals: null,
      job_change_data: null,
      company_technologies: null,
    }));

  return (
    <div className="space-y-4">
      {/* Header with stats and actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Kontakte</h2>
          <Badge variant="secondary">{leads.length}</Badge>
        </div>
        
        {selectedLeads.size > 0 && (
          <Button onClick={() => setGenerateDialogOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            {selectedLeads.size} E-Mails generieren
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Suche nach Name, E-Mail, Position, Company..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Select
            value={filters.roles[0] || '__all__'}
            onValueChange={(v) => updateFilter('roles', v === '__all__' ? [] : [v])}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Rolle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Rollen</SelectItem>
              {filterOptions.roles.filter(r => r && r.trim()).map(role => (
                <SelectItem key={role} value={role}>{role}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.decisionLevels[0] || '__all__'}
            onValueChange={(v) => updateFilter('decisionLevels', v === '__all__' ? [] : [v])}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Level</SelectItem>
              {filterOptions.decisionLevels.filter(l => l && l.trim()).map(level => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.functionalAreas[0] || '__all__'}
            onValueChange={(v) => updateFilter('functionalAreas', v === '__all__' ? [] : [v])}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Bereich" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Bereiche</SelectItem>
              {filterOptions.functionalAreas.filter(a => a && a.trim()).map(area => (
                <SelectItem key={area} value={area}>{area}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.outreachStatuses[0] || '__all__'}
            onValueChange={(v) => updateFilter('outreachStatuses', v === '__all__' ? [] : [v])}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Alle Status</SelectItem>
              {filterOptions.outreachStatuses.filter(s => s && s.trim()).map(status => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="icon" onClick={resetFilters}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Selection bar */}
      {leads.length > 0 && (
        <div className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded-lg">
          <Checkbox 
            checked={selectedLeads.size === leads.length && leads.length > 0}
            onCheckedChange={toggleAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedLeads.size > 0 
              ? `${selectedLeads.size} ausgewählt` 
              : `Alle auswählen (${leads.length})`}
          </span>
        </div>
      )}

      {/* Lead list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Keine Kontakte gefunden</p>
          <p className="text-sm">
            {hasActiveFilters 
              ? "Versuche andere Filter oder setze sie zurück" 
              : "Importiere Kontakte über den Import-Button"}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-2">
            {leads.map((lead) => (
              <Card
                key={lead.id}
                className={cn(
                  "p-3 cursor-pointer transition-all hover:shadow-md",
                  selectedLeads.has(lead.id) && "ring-2 ring-primary/50 bg-primary/5"
                )}
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedLeads.has(lead.id)}
                    onCheckedChange={() => toggleLead(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  
                  <div className="flex-1 min-w-0" onClick={() => toggleLead(lead.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {lead.contact_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unbekannt'}
                      </span>
                      {lead.contact_role && (
                        <span className="text-sm text-muted-foreground">{lead.contact_role}</span>
                      )}
                      {getDecisionLevelBadge(lead.decision_level)}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      {lead.contact_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {lead.contact_email}
                        </span>
                      )}
                      {lead.company_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {lead.company_name}
                        </span>
                      )}
                      {lead.industry && (
                        <Badge variant="outline" className="text-xs">{lead.industry}</Badge>
                      )}
                      {lead.company_city && (
                        <span className="text-xs">{lead.company_city}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(lead.contact_outreach_status)}
                    {lead.company_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCompanyId(lead.company_id);
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Generate Emails Dialog */}
      <GenerateEmailsDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        leads={leadsForDialog as any}
        campaigns={campaigns}
        preSelectedLeadIds={Array.from(selectedLeads)}
      />

      {/* Company Detail Dialog */}
      <CompanyDetailDialog
        companyId={selectedCompanyId}
        onClose={() => setSelectedCompanyId(null)}
      />
    </div>
  );
}
