import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, Briefcase, Building2, MapPin, Euro } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Job {
  id: string;
  title: string;
  company_name: string;
  location: string | null;
  status: string | null;
  salary_min: number | null;
  salary_max: number | null;
  created_at: string;
  submissionCount: number;
}

export default function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    const { data: jobData, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && jobData) {
      // Get submission counts
      const { data: submissionData } = await supabase
        .from('submissions')
        .select('job_id');

      const submissionCounts = submissionData?.reduce((acc, sub) => {
        acc[sub.job_id] = (acc[sub.job_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const jobsWithCounts = jobData.map(job => ({
        ...job,
        submissionCount: submissionCounts[job.id] || 0,
      }));

      setJobs(jobsWithCounts);
    }
    setLoading(false);
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    setProcessing(jobId);
    
    const { error } = await supabase
      .from('jobs')
      .update({ status: newStatus })
      .eq('id', jobId);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success('Status aktualisiert');
      fetchJobs();
    }
    setProcessing(null);
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      draft: { label: 'Entwurf', variant: 'outline' },
      published: { label: 'Veröffentlicht', variant: 'default' },
      closed: { label: 'Geschlossen', variant: 'secondary' },
      paused: { label: 'Pausiert', variant: 'destructive' },
    };
    const statusConfig = config[status || 'draft'] || config.draft;
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = 
      job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return '-';
    if (min && max) return `${(min/1000).toFixed(0)}k - ${(max/1000).toFixed(0)}k €`;
    if (min) return `ab ${(min/1000).toFixed(0)}k €`;
    if (max) return `bis ${(max/1000).toFixed(0)}k €`;
    return '-';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Alle Jobs</h1>
            <p className="text-muted-foreground mt-1">
              Übersicht aller Stellenangebote
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{jobs.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Veröffentlicht</CardTitle>
                <Briefcase className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {jobs.filter(j => j.status === 'published').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entwürfe</CardTitle>
                <Briefcase className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {jobs.filter(j => j.status === 'draft').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Submissions</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {jobs.reduce((sum, j) => sum + j.submissionCount, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Titel oder Firma..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="published">Veröffentlicht</SelectItem>
                <SelectItem value="paused">Pausiert</SelectItem>
                <SelectItem value="closed">Geschlossen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Jobs Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Position</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Standort</TableHead>
                    <TableHead>Gehalt</TableHead>
                    <TableHead>Submissions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Keine Jobs gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">
                          {job.title}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {job.company_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.location ? (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {job.location}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {formatSalary(job.salary_min, job.salary_max)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{job.submissionCount}</Badge>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(job.status)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(job.created_at), 'PP', { locale: de })}
                        </TableCell>
                        <TableCell>
                          <Select 
                            value={job.status || 'draft'} 
                            onValueChange={(value) => handleStatusChange(job.id, value)}
                            disabled={processing === job.id}
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="draft">Entwurf</SelectItem>
                              <SelectItem value="published">Veröffentlichen</SelectItem>
                              <SelectItem value="paused">Pausieren</SelectItem>
                              <SelectItem value="closed">Schließen</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
