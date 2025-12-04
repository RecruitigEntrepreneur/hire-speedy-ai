import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DealHealthBadge } from '@/components/health/DealHealthBadge';
import { DealHealthCard } from '@/components/health/DealHealthCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  Search,
  ArrowUpDown,
  Clock,
  User,
  Briefcase,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface DealHealthWithDetails {
  id: string;
  submission_id: string;
  health_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  drop_off_probability: number;
  days_since_last_activity: number;
  bottleneck: string | null;
  bottleneck_days: number;
  ai_assessment: string | null;
  recommended_actions: string[];
  risk_factors: string[];
  calculated_at: string;
  candidate_name?: string;
  job_title?: string;
  company_name?: string;
  submission_status?: string;
}

type SortField = 'health_score' | 'days_since_last_activity' | 'bottleneck_days' | 'calculated_at';
type SortOrder = 'asc' | 'desc';

export default function AdminDealHealth() {
  const [deals, setDeals] = useState<DealHealthWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealHealthWithDetails | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();

  // Filters
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('health_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  useEffect(() => {
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    setLoading(true);
    try {
      // First fetch deal_health data
      const { data: healthData, error: healthError } = await supabase
        .from('deal_health')
        .select('*')
        .order('health_score', { ascending: true });

      if (healthError) throw healthError;

      if (!healthData || healthData.length === 0) {
        setDeals([]);
        return;
      }

      // Get submission IDs
      const submissionIds = healthData.map(d => d.submission_id);

      // Fetch submissions with candidate and job details
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          candidate_id,
          job_id
        `)
        .in('id', submissionIds);

      if (submissionsError) throw submissionsError;

      // Get unique candidate and job IDs
      const candidateIds = [...new Set(submissionsData?.map(s => s.candidate_id).filter(Boolean))];
      const jobIds = [...new Set(submissionsData?.map(s => s.job_id).filter(Boolean))];

      // Fetch candidates
      const { data: candidatesData } = await supabase
        .from('candidates')
        .select('id, full_name')
        .in('id', candidateIds);

      // Fetch jobs
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, title, company_name')
        .in('id', jobIds);

      // Create lookup maps
      const candidatesMap = new Map(candidatesData?.map(c => [c.id, c]) || []);
      const jobsMap = new Map(jobsData?.map(j => [j.id, j]) || []);
      const submissionsMap = new Map(submissionsData?.map(s => [s.id, s]) || []);

      // Combine data
      const enrichedDeals: DealHealthWithDetails[] = healthData.map(health => {
        const submission = submissionsMap.get(health.submission_id);
        const candidate = submission?.candidate_id ? candidatesMap.get(submission.candidate_id) : null;
        const job = submission?.job_id ? jobsMap.get(submission.job_id) : null;

        return {
          ...health,
          health_score: health.health_score ?? 50,
          risk_level: (health.risk_level as 'low' | 'medium' | 'high' | 'critical') ?? 'medium',
          drop_off_probability: health.drop_off_probability ?? 0,
          days_since_last_activity: health.days_since_last_activity ?? 0,
          bottleneck_days: health.bottleneck_days ?? 0,
          recommended_actions: (health.recommended_actions as string[]) || [],
          risk_factors: (health.risk_factors as string[]) || [],
          candidate_name: candidate?.full_name || 'Unbekannt',
          job_title: job?.title || 'Unbekannt',
          company_name: job?.company_name || '',
          submission_status: submission?.status || 'unknown',
        };
      });

      // Filter out completed submissions
      const activeDeals = enrichedDeals.filter(d => 
        !['rejected', 'withdrawn', 'placed'].includes(d.submission_status || '')
      );

      setDeals(activeDeals);
    } catch (error) {
      console.error('Error fetching deal health:', error);
      toast({
        title: 'Fehler',
        description: 'Konnte Deal Health Daten nicht laden',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshDealHealth = async (submissionId?: string) => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('deal-health', {
        body: submissionId 
          ? { submission_id: submissionId }
          : { calculate_all: true },
      });

      if (error) throw error;

      toast({
        title: 'Erfolgreich',
        description: submissionId 
          ? 'Deal Health wurde neu berechnet'
          : 'Alle Deal Health Scores wurden aktualisiert',
      });

      await fetchDeals();
    } catch (error) {
      console.error('Error refreshing deal health:', error);
      toast({
        title: 'Fehler',
        description: 'Konnte Deal Health nicht aktualisieren',
        variant: 'destructive',
      });
    } finally {
      setRefreshing(false);
    }
  };

  const getBottleneckLabel = (bottleneck: string | null): string => {
    if (!bottleneck) return '-';
    const labels: Record<string, string> = {
      'candidate_response': 'Kandidaten-Antwort',
      'client_review': 'Kunden-Review',
      'interview_scheduling': 'Interview-Planung',
      'offer_pending': 'Angebot ausstehend',
      'recruiter_action': 'Recruiter-Aktion',
      'client_decision': 'Kunden-Entscheidung',
    };
    return labels[bottleneck] || bottleneck;
  };

  const getRiskColor = (level: string): string => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-amber-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskBgColor = (level: string): string => {
    switch (level) {
      case 'low': return 'bg-green-100 dark:bg-green-900/30';
      case 'medium': return 'bg-amber-100 dark:bg-amber-900/30';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/30';
      case 'critical': return 'bg-red-100 dark:bg-red-900/30';
      default: return 'bg-muted';
    }
  };

  // Filter and sort deals
  const filteredDeals = deals
    .filter(deal => {
      if (riskFilter !== 'all' && deal.risk_level !== riskFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          deal.candidate_name?.toLowerCase().includes(query) ||
          deal.job_title?.toLowerCase().includes(query) ||
          deal.company_name?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'health_score':
          comparison = a.health_score - b.health_score;
          break;
        case 'days_since_last_activity':
          comparison = a.days_since_last_activity - b.days_since_last_activity;
          break;
        case 'bottleneck_days':
          comparison = a.bottleneck_days - b.bottleneck_days;
          break;
        case 'calculated_at':
          comparison = new Date(a.calculated_at).getTime() - new Date(b.calculated_at).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  const criticalCount = deals.filter(d => d.risk_level === 'critical').length;
  const highCount = deals.filter(d => d.risk_level === 'high').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DashboardLayout>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Deal Health</h1>
              <p className="text-muted-foreground">
                Überwache den Gesundheitszustand aller aktiven Deals
              </p>
            </div>
            <Button 
              onClick={() => refreshDealHealth()} 
              disabled={refreshing}
              variant="outline"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Alle aktualisieren
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamt Deals</p>
                    <p className="text-2xl font-bold">{deals.length}</p>
                  </div>
                  <Briefcase className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-500/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Kritisch</p>
                    <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
            <Card className="border-orange-500/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Hoch</p>
                    <p className="text-2xl font-bold text-orange-600">{highCount}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ø Health Score</p>
                    <p className="text-2xl font-bold">
                      {deals.length > 0 
                        ? Math.round(deals.reduce((sum, d) => sum + d.health_score, 0) / deals.length)
                        : 0}%
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche nach Kandidat, Job oder Firma..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={riskFilter} onValueChange={setRiskFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Risikostufe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Risikostufen</SelectItem>
                    <SelectItem value="critical">Kritisch</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="medium">Mittel</SelectItem>
                    <SelectItem value="low">Niedrig</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sortieren nach" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="health_score">Health Score</SelectItem>
                    <SelectItem value="days_since_last_activity">Inaktivität</SelectItem>
                    <SelectItem value="bottleneck_days">Bottleneck-Dauer</SelectItem>
                    <SelectItem value="calculated_at">Zuletzt berechnet</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Deals Table */}
          <Card>
            <CardHeader>
              <CardTitle>Aktive Deals ({filteredDeals.length})</CardTitle>
              <CardDescription>
                Alle aktiven Submissions mit Health Tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredDeals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Deals gefunden
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kandidat</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Risiko</TableHead>
                      <TableHead>Bottleneck</TableHead>
                      <TableHead>Inaktiv</TableHead>
                      <TableHead>Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeals.map((deal) => (
                      <TableRow key={deal.id} className="cursor-pointer hover:bg-accent/50">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{deal.candidate_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{deal.job_title}</p>
                            <p className="text-xs text-muted-foreground">{deal.company_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DealHealthBadge 
                            score={deal.health_score} 
                            riskLevel={deal.risk_level} 
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getRiskBgColor(deal.risk_level)} ${getRiskColor(deal.risk_level)} border-0`}>
                            {deal.risk_level === 'critical' ? 'Kritisch' :
                             deal.risk_level === 'high' ? 'Hoch' :
                             deal.risk_level === 'medium' ? 'Mittel' : 'Niedrig'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{getBottleneckLabel(deal.bottleneck)}</p>
                            {deal.bottleneck_days > 0 && (
                              <p className="text-xs text-muted-foreground">
                                seit {deal.bottleneck_days} Tagen
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className={deal.days_since_last_activity > 3 ? 'text-amber-600' : ''}>
                              {deal.days_since_last_activity} Tage
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedDeal(deal);
                                setDetailOpen(true);
                              }}
                            >
                              Details
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                refreshDealHealth(deal.submission_id);
                              }}
                              disabled={refreshing}
                            >
                              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            </Button>
                            <Link to={`/dashboard/candidates/${deal.submission_id}`}>
                              <Button variant="ghost" size="sm">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Deal Health Details
                {selectedDeal && (
                  <DealHealthBadge 
                    score={selectedDeal.health_score} 
                    riskLevel={selectedDeal.risk_level}
                    size="sm"
                  />
                )}
              </DialogTitle>
            </DialogHeader>
            {selectedDeal && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Kandidat</p>
                    <p className="font-medium">{selectedDeal.candidate_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Job</p>
                    <p className="font-medium">{selectedDeal.job_title}</p>
                    <p className="text-sm text-muted-foreground">{selectedDeal.company_name}</p>
                  </div>
                </div>
                
                <DealHealthCard 
                  health={{
                    ...selectedDeal,
                    bottleneck_user_id: null,
                    calculated_at: selectedDeal.calculated_at || new Date().toISOString(),
                  }}
                  onRefresh={() => refreshDealHealth(selectedDeal.submission_id)}
                  loading={refreshing}
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </div>
  );
}
