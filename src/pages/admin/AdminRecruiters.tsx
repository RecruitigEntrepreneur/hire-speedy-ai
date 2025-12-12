import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, Search, Users, CheckCircle, XCircle, Mail, FileText, 
  MoreHorizontal, Eye, Ban, Star, AlertTriangle, Percent
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

interface Recruiter {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  verified: boolean;
  status: string;
  custom_fee_percentage: number | null;
  internal_notes: string | null;
  submissionCount: number;
  placementCount: number;
  interviewCount: number;
  placementRate: number;
  interviewRate: number;
}

export default function AdminRecruiters() {
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedRecruiter, setSelectedRecruiter] = useState<Recruiter | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [customFee, setCustomFee] = useState('');

  useEffect(() => {
    fetchRecruiters();
  }, []);

  const fetchRecruiters = async () => {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id, verified, status, custom_fee_percentage')
      .eq('role', 'recruiter');

    if (!roleData) {
      setLoading(false);
      return;
    }

    const recruiterUserIds = roleData.map(r => r.user_id);
    const roleMap = roleData.reduce((acc, r) => {
      acc[r.user_id] = {
        verified: r.verified || false,
        status: r.status || 'active',
        custom_fee_percentage: r.custom_fee_percentage
      };
      return acc;
    }, {} as Record<string, any>);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', recruiterUserIds);

    // Get submission counts
    const { data: submissionData } = await supabase
      .from('submissions')
      .select('recruiter_id, status')
      .in('recruiter_id', recruiterUserIds);

    const submissionCounts: Record<string, { total: number; interviewed: number }> = {};
    submissionData?.forEach(sub => {
      if (!submissionCounts[sub.recruiter_id]) {
        submissionCounts[sub.recruiter_id] = { total: 0, interviewed: 0 };
      }
      submissionCounts[sub.recruiter_id].total++;
      if (['interview', 'second_interview', 'offer', 'hired'].includes(sub.status || '')) {
        submissionCounts[sub.recruiter_id].interviewed++;
      }
    });

    // Get placement counts
    const { data: placementData } = await supabase
      .from('placements')
      .select('submission:submissions(recruiter_id)');

    const placementCounts: Record<string, number> = {};
    placementData?.forEach((p: any) => {
      if (p.submission?.recruiter_id) {
        placementCounts[p.submission.recruiter_id] = (placementCounts[p.submission.recruiter_id] || 0) + 1;
      }
    });

    // Get interview counts
    const { data: interviewData } = await supabase
      .from('interviews')
      .select('submission:submissions(recruiter_id)');

    const interviewCounts: Record<string, number> = {};
    interviewData?.forEach((i: any) => {
      if (i.submission?.recruiter_id) {
        interviewCounts[i.submission.recruiter_id] = (interviewCounts[i.submission.recruiter_id] || 0) + 1;
      }
    });

    const recruitersWithData = profileData?.map(profile => {
      const submissions = submissionCounts[profile.user_id]?.total || 0;
      const placements = placementCounts[profile.user_id] || 0;
      const interviews = interviewCounts[profile.user_id] || 0;
      
      return {
        ...profile,
        verified: roleMap[profile.user_id]?.verified || false,
        status: roleMap[profile.user_id]?.status || 'active',
        custom_fee_percentage: roleMap[profile.user_id]?.custom_fee_percentage,
        submissionCount: submissions,
        placementCount: placements,
        interviewCount: interviews,
        placementRate: submissions > 0 ? (placements / submissions) * 100 : 0,
        interviewRate: submissions > 0 ? (interviews / submissions) * 100 : 0,
      };
    }) || [];

    setRecruiters(recruitersWithData);
    setLoading(false);
  };

  const handleVerify = async (recruiter: Recruiter, verify: boolean) => {
    setProcessing(recruiter.user_id);
    
    const { error } = await supabase
      .from('user_roles')
      .update({ verified: verify })
      .eq('user_id', recruiter.user_id)
      .eq('role', 'recruiter');

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success(verify ? 'Recruiter verifiziert' : 'Verifizierung entfernt');
      fetchRecruiters();
    }
    setProcessing(null);
  };

  const handleSuspend = async (recruiter: Recruiter, suspend: boolean) => {
    setProcessing(recruiter.user_id);
    
    const { error } = await supabase
      .from('user_roles')
      .update({ status: suspend ? 'suspended' : 'active' })
      .eq('user_id', recruiter.user_id)
      .eq('role', 'recruiter');

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success(suspend ? 'Recruiter gesperrt' : 'Recruiter aktiviert');
      fetchRecruiters();
    }
    setProcessing(null);
  };

  const handleSaveDetails = async () => {
    if (!selectedRecruiter) return;
    
    const feeValue = customFee ? parseFloat(customFee) : null;
    
    const { error: roleError } = await supabase
      .from('user_roles')
      .update({ custom_fee_percentage: feeValue })
      .eq('user_id', selectedRecruiter.user_id)
      .eq('role', 'recruiter');

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ internal_notes: notes })
      .eq('user_id', selectedRecruiter.user_id);

    if (roleError || profileError) {
      toast.error('Fehler beim Speichern');
    } else {
      toast.success('Änderungen gespeichert');
      fetchRecruiters();
      setDetailOpen(false);
    }
  };

  const getQualityScore = (recruiter: Recruiter): number => {
    let score = 0;
    if (recruiter.placementRate >= 10) score += 2;
    else if (recruiter.placementRate >= 5) score += 1;
    if (recruiter.interviewRate >= 30) score += 2;
    else if (recruiter.interviewRate >= 15) score += 1;
    if (recruiter.submissionCount >= 20) score += 1;
    return Math.min(score, 5);
  };

  const filteredRecruiters = recruiters.filter(r =>
    r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            <h1 className="text-3xl font-bold">Recruiterverwaltung</h1>
            <p className="text-muted-foreground mt-1">
              Recruiter verwalten, verifizieren und Performance überwachen
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{recruiters.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Verifiziert</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recruiters.filter(r => r.verified).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ausstehend</CardTitle>
                <XCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recruiters.filter(r => !r.verified).length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Submissions</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recruiters.reduce((sum, r) => sum + r.submissionCount, 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Placements</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {recruiters.reduce((sum, r) => sum + r.placementCount, 0)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, E-Mail oder Firma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Recruiters Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recruiter</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Qualität</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecruiters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine Recruiters gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecruiters.map((recruiter) => (
                      <TableRow key={recruiter.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{recruiter.full_name || '-'}</p>
                            <p className="text-sm text-muted-foreground">{recruiter.email}</p>
                            {recruiter.company_name && (
                              <p className="text-xs text-muted-foreground">{recruiter.company_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Submissions:</span>
                              <span className="font-medium">{recruiter.submissionCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Interviews:</span>
                              <span className="font-medium">{recruiter.interviewCount}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Placements:</span>
                              <span className="font-medium">{recruiter.placementCount}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`h-3 w-3 ${i < getQualityScore(recruiter) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} 
                                />
                              ))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {recruiter.placementRate.toFixed(1)}% Placement-Rate
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {recruiter.verified ? (
                              <Badge className="bg-green-500">Verifiziert</Badge>
                            ) : (
                              <Badge variant="outline">Ausstehend</Badge>
                            )}
                            {recruiter.status === 'suspended' && (
                              <Badge variant="destructive">Gesperrt</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {recruiter.custom_fee_percentage ? (
                            <Badge variant="secondary">{recruiter.custom_fee_percentage}%</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Standard</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={processing === recruiter.user_id}>
                                {processing === recruiter.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedRecruiter(recruiter);
                                setNotes(recruiter.internal_notes || '');
                                setCustomFee(recruiter.custom_fee_percentage?.toString() || '');
                                setDetailOpen(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Details & Bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {recruiter.verified ? (
                                <DropdownMenuItem onClick={() => handleVerify(recruiter, false)}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Verifizierung entfernen
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleVerify(recruiter, true)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Verifizieren
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {recruiter.status === 'suspended' ? (
                                <DropdownMenuItem onClick={() => handleSuspend(recruiter, false)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Aktivieren
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleSuspend(recruiter, true)}
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Sperren
                                </DropdownMenuItem>
                              )}
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Recruiter Details</DialogTitle>
            </DialogHeader>
            {selectedRecruiter && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedRecruiter.full_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Firma</p>
                    <p className="font-medium">{selectedRecruiter.company_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">E-Mail</p>
                    <p className="font-medium">{selectedRecruiter.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Registriert</p>
                    <p className="font-medium">{format(new Date(selectedRecruiter.created_at), 'PPP', { locale: de })}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{selectedRecruiter.submissionCount}</p>
                    <p className="text-sm text-muted-foreground">Submissions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{selectedRecruiter.interviewCount}</p>
                    <p className="text-sm text-muted-foreground">Interviews</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{selectedRecruiter.placementCount}</p>
                    <p className="text-sm text-muted-foreground">Placements</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Placement-Rate</p>
                    <div className="flex items-center gap-3">
                      <Progress value={selectedRecruiter.placementRate} className="flex-1" />
                      <span className="text-sm font-medium">{selectedRecruiter.placementRate.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Interview-Rate</p>
                    <div className="flex items-center gap-3">
                      <Progress value={selectedRecruiter.interviewRate} className="flex-1" />
                      <span className="text-sm font-medium">{selectedRecruiter.interviewRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Custom Fee-Prozentsatz</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={customFee}
                      onChange={(e) => setCustomFee(e.target.value)}
                      placeholder="Standard (15%)"
                      className="w-32"
                    />
                    <Percent className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Leer = Standard-Fee</span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Interne Notizen / Warnungen</p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notizen zu diesem Recruiter..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDetailOpen(false)}>Abbrechen</Button>
                  <Button onClick={handleSaveDetails}>Speichern</Button>
                </div>
              </div>
        )}
      </DialogContent>
    </Dialog>
  </DashboardLayout>
  );
}