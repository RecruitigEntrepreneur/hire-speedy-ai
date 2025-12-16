import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Building2, Users, CheckCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CompanyListCard } from "./CompanyListCard";
import { CompanyDetailDialog } from "./CompanyDetailDialog";
import { useCompaniesWithLeadCounts } from "@/hooks/useOutreachCompanies";
import { SmartImportDialog } from "./SmartImportDialog";
import { QuickAddCompanyDialog } from "./QuickAddCompanyDialog";

export function CompanyListView() {
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [filter, setFilter] = useState<'all' | 'needs_contacts' | 'ready'>('all');
  const { data: companies, isLoading } = useCompaniesWithLeadCounts();

  const filteredCompanies = companies?.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.industry?.toLowerCase().includes(search.toLowerCase());
    
    if (filter === 'needs_contacts') {
      return matchesSearch && (c.leads_count === 0);
    }
    if (filter === 'ready') {
      return matchesSearch && (c.leads_count > 0);
    }
    return matchesSearch;
  }) || [];

  // Sort by priority: hot first, then by live_jobs count
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    const aJobs = (a.live_jobs as any[])?.length || 0;
    const bJobs = (b.live_jobs as any[])?.length || 0;
    if (a.hiring_activity === 'hot' && b.hiring_activity !== 'hot') return -1;
    if (b.hiring_activity === 'hot' && a.hiring_activity !== 'hot') return 1;
    return bJobs - aJobs;
  });

  // Stats
  const stats = {
    total: companies?.length || 0,
    needsContacts: companies?.filter(c => c.leads_count === 0).length || 0,
    ready: companies?.filter(c => c.leads_count > 0).length || 0,
  };

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
          className="gap-2"
        >
          <Building2 className="h-4 w-4" />
          Alle ({stats.total})
        </Button>
        <Button
          variant={filter === 'needs_contacts' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('needs_contacts')}
          className="gap-2"
        >
          <Users className="h-4 w-4 text-yellow-500" />
          Kontakte fehlen ({stats.needsContacts})
        </Button>
        <Button
          variant={filter === 'ready' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('ready')}
          className="gap-2"
        >
          <CheckCircle className="h-4 w-4 text-green-500" />
          Bereit ({stats.ready})
        </Button>
      </div>

      {/* Search & Actions */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Unternehmen suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" onClick={() => setShowQuickAdd(true)}>
          <Sparkles className="h-4 w-4 mr-2" />
          Quick Add
        </Button>
        <Button onClick={() => setShowImport(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Importieren
        </Button>
      </div>

      {/* Company List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Laden...</div>
      ) : sortedCompanies.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Keine Unternehmen gefunden
        </div>
      ) : (
        <div className="space-y-3">
          {sortedCompanies.map((company) => (
            <CompanyListCard
              key={company.id}
              company={company}
              onClick={() => setSelectedCompanyId(company.id)}
            />
          ))}
        </div>
      )}

      {/* Company Detail Dialog */}
      <CompanyDetailDialog
        companyId={selectedCompanyId}
        onClose={() => setSelectedCompanyId(null)}
      />

      {/* Quick Add Dialog */}
      <QuickAddCompanyDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        onSuccess={(id) => setSelectedCompanyId(id)}
      />

      {/* Smart Import Dialog */}
      <SmartImportDialog
        open={showImport}
        onOpenChange={setShowImport}
      />
    </div>
  );
}
