import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Building2, 
  RefreshCw, 
  Flame, 
  CheckCircle2, 
  AlertCircle,
  Plus
} from 'lucide-react';
import { 
  useCompaniesWithLeadCounts, 
  useCompanyStats,
  useCrawlCompanyData,
  useCrawlCompaniesBulk,
  CompanyWithLeads
} from '@/hooks/useOutreachCompanies';
import { CompanyCard } from './CompanyCard';
import { CompanyDetailSheet } from './CompanyDetailSheet';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CompaniesTabProps {
  onGenerateEmail?: (leadId: string) => void;
}

export function CompaniesTab({ onGenerateEmail }: CompaniesTabProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [crawlingCompanyId, setCrawlingCompanyId] = useState<string | null>(null);

  const { data: companies, isLoading } = useCompaniesWithLeadCounts();
  const { data: stats } = useCompanyStats();
  const crawlMutation = useCrawlCompanyData();
  const bulkCrawlMutation = useCrawlCompaniesBulk();

  const filteredCompanies = useMemo(() => {
    if (!companies) return [];

    return companies.filter((company) => {
      // Search filter
      const matchesSearch = 
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.domain.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.industry?.toLowerCase().includes(searchTerm.toLowerCase());

      // Activity filter
      const matchesActivity = 
        activityFilter === 'all' || company.hiring_activity === activityFilter;

      return matchesSearch && matchesActivity;
    });
  }, [companies, searchTerm, activityFilter]);

  const handleCrawlCompany = async (companyId: string) => {
    setCrawlingCompanyId(companyId);
    try {
      await crawlMutation.mutateAsync(companyId);
    } finally {
      setCrawlingCompanyId(null);
    }
  };

  const handleBulkCrawl = async () => {
    if (selectedCompanyIds.length === 0) return;
    await bulkCrawlMutation.mutateAsync(selectedCompanyIds);
    setSelectedCompanyIds([]);
  };

  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanyIds(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const selectAllFiltered = () => {
    if (selectedCompanyIds.length === filteredCompanies.length) {
      setSelectedCompanyIds([]);
    } else {
      setSelectedCompanyIds(filteredCompanies.map(c => c.id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Gesamt</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-500">{stats?.hot || 0}</p>
                <p className="text-xs text-muted-foreground">Hot (10+ Jobs)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-500">{stats?.active || 0}</p>
                <p className="text-xs text-muted-foreground">Aktiv (5-9)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-yellow-500">{stats?.low || 0}</p>
                <p className="text-xs text-muted-foreground">Wenig (1-4)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.unknown || 0}</p>
                <p className="text-xs text-muted-foreground">Nicht geprüft</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Unternehmen suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Alle Aktivitäten" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="hot">🔥 Hot</SelectItem>
            <SelectItem value="active">✅ Aktiv</SelectItem>
            <SelectItem value="low">⚡ Wenig</SelectItem>
            <SelectItem value="none">Keine Jobs</SelectItem>
            <SelectItem value="unknown">Nicht geprüft</SelectItem>
          </SelectContent>
        </Select>

        {selectedCompanyIds.length > 0 && (
          <Button 
            onClick={handleBulkCrawl}
            disabled={bulkCrawlMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${bulkCrawlMutation.isPending ? 'animate-spin' : ''}`} />
            {selectedCompanyIds.length} crawlen
          </Button>
        )}
      </div>

      {/* Selection header */}
      {filteredCompanies.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedCompanyIds.length === filteredCompanies.length && filteredCompanies.length > 0}
            onCheckedChange={selectAllFiltered}
          />
          <span className="text-sm text-muted-foreground">
            {selectedCompanyIds.length > 0 
              ? `${selectedCompanyIds.length} ausgewählt`
              : `${filteredCompanies.length} Unternehmen`
            }
          </span>
        </div>
      )}

      {/* Companies List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCompanies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm || activityFilter !== 'all' 
                ? 'Keine Unternehmen gefunden'
                : 'Noch keine Unternehmen. Importieren Sie Leads um automatisch Unternehmen zu erstellen.'
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCompanies.map((company) => (
            <div key={company.id} className="flex items-start gap-3">
              <Checkbox
                checked={selectedCompanyIds.includes(company.id)}
                onCheckedChange={() => toggleCompanySelection(company.id)}
                className="mt-4"
              />
              <div className="flex-1">
                <CompanyCard
                  company={company}
                  onSelect={() => navigate(`/admin/outreach/company/${company.id}`)}
                  onCrawl={() => handleCrawlCompany(company.id)}
                  isCrawling={crawlingCompanyId === company.id}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Company Detail Sheet */}
      <CompanyDetailSheet
        companyId={selectedCompanyId}
        open={!!selectedCompanyId}
        onOpenChange={(open) => !open && setSelectedCompanyId(null)}
        onGenerateEmail={onGenerateEmail}
      />
    </div>
  );
}
