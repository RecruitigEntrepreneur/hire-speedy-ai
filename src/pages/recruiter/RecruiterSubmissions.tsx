import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Search,
  Briefcase,
  User,
  Clock,
  Calendar,
  MessageSquare,
  ArrowRight,
  Filter
} from 'lucide-react';

interface Submission {
  id: string;
  status: string;
  submitted_at: string;
  updated_at: string;
  recruiter_notes: string;
  client_notes: string;
  rejection_reason: string;
  job_id: string;
  candidate_id: string;
  jobs: {
    id: string;
    title: string;
    company_name: string;
  };
  candidates: {
    id: string;
    full_name: string;
    email: string;
  };
  interviews: {
    id: string;
    scheduled_at: string;
    status: string;
  }[];
}

const STATUS_COLUMNS = [
  { key: 'submitted', label: 'Eingereicht', color: 'bg-blue-500' },
  { key: 'reviewing', label: 'In Prüfung', color: 'bg-amber-500' },
  { key: 'interview_scheduled', label: 'Interview geplant', color: 'bg-purple-500' },
  { key: 'interviewed', label: 'Interview geführt', color: 'bg-indigo-500' },
  { key: 'offer', label: 'Angebot', color: 'bg-emerald-500' },
  { key: 'hired', label: 'Eingestellt', color: 'bg-green-600' },
  { key: 'rejected', label: 'Abgelehnt', color: 'bg-destructive' },
];

export default function RecruiterSubmissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          jobs (id, title, company_name),
          candidates (id, full_name, email),
          interviews (id, scheduled_at, status)
        `)
        .eq('recruiter_id', user?.id)
        .order('submitted_at', { ascending: false });

      if (!error && data) {
        setSubmissions(data as any);
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    const matchesSearch = 
      sub.candidates?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.jobs?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.jobs?.company_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getSubmissionsByStatus = (status: string) => {
    return filteredSubmissions.filter(sub => sub.status === status);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Heute';
    if (diffDays === 1) return 'Gestern';
    if (diffDays < 7) return `Vor ${diffDays} Tagen`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = STATUS_COLUMNS.find(s => s.key === status);
    return (
      <Badge className={`${statusConfig?.color || 'bg-muted'} text-white`}>
        {statusConfig?.label || status}
      </Badge>
    );
  };

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Meine Pipeline</h1>
              <p className="text-muted-foreground">
                {submissions.length} Kandidaten in Bearbeitung
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'kanban' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('kanban')}
              >
                Kanban
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                Liste
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Kandidat, Job oder Firma..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {viewMode === 'list' && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {STATUS_COLUMNS.map((status) => (
                    <SelectItem key={status.key} value={status.key}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Kanban View */}
          {viewMode === 'kanban' && (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                {STATUS_COLUMNS.map((column) => {
                  const columnSubmissions = getSubmissionsByStatus(column.key);
                  return (
                    <div key={column.key} className="w-72 flex-shrink-0">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`h-3 w-3 rounded-full ${column.color}`} />
                        <h3 className="font-semibold">{column.label}</h3>
                        <Badge variant="secondary" className="ml-auto">
                          {columnSubmissions.length}
                        </Badge>
                      </div>
                      <div className="space-y-3">
                        {columnSubmissions.map((sub) => (
                          <Card key={sub.id} className="cursor-pointer hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium">{sub.candidates?.full_name}</p>
                                    <p className="text-sm text-muted-foreground">{sub.candidates?.email}</p>
                                  </div>
                                </div>
                                <Link to={`/recruiter/jobs/${sub.job_id}`}>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <Briefcase className="h-3 w-3" />
                                    <span className="truncate">{sub.jobs?.title}</span>
                                  </div>
                                </Link>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatDate(sub.updated_at)}</span>
                                </div>
                                {sub.client_notes && (
                                  <div className="flex items-start gap-2 text-xs bg-muted/50 p-2 rounded">
                                    <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                                    <span className="line-clamp-2">{sub.client_notes}</span>
                                  </div>
                                )}
                                {sub.interviews && sub.interviews.length > 0 && (
                                  <div className="flex items-center gap-2 text-xs text-purple-600">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      Interview: {new Date(sub.interviews[0].scheduled_at).toLocaleDateString('de-DE')}
                                    </span>
                                  </div>
                                )}
                                {sub.rejection_reason && (
                                  <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                                    {sub.rejection_reason}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {columnSubmissions.length === 0 && (
                          <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                            Keine Kandidaten
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <Card>
              <CardContent className="p-0">
                {filteredSubmissions.length === 0 ? (
                  <div className="text-center py-16">
                    <User className="mx-auto h-12 w-12 text-muted-foreground/50" />
                    <h3 className="mt-4 text-lg font-semibold">Keine Einreichungen</h3>
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'Versuche andere Filter'
                        : 'Reiche deinen ersten Kandidaten ein'}
                    </p>
                    <Link to="/recruiter/jobs">
                      <Button className="mt-4">
                        Jobs durchsuchen <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredSubmissions.map((sub) => (
                      <div key={sub.id} className="p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-gradient-navy flex items-center justify-center text-primary-foreground font-medium">
                              {sub.candidates?.full_name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <p className="font-medium">{sub.candidates?.full_name}</p>
                              <p className="text-sm text-muted-foreground">{sub.candidates?.email}</p>
                            </div>
                          </div>
                          <div className="hidden md:block text-right">
                            <Link to={`/recruiter/jobs/${sub.job_id}`} className="font-medium hover:underline">
                              {sub.jobs?.title}
                            </Link>
                            <p className="text-sm text-muted-foreground">{sub.jobs?.company_name}</p>
                          </div>
                          <div className="hidden lg:block text-sm text-muted-foreground">
                            {formatDate(sub.updated_at)}
                          </div>
                          {getStatusBadge(sub.status)}
                        </div>
                        {sub.client_notes && (
                          <div className="mt-3 ml-14 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
                            <span className="font-medium">Feedback:</span> {sub.client_notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </div>
  );
}