import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, Euro, CheckCircle, Clock, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Payment {
  id: string;
  agreed_salary: number | null;
  recruiter_payout: number | null;
  payment_status: string | null;
  paid_at: string | null;
  created_at: string;
  submission: {
    recruiter_id: string;
    candidate: {
      full_name: string;
    };
    job: {
      title: string;
      company_name: string;
    };
  };
  recruiterProfile?: {
    full_name: string | null;
    email: string;
    bank_iban: string | null;
  };
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    // Get placements that need payment processing
    const { data: placementData, error } = await supabase
      .from('placements')
      .select(`
        *,
        submission:submissions(
          recruiter_id,
          candidate:candidates(full_name),
          job:jobs(title, company_name)
        )
      `)
      .in('payment_status', ['confirmed', 'paid'])
      .order('created_at', { ascending: false });

    if (!error && placementData) {
      // Get recruiter profiles
      const recruiterIds = [...new Set(placementData.map((p: any) => p.submission?.recruiter_id).filter(Boolean))];
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, bank_iban')
        .in('user_id', recruiterIds);

      const profileMap = profileData?.reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, any>) || {};

      const paymentsWithProfiles = placementData.map((p: any) => ({
        ...p,
        recruiterProfile: profileMap[p.submission?.recruiter_id],
      }));

      setPayments(paymentsWithProfiles as Payment[]);
    }
    setLoading(false);
  };

  const handleMarkAsPaid = async (payment: Payment) => {
    setProcessing(payment.id);
    
    const { error } = await supabase
      .from('placements')
      .update({ 
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success('Als bezahlt markiert');
      fetchPayments();
    }
    setProcessing(null);
  };

  const getStatusBadge = (status: string | null) => {
    if (status === 'paid') {
      return <Badge className="bg-green-500">Bezahlt</Badge>;
    }
    return <Badge variant="outline">Ausstehend</Badge>;
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const filteredPayments = payments.filter(p =>
    p.submission.candidate.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.recruiterProfile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.recruiterProfile?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingPayments = payments.filter(p => p.payment_status === 'confirmed');
  const completedPayments = payments.filter(p => p.payment_status === 'paid');
  const totalPending = pendingPayments.reduce((sum, p) => sum + (p.recruiter_payout || 0), 0);
  const totalPaid = completedPayments.reduce((sum, p) => sum + (p.recruiter_payout || 0), 0);

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
            <h1 className="text-3xl font-bold">Auszahlungen</h1>
            <p className="text-muted-foreground mt-1">
              Verwalten Sie Recruiter-Auszahlungen
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ausstehend</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingPayments.length}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totalPending)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bezahlt</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedPayments.length}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totalPaid)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt ausgezahlt</CardTitle>
                <Euro className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Durchschnitt</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {completedPayments.length > 0 
                    ? formatCurrency(totalPaid / completedPayments.length)
                    : '-'
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Recruiter oder Kandidat..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Pending Payments */}
          {pendingPayments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-500" />
                  Ausstehende Auszahlungen
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recruiter</TableHead>
                      <TableHead>Kandidat</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>IBAN</TableHead>
                      <TableHead>Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.recruiterProfile?.full_name || '-'}</p>
                            <p className="text-sm text-muted-foreground">
                              {payment.recruiterProfile?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{payment.submission.candidate.full_name}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.submission.job.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {payment.submission.job.company_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payment.recruiter_payout)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {payment.recruiterProfile?.bank_iban || '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleMarkAsPaid(payment)}
                            disabled={processing === payment.id}
                          >
                            {processing === payment.id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-2" />
                            )}
                            Als bezahlt markieren
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Completed Payments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Abgeschlossene Auszahlungen
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {completedPayments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Euro className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Noch keine abgeschlossenen Auszahlungen</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recruiter</TableHead>
                      <TableHead>Kandidat</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Bezahlt am</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.recruiterProfile?.full_name || '-'}</p>
                            <p className="text-sm text-muted-foreground">
                              {payment.recruiterProfile?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{payment.submission.candidate.full_name}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payment.recruiter_payout)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {payment.paid_at 
                            ? format(new Date(payment.paid_at), 'PPP', { locale: de })
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payment.payment_status)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
