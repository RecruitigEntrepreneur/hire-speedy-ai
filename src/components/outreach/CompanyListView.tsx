import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus } from "lucide-react";
import { CompanyListCard } from "./CompanyListCard";
import { CompanySlimSheet } from "./CompanySlimSheet";
import { useCompaniesWithLeadCounts } from "@/hooks/useOutreachCompanies";
import { LeadImportDialog } from "./LeadImportDialog";

export function CompanyListView() {
  const [search, setSearch] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const { data: companies, isLoading } = useCompaniesWithLeadCounts();

  const filteredCompanies = companies?.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  // Sort by priority: hot first, then by live_jobs count
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    const aJobs = (a.live_jobs as any[])?.length || 0;
    const bJobs = (b.live_jobs as any[])?.length || 0;
    if (a.hiring_activity === 'hot' && b.hiring_activity !== 'hot') return -1;
    if (b.hiring_activity === 'hot' && a.hiring_activity !== 'hot') return 1;
    return bJobs - aJobs;
  });

  return (
    <div className="space-y-4">
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

      {/* Company Detail Sheet */}
      <CompanySlimSheet
        companyId={selectedCompanyId}
        onClose={() => setSelectedCompanyId(null)}
      />

      {/* Import Dialog */}
      <LeadImportDialog
        open={showImport}
        onOpenChange={setShowImport}
      />
    </div>
  );
}
