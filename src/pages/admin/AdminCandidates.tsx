import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Loader2, Search, Users, FileText, MoreHorizontal, Eye, Trash2, 
  AlertTriangle, Copy, StickyNote, RefreshCw, Mail, Phone, Briefcase,
  Lock, Unlock, Shield, Clock, History
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useIdentityUnlock } from '@/hooks/useIdentityUnlock';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  recruiter_id: string;
  recruiter_name: string | null;
  created_at: string;
  skills: string[] | null;
  submissions: {
    id: string;
    job_title: string;
    status: string;
    company_name: string;
    identity_unlocked: boolean;
    opt_in_response: string | null;
    unlocked_at: string | null;
  }[];
  isDuplicate: boolean;
}

interface UnlockLog {
  id: string;
  submission_id: string;
  action: string;
  performed_by: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Eingereicht' },
  { value: 'screening', label: 'Screening' },
  { value: 'interview', label: 'Interview' },
  { value: 'second_interview', label: '2. Interview' },
  { value: 'offer', label: 'Angebot' },
  { value: 'hired', label: 'Eingestellt' },
  { value: 'rejected', label: 'Abgelehnt' },
];

export default function AdminCandidates() {
  const { user } = useAuth();
  const { adminOverride, fetchUnlockLogs } = useIdentityUnlock();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [unlockLogs, setUnlockLogs] = useState<UnlockLog[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    // Get all candidates
    const { data: candidatesData } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });

    if (!candidatesData) {
      setLoading(false);
      return;
    }

    // Get recruiter names
    const recruiterIds = [...new Set(candidatesData.map(c => c.recruiter_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', recruiterIds);

    const recruiterMap = profilesData?.reduce((acc, p) => {
      acc[p.user_id] = p.full_name;
      return acc;
    }, {} as Record<string, string | null>) || {};

    // Get submissions for each candidate
    const candidateIds = candidatesData.map(c => c.id);
    const { data: submissionsData } = await supabase
      .from('submissions')
      .select('id, candidate_id, status, identity_unlocked, opt_in_response, unlocked_at, job:jobs(title, company_name)')
      .in('candidate_id', candidateIds);

    const submissionMap: Record<string, any[]> = {};
    submissionsData?.forEach((s: any) => {
      if (!submissionMap[s.candidate_id]) {
        submissionMap[s.candidate_id] = [];
      }
      submissionMap[s.candidate_id].push({
        id: s.id,
        job_title: s.job?.title || 'Unbekannt',
        company_name: s.job?.company_name || 'Unbekannt',
        status: s.status,
        identity_unlocked: s.identity_unlocked || false,
        opt_in_response: s.opt_in_response,
        unlocked_at: s.unlocked_at,
      });
    });

    // Detect duplicates by email
    const emailCounts: Record<string, number> = {};
    candidatesData.forEach(c => {
      if (c.email) {
        const email = c.email.toLowerCase();
        emailCounts[email] = (emailCounts[email] || 0) + 1;
      }
    });

    const candidatesWithData = candidatesData.map(c => ({
      ...c,
      recruiter_name: recruiterMap[c.recruiter_id] || null,
      submissions: submissionMap[c.id] || [],
      isDuplicate: emailCounts[c.email?.toLowerCase()] > 1,
    }));

    setCandidates(candidatesWithData);
    setLoading(false);
  };

  const handleDeleteCandidate = async () => {
    if (!selectedCandidate) return;
    
    setProcessing(selectedCandidate.id);
    
    // Delete submissions first
    await supabase
      .from('submissions')
      .delete()
      .eq('candidate_id', selectedCandidate.id);
    
    // Then delete candidate
    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', selectedCandidate.id);

    if (error) {
      toast.error('Fehler beim Löschen');
    } else {
      toast.success('Kandidat gelöscht');
      fetchCandidates();
    }
    
    setProcessing(null);
    setDeleteDialogOpen(false);
    setSelectedCandidate(null);
  };

  const handleUpdateSubmissionStatus = async (submissionId: string, newStatus: string) => {
    const { error } = await supabase
      .from('submissions')
      .update({ status: newStatus, stage: newStatus })
      .eq('id', submissionId);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success('Status aktualisiert');
      fetchCandidates();
    }
  };

  const handleAdminOverride = async () => {
    if (!selectedSubmissionId || !overrideReason.trim()) {
      toast.error('Bitte geben Sie einen Grund ein');
      return;
    }
    
    setProcessing('override');
    const success = await adminOverride(selectedSubmissionId, overrideReason);
    if (success) {
      fetchCandidates();
      setOverrideDialogOpen(false);
      setSelectedSubmissionId(null);
      setOverrideReason('');
    }
    setProcessing(null);
  };

  const loadUnlockLogs = async (submissionId: string) => {
    const logs = await fetchUnlockLogs(submissionId);
    setUnlockLogs(logs);
  };

  const getIdentityStatusBadge = (sub: { identity_unlocked: boolean; opt_in_response: string | null }) => {
    if (sub.identity_unlocked) {
      return (
        <Badge variant="outline" className="text-emerald border-emerald/30">
          <Unlock className="h-3 w-3 mr-1" />
          Freigegeben
        </Badge>
      );
    }
    if (sub.opt_in_response === 'pending') {
      return (
        <Badge variant="outline" className="text-amber-500 border-amber-500/30">
          <Clock className="h-3 w-3 mr-1" />
          Anfrage offen
        </Badge>
      );
    }
    if (sub.opt_in_response === 'denied') {
      return (
        <Badge variant="outline" className="text-destructive border-destructive/30">
          <Lock className="h-3 w-3 mr-1" />
          Abgelehnt
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Lock className="h-3 w-3 mr-1" />
        Geschützt
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      submitted: { variant: 'secondary', label: 'Eingereicht' },
      screening: { variant: 'outline', label: 'Screening' },
      interview: { variant: 'default', label: 'Interview' },
      second_interview: { variant: 'default', label: '2. Interview' },
      offer: { variant: 'default', label: 'Angebot' },
      hired: { variant: 'default', label: 'Eingestellt' },
      rejected: { variant: 'destructive', label: 'Abgelehnt' },
    };
    const config = statusConfig[status] || { variant: 'outline', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filteredCandidates = candidates.filter(c => {
    const matchesSearch = 
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.recruiter_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      c.submissions.some(s => s.status === statusFilter);
    
    const matchesDuplicates = !duplicatesOnly || c.isDuplicate;
    
    return matchesSearch && matchesStatus && matchesDuplicates;
  });

  const duplicateCount = candidates.filter(c => c.isDuplicate).length;

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
              <h1 className="text-3xl font-bold">Kandidatenverwaltung</h1>
              <p className="text-muted-foreground mt-1">
                Alle Kandidaten systemweit verwalten
              </p>
            </div>
            <Button variant="outline" onClick={fetchCandidates}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Aktualisieren
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{candidates.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Submissions</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {candidates.reduce((sum, c) => sum + c.submissions.length, 0)}
                </div>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer ${duplicatesOnly ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setDuplicatesOnly(!duplicatesOnly)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Duplikate</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{duplicateCount}</div>
                <p className="text-xs text-muted-foreground">Klicken zum Filtern</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Eingestellt</CardTitle>
                <Briefcase className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {candidates.filter(c => c.submissions.some(s => s.status === 'hired')).length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche nach Name, E-Mail oder Recruiter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status filtern" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Candidates Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kandidat</TableHead>
                    <TableHead>Recruiter</TableHead>
                    <TableHead>Jobs / Status</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCandidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Keine Kandidaten gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCandidates.map((candidate) => (
                      <TableRow key={candidate.id} className={candidate.isDuplicate ? 'bg-yellow-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {candidate.isDuplicate && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500" />
                            )}
                            <div>
                              <p className="font-medium">{candidate.full_name}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {candidate.email}
                              </div>
                              {candidate.phone && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {candidate.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{candidate.recruiter_name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          {candidate.submissions.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Keine Submissions</span>
                          ) : (
                            <div className="space-y-1">
                              {candidate.submissions.slice(0, 2).map(sub => (
                                <div key={sub.id} className="flex items-center gap-2">
                                  <span className="text-sm truncate max-w-[150px]">{sub.job_title}</span>
                                  {getStatusBadge(sub.status)}
                                </div>
                              ))}
                              {candidate.submissions.length > 2 && (
                                <span className="text-xs text-muted-foreground">
                                  +{candidate.submissions.length - 2} weitere
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(candidate.created_at), 'PP', { locale: de })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedCandidate(candidate);
                                setDetailOpen(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Details ansehen
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedCandidate(candidate);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Löschen
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

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kandidat Details</DialogTitle>
            </DialogHeader>
            {selectedCandidate && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedCandidate.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">E-Mail</p>
                    <p className="font-medium">{selectedCandidate.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefon</p>
                    <p className="font-medium">{selectedCandidate.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recruiter</p>
                    <p className="font-medium">{selectedCandidate.recruiter_name || '-'}</p>
                  </div>
                </div>

                {selectedCandidate.skills && selectedCandidate.skills.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedCandidate.skills.map((skill, idx) => (
                        <Badge key={idx} variant="secondary">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Tabs defaultValue="submissions" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="submissions">Submissions</TabsTrigger>
                    <TabsTrigger value="audit">Audit Trail</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="submissions" className="mt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Submissions ({selectedCandidate.submissions.length})
                    </p>
                    {selectedCandidate.submissions.length === 0 ? (
                      <p className="text-muted-foreground">Keine Submissions</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedCandidate.submissions.map(sub => (
                          <div key={sub.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-medium">{sub.job_title}</p>
                                <p className="text-sm text-muted-foreground">{sub.company_name}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                {getIdentityStatusBadge(sub)}
                                <Select 
                                  value={sub.status} 
                                  onValueChange={(val) => handleUpdateSubmissionStatus(sub.id, val)}
                                >
                                  <SelectTrigger className="w-[130px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {STATUS_OPTIONS.map(opt => (
                                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            {/* Admin Override Button */}
                            {!sub.identity_unlocked && (
                              <div className="mt-2 pt-2 border-t flex items-center justify-between">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Shield className="h-3 w-3" />
                                  Admin-Ansicht: Vollständige Daten sichtbar
                                </span>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSubmissionId(sub.id);
                                    setOverrideDialogOpen(true);
                                  }}
                                >
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Override
                                </Button>
                              </div>
                            )}
                            
                            {sub.unlocked_at && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Freigegeben am: {format(new Date(sub.unlocked_at), 'Pp', { locale: de })}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="audit" className="mt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Audit Trail</p>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            if (selectedCandidate.submissions[0]) {
                              loadUnlockLogs(selectedCandidate.submissions[0].id);
                            }
                          }}
                        >
                          <History className="h-4 w-4 mr-1" />
                          Laden
                        </Button>
                      </div>
                      {unlockLogs.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-4 text-center">
                          Klicken Sie auf "Laden" um die Audit-Logs zu sehen
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {unlockLogs.map(log => (
                            <div key={log.id} className="p-2 border rounded text-sm">
                              <div className="flex items-center justify-between">
                                <Badge variant={
                                  log.action === 'opt_in_approved' ? 'default' :
                                  log.action === 'admin_override' ? 'secondary' :
                                  log.action === 'opt_in_denied' ? 'destructive' : 'outline'
                                }>
                                  {log.action === 'opt_in_requested' && 'Anfrage gesendet'}
                                  {log.action === 'opt_in_approved' && 'Genehmigt'}
                                  {log.action === 'opt_in_denied' && 'Abgelehnt'}
                                  {log.action === 'admin_override' && 'Admin Override'}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(log.created_at), 'Pp', { locale: de })}
                                </span>
                              </div>
                              {log.details && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {JSON.stringify(log.details)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Admin Override Dialog */}
        <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                Admin Override - Identität freigeben
              </DialogTitle>
              <DialogDescription>
                Sie sind dabei, die Identität dieses Kandidaten manuell freizugeben.
                Dies umgeht den normalen Opt-In-Prozess und wird protokolliert.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="override-reason">Begründung (Pflichtfeld)</Label>
                <Textarea
                  id="override-reason"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Warum wird diese Override-Aktion durchgeführt?"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button 
                onClick={handleAdminOverride}
                disabled={!overrideReason.trim() || processing === 'override'}
                className="bg-amber-500 hover:bg-amber-600"
              >
                {processing === 'override' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Unlock className="h-4 w-4 mr-2" />
                )}
                Override bestätigen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kandidat löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Dieser Kandidat und alle zugehörigen Submissions werden unwiderruflich gelöscht.
                {selectedCandidate && (
                  <span className="block mt-2 font-medium">
                    {selectedCandidate.full_name} ({selectedCandidate.submissions.length} Submissions)
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteCandidate}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Löschen'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    </>
  );
}