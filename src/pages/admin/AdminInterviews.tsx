import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Search, Calendar as CalendarIcon, Clock, Video, 
  MoreHorizontal, Edit, XCircle, RefreshCw, Link2, Users, CheckCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format, isPast, isToday, isFuture, startOfDay, endOfDay, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

interface Interview {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_link: string | null;
  meeting_type: string | null;
  status: string | null;
  notes: string | null;
  feedback: string | null;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  company_name: string;
  recruiter_name: string | null;
  client_name: string | null;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Ausstehend' },
  { value: 'confirmed', label: 'Bestätigt' },
  { value: 'completed', label: 'Durchgeführt' },
  { value: 'cancelled', label: 'Abgesagt' },
  { value: 'no_show', label: 'Nicht erschienen' },
];

export default function AdminInterviews() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [timeFilter, setTimeFilter] = useState<'all' | 'upcoming' | 'past' | 'today'>('all');
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    scheduled_at: '',
    meeting_link: '',
    status: '',
  });

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    const { data: interviewsData } = await supabase
      .from('interviews')
      .select(`
        *,
        submission:submissions(
          candidate:candidates(full_name, email),
          job:jobs(title, company_name, client_id),
          recruiter_id
        )
      `)
      .order('scheduled_at', { ascending: true });

    if (!interviewsData) {
      setLoading(false);
      return;
    }

    // Get recruiter and client names
    const recruiterIds = [...new Set(interviewsData.map((i: any) => i.submission?.recruiter_id).filter(Boolean))];
    const clientIds = [...new Set(interviewsData.map((i: any) => i.submission?.job?.client_id).filter(Boolean))];
    const allUserIds = [...new Set([...recruiterIds, ...clientIds])];

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', allUserIds);

    const profileMap = profilesData?.reduce((acc, p) => {
      acc[p.user_id] = p.full_name;
      return acc;
    }, {} as Record<string, string | null>) || {};

    const formattedInterviews: Interview[] = interviewsData.map((i: any) => ({
      id: i.id,
      scheduled_at: i.scheduled_at,
      duration_minutes: i.duration_minutes,
      meeting_link: i.meeting_link,
      meeting_type: i.meeting_type,
      status: i.status,
      notes: i.notes,
      feedback: i.feedback,
      candidate_name: i.submission?.candidate?.full_name || 'Unbekannt',
      candidate_email: i.submission?.candidate?.email || '',
      job_title: i.submission?.job?.title || 'Unbekannt',
      company_name: i.submission?.job?.company_name || 'Unbekannt',
      recruiter_name: profileMap[i.submission?.recruiter_id] || null,
      client_name: profileMap[i.submission?.job?.client_id] || null,
    }));

    setInterviews(formattedInterviews);
    setLoading(false);
  };

  const handleUpdateInterview = async () => {
    if (!selectedInterview) return;
    
    setProcessing(selectedInterview.id);
    
    const { error } = await supabase
      .from('interviews')
      .update({
        scheduled_at: editData.scheduled_at || null,
        meeting_link: editData.meeting_link || null,
        status: editData.status || null,
      })
      .eq('id', selectedInterview.id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success('Interview aktualisiert');
      fetchInterviews();
      setEditDialogOpen(false);
    }
    setProcessing(null);
  };

  const handleCancelInterview = async (interview: Interview) => {
    setProcessing(interview.id);
    
    const { error } = await supabase
      .from('interviews')
      .update({ status: 'cancelled' })
      .eq('id', interview.id);

    if (error) {
      toast.error('Fehler beim Stornieren');
    } else {
      toast.success('Interview storniert');
      fetchInterviews();
    }
    setProcessing(null);
  };

  const handleGenerateMeetingLink = async (interview: Interview) => {
    setProcessing(interview.id);
    
    // Generate a placeholder meeting link
    const newLink = `https://meet.example.com/${interview.id.slice(0, 8)}`;
    
    const { error } = await supabase
      .from('interviews')
      .update({ meeting_link: newLink })
      .eq('id', interview.id);

    if (error) {
      toast.error('Fehler beim Generieren');
    } else {
      toast.success('Meeting-Link generiert');
      fetchInterviews();
    }
    setProcessing(null);
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      pending: { variant: 'secondary', label: 'Ausstehend' },
      confirmed: { variant: 'default', label: 'Bestätigt' },
      completed: { variant: 'outline', label: 'Durchgeführt' },
      cancelled: { variant: 'destructive', label: 'Abgesagt' },
      no_show: { variant: 'destructive', label: 'Nicht erschienen' },
    };
    const c = config[status || 'pending'] || { variant: 'outline', label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  const filteredInterviews = interviews.filter(i => {
    const matchesSearch = 
      i.candidate_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.job_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesTime = true;
    if (i.scheduled_at) {
      const date = parseISO(i.scheduled_at);
      switch (timeFilter) {
        case 'upcoming':
          matchesTime = isFuture(date);
          break;
        case 'past':
          matchesTime = isPast(date) && !isToday(date);
          break;
        case 'today':
          matchesTime = isToday(date);
          break;
      }
    }

    let matchesDate = true;
    if (selectedDate && i.scheduled_at) {
      const interviewDate = parseISO(i.scheduled_at);
      matchesDate = interviewDate >= startOfDay(selectedDate) && interviewDate <= endOfDay(selectedDate);
    }
    
    return matchesSearch && matchesTime && matchesDate;
  });

  const upcomingCount = interviews.filter(i => i.scheduled_at && isFuture(parseISO(i.scheduled_at))).length;
  const todayCount = interviews.filter(i => i.scheduled_at && isToday(parseISO(i.scheduled_at))).length;
  const completedCount = interviews.filter(i => i.status === 'completed').length;

  if (loading) {
    return (
      <>
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Interview-Management</h1>
              <p className="text-muted-foreground mt-1">
                Alle geplanten Interviews verwalten
              </p>
            </div>
            <Button variant="outline" onClick={fetchInterviews}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Aktualisieren
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{interviews.length}</div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer ${timeFilter === 'today' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setTimeFilter(timeFilter === 'today' ? 'all' : 'today')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Heute</CardTitle>
                <Clock className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{todayCount}</div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer ${timeFilter === 'upcoming' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setTimeFilter(timeFilter === 'upcoming' ? 'all' : 'upcoming')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Kommende</CardTitle>
                <CalendarIcon className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{upcomingCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Durchgeführt</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedCount}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-4">
            {/* Calendar Sidebar */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-sm">Kalender</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  locale={de}
                  className="rounded-md border"
                />
                {selectedDate && (
                  <Button 
                    variant="ghost" 
                    className="w-full mt-2"
                    onClick={() => setSelectedDate(undefined)}
                  >
                    Filter zurücksetzen
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Interviews List */}
            <div className="lg:col-span-3 space-y-4">
              {/* Search and Filters */}
              <div className="flex gap-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Suche nach Kandidat, Job oder Firma..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Tabs value={timeFilter} onValueChange={(v) => setTimeFilter(v as any)}>
                  <TabsList>
                    <TabsTrigger value="all">Alle</TabsTrigger>
                    <TabsTrigger value="today">Heute</TabsTrigger>
                    <TabsTrigger value="upcoming">Kommende</TabsTrigger>
                    <TabsTrigger value="past">Vergangen</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Interviews Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Termin</TableHead>
                        <TableHead>Kandidat</TableHead>
                        <TableHead>Job / Kunde</TableHead>
                        <TableHead>Meeting</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInterviews.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Keine Interviews gefunden
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredInterviews.map((interview) => (
                          <TableRow key={interview.id}>
                            <TableCell>
                              {interview.scheduled_at ? (
                                <div>
                                  <p className="font-medium">
                                    {format(parseISO(interview.scheduled_at), 'PPP', { locale: de })}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(parseISO(interview.scheduled_at), 'HH:mm')} Uhr
                                    {interview.duration_minutes && ` (${interview.duration_minutes} min)`}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Nicht geplant</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{interview.candidate_name}</p>
                                <p className="text-sm text-muted-foreground">{interview.candidate_email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{interview.job_title}</p>
                                <p className="text-sm text-muted-foreground">{interview.company_name}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {interview.meeting_link ? (
                                <a 
                                  href={interview.meeting_link} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-primary hover:underline"
                                >
                                  <Video className="h-4 w-4" />
                                  <span className="text-sm">Meeting</span>
                                </a>
                              ) : (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleGenerateMeetingLink(interview)}
                                  disabled={processing === interview.id}
                                >
                                  {processing === interview.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Link2 className="mr-1 h-4 w-4" />
                                      Link erstellen
                                    </>
                                  )}
                                </Button>
                              )}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(interview.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" disabled={processing === interview.id}>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedInterview(interview);
                                    setEditData({
                                      scheduled_at: interview.scheduled_at || '',
                                      meeting_link: interview.meeting_link || '',
                                      status: interview.status || 'pending',
                                    });
                                    setEditDialogOpen(true);
                                  }}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Bearbeiten
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleGenerateMeetingLink(interview)}>
                                    <Link2 className="mr-2 h-4 w-4" />
                                    Neuen Link generieren
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleCancelInterview(interview)}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Stornieren
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Interview bearbeiten</DialogTitle>
            </DialogHeader>
            {selectedInterview && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Kandidat</p>
                  <p className="font-medium">{selectedInterview.candidate_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Job</p>
                  <p className="font-medium">{selectedInterview.job_title} - {selectedInterview.company_name}</p>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">Termin</label>
                  <Input
                    type="datetime-local"
                    value={editData.scheduled_at ? editData.scheduled_at.slice(0, 16) : ''}
                    onChange={(e) => setEditData({ ...editData, scheduled_at: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">Meeting-Link</label>
                  <Input
                    value={editData.meeting_link}
                    onChange={(e) => setEditData({ ...editData, meeting_link: e.target.value })}
                    placeholder="https://meet.example.com/..."
                  />
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground">Status</label>
                  <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Abbrechen</Button>
                  <Button onClick={handleUpdateInterview} disabled={processing === selectedInterview.id}>
                    {processing === selectedInterview.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : 'Speichern'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}