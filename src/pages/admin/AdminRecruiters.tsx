import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, Users, CheckCircle, XCircle, Mail, FileText } from 'lucide-react';
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
  submissionCount: number;
  placementCount: number;
}

export default function AdminRecruiters() {
  const [recruiters, setRecruiters] = useState<Recruiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchRecruiters();
  }, []);

  const fetchRecruiters = async () => {
    // Get all recruiter user_ids and verification status from user_roles
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id, verified')
      .eq('role', 'recruiter');

    if (!roleData) {
      setLoading(false);
      return;
    }

    const recruiterUserIds = roleData.map(r => r.user_id);
    const verificationMap = roleData.reduce((acc, r) => {
      acc[r.user_id] = r.verified || false;
      return acc;
    }, {} as Record<string, boolean>);

    // Get profiles for these users
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', recruiterUserIds);

    // Get submission counts
    const { data: submissionData } = await supabase
      .from('submissions')
      .select('recruiter_id')
      .in('recruiter_id', recruiterUserIds);

    const submissionCounts = submissionData?.reduce((acc, sub) => {
      acc[sub.recruiter_id] = (acc[sub.recruiter_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Get placement counts
    const { data: placementData } = await supabase
      .from('placements')
      .select('submission:submissions(recruiter_id)')
      .in('submission.recruiter_id', recruiterUserIds);

    const placementCounts: Record<string, number> = {};
    placementData?.forEach((p: any) => {
      if (p.submission?.recruiter_id) {
        placementCounts[p.submission.recruiter_id] = (placementCounts[p.submission.recruiter_id] || 0) + 1;
      }
    });

    const recruitersWithData = profileData?.map(profile => ({
      ...profile,
      verified: verificationMap[profile.user_id] || false,
      submissionCount: submissionCounts[profile.user_id] || 0,
      placementCount: placementCounts[profile.user_id] || 0,
    })) || [];

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

  const filteredRecruiters = recruiters.filter(r =>
    r.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div>
            <h1 className="text-3xl font-bold">Recruiters</h1>
            <p className="text-muted-foreground mt-1">
              Verwalten und verifizieren Sie Recruiter
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
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
                <CardTitle className="text-sm font-medium">Placements</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
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
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Firma</TableHead>
                    <TableHead>Submissions</TableHead>
                    <TableHead>Placements</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecruiters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Keine Recruiters gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecruiters.map((recruiter) => (
                      <TableRow key={recruiter.id}>
                        <TableCell className="font-medium">
                          {recruiter.full_name || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {recruiter.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {recruiter.company_name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{recruiter.submissionCount}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{recruiter.placementCount}</Badge>
                        </TableCell>
                        <TableCell>
                          {recruiter.verified ? (
                            <Badge className="bg-green-500">Verifiziert</Badge>
                          ) : (
                            <Badge variant="outline">Ausstehend</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {recruiter.verified ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVerify(recruiter, false)}
                              disabled={processing === recruiter.user_id}
                            >
                              {processing === recruiter.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Entfernen'
                              )}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleVerify(recruiter, true)}
                              disabled={processing === recruiter.user_id}
                            >
                              {processing === recruiter.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Verifizieren'
                              )}
                            </Button>
                          )}
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
    </>
  );
}
