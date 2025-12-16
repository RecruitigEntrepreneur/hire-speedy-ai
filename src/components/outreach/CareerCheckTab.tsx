import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Search, RefreshCw, ExternalLink, Mail, Flame, CheckCircle, 
  MinusCircle, XCircle, HelpCircle, Loader2, Building2, MapPin,
  Briefcase, Clock
} from 'lucide-react';
import { useLeadsWithCareerData, useCrawlCareerPage, useCrawlCareerPagesBulk, useHiringActivityStats, LeadWithCareerData } from '@/hooks/useCareerCrawl';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface CareerCheckTabProps {
  onGenerateEmail?: (leadId: string) => void;
}

export function CareerCheckTab({ onGenerateEmail }: CareerCheckTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  const { data: leads, isLoading: leadsLoading } = useLeadsWithCareerData();
  const { data: stats } = useHiringActivityStats();
  const crawlSingle = useCrawlCareerPage();
  const crawlBulk = useCrawlCareerPagesBulk();

  // Filter leads
  const filteredLeads = leads?.filter(lead => {
    const matchesSearch = searchTerm === '' ||
      lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contact_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesActivity = activityFilter === 'all' || 
      lead.hiring_activity === activityFilter ||
      (activityFilter === 'pending' && (!lead.hiring_activity || lead.hiring_activity === 'unknown'));
    
    return matchesSearch && matchesActivity;
  }) || [];

  // Sort by hiring activity priority
  const sortedLeads = [...filteredLeads].sort((a, b) => {
    const priority: Record<string, number> = { hot: 0, active: 1, low: 2, none: 3, unknown: 4 };
    const aPriority = priority[a.hiring_activity || 'unknown'] ?? 4;
    const bPriority = priority[b.hiring_activity || 'unknown'] ?? 4;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (b.live_jobs_count || 0) - (a.live_jobs_count || 0);
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(sortedLeads.map(l => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const handleCrawlSelected = () => {
    if (selectedLeads.size === 0) return;
    crawlBulk.mutate({ leadIds: Array.from(selectedLeads), forceRefresh: true });
  };

  const handleCrawlAll = () => {
    const uncrawledLeads = leads?.filter(l => !l.hiring_activity || l.hiring_activity === 'unknown') || [];
    if (uncrawledLeads.length === 0) return;
    crawlBulk.mutate({ leadIds: uncrawledLeads.map(l => l.id), forceRefresh: false });
  };

  const getActivityBadge = (activity: string | null | undefined, jobCount: number | null | undefined) => {
    const count = jobCount || 0;
    
    switch (activity) {
      case 'hot':
        return (
          <Badge className="bg-orange-500 hover:bg-orange-600 text-white gap-1">
            <Flame className="h-3 w-3" />
            {count} Jobs
          </Badge>
        );
      case 'active':
        return (
          <Badge className="bg-green-500 hover:bg-green-600 text-white gap-1">
            <CheckCircle className="h-3 w-3" />
            {count} Jobs
          </Badge>
        );
      case 'low':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white gap-1">
            <MinusCircle className="h-3 w-3" />
            {count} Jobs
          </Badge>
        );
      case 'none':
        return (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            0 Jobs
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <HelpCircle className="h-3 w-3" />
            Nicht geprüft
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case 'found':
        return <Badge variant="outline" className="text-green-600 border-green-300">Gefunden</Badge>;
      case 'not_found':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-300">Nicht gefunden</Badge>;
      case 'error':
        return <Badge variant="outline" className="text-red-600 border-red-300">Fehler</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Ausstehend</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-200/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.hot || 0}</p>
                <p className="text-xs text-muted-foreground">Hot (10+ Jobs)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-200/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.active || 0}</p>
                <p className="text-xs text-muted-foreground">Active (3-9)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-200/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <MinusCircle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.low || 0}</p>
                <p className="text-xs text-muted-foreground">Low (1-2)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.none || 0}</p>
                <p className="text-xs text-muted-foreground">Keine Jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-200/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats?.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Nicht geprüft</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{stats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Gesamt</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Karriereseiten-Check
              </CardTitle>
              <CardDescription>
                Live Stellenanzeigen von Unternehmenswebsites crawlen
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suchen..."
                  className="pl-9 w-52"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={activityFilter} onValueChange={setActivityFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  <SelectItem value="hot">🔥 Hot (10+)</SelectItem>
                  <SelectItem value="active">✅ Active (3-9)</SelectItem>
                  <SelectItem value="low">🟡 Low (1-2)</SelectItem>
                  <SelectItem value="none">⚪ Keine Jobs</SelectItem>
                  <SelectItem value="pending">❓ Nicht geprüft</SelectItem>
                </SelectContent>
              </Select>
              {selectedLeads.size > 0 && (
                <Button 
                  onClick={handleCrawlSelected} 
                  disabled={crawlBulk.isPending}
                  variant="outline"
                >
                  {crawlBulk.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  {selectedLeads.size} prüfen
                </Button>
              )}
              <Button 
                onClick={handleCrawlAll} 
                disabled={crawlBulk.isPending || stats?.pending === 0}
              >
                {crawlBulk.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Alle prüfen ({stats?.pending || 0})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {leadsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedLeads.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedLeads.size === sortedLeads.length && sortedLeads.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Unternehmen</TableHead>
                    <TableHead>Karriereseite</TableHead>
                    <TableHead>Hiring-Status</TableHead>
                    <TableHead>Letzte Prüfung</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLeads.map((lead) => (
                    <>
                      <TableRow 
                        key={lead.id} 
                        className={`cursor-pointer hover:bg-muted/50 ${expandedLead === lead.id ? 'bg-muted/30' : ''}`}
                        onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedLeads.has(lead.id)}
                            onCheckedChange={(checked) => handleSelectLead(lead.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{lead.company_name}</p>
                            <p className="text-sm text-muted-foreground">{lead.contact_name} • {lead.contact_role}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lead.career_page_url ? (
                            <a 
                              href={lead.career_page_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                              {new URL(lead.career_page_url).pathname}
                            </a>
                          ) : (
                            getStatusBadge(lead.career_page_status)
                          )}
                        </TableCell>
                        <TableCell>
                          {getActivityBadge(lead.hiring_activity, lead.live_jobs_count)}
                        </TableCell>
                        <TableCell>
                          {lead.career_crawled_at ? (
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(lead.career_crawled_at), { addSuffix: true, locale: de })}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => crawlSingle.mutate(lead.id)}
                              disabled={crawlSingle.isPending}
                            >
                              {crawlSingle.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            {(lead.hiring_activity === 'hot' || lead.hiring_activity === 'active') && onGenerateEmail && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => onGenerateEmail(lead.id)}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                E-Mail
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Row with Job Details */}
                      {expandedLead === lead.id && lead.live_jobs && (lead.live_jobs as any[]).length > 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/20 p-4">
                            <div className="space-y-2">
                              <p className="text-sm font-medium mb-3">Offene Stellen:</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                {(lead.live_jobs as any[]).slice(0, 12).map((job, idx) => (
                                  <div key={idx} className="flex items-center gap-2 p-2 rounded bg-background border">
                                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-sm truncate">{job.title}</p>
                                      {job.location && (
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {job.location}
                                        </p>
                                      )}
                                    </div>
                                    {job.url && (
                                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                        <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                      </a>
                                    )}
                                  </div>
                                ))}
                              </div>
                              {(lead.live_jobs as any[]).length > 12 && (
                                <p className="text-sm text-muted-foreground mt-2">
                                  + {(lead.live_jobs as any[]).length - 12} weitere Stellen
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <h3 className="text-lg font-medium mb-2">Keine Leads gefunden</h3>
              <p>Importieren Sie Leads, um Karriereseiten zu prüfen.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
