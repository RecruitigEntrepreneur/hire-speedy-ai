import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Loader2,
  DollarSign,
  Clock,
  CheckCircle2,
  Wallet,
  TrendingUp,
  Calendar,
  Briefcase
} from 'lucide-react';

interface Placement {
  id: string;
  agreed_salary: number;
  recruiter_payout: number;
  platform_fee: number;
  total_fee: number;
  payment_status: string;
  start_date: string;
  paid_at: string | null;
  created_at: string;
  submissions: {
    id: string;
    candidates: {
      full_name: string;
    };
    jobs: {
      title: string;
      company_name: string;
      recruiter_fee_percentage: number;
    };
  };
}

interface EarningsStats {
  pending: number;
  confirmed: number;
  paid: number;
  total: number;
}

export default function RecruiterEarnings() {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [stats, setStats] = useState<EarningsStats>({ pending: 0, confirmed: 0, paid: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchEarnings();
    }
  }, [user]);

  const fetchEarnings = async () => {
    try {
      const { data: submissionsData, error } = await supabase
        .from('submissions')
        .select(`
          id,
          candidates (full_name),
          jobs (title, company_name, recruiter_fee_percentage),
          placements (
            id,
            agreed_salary,
            recruiter_payout,
            platform_fee,
            total_fee,
            payment_status,
            start_date,
            paid_at,
            created_at
          )
        `)
        .eq('recruiter_id', user?.id)
        .eq('status', 'hired');

      if (!error && submissionsData) {
        const placementsWithDetails: Placement[] = [];
        let pending = 0, confirmed = 0, paid = 0;

        submissionsData.forEach((sub: any) => {
          if (sub.placements && sub.placements.length > 0) {
            sub.placements.forEach((placement: any) => {
              placementsWithDetails.push({
                ...placement,
                submissions: {
                  id: sub.id,
                  candidates: sub.candidates,
                  jobs: sub.jobs
                }
              });

              const payout = placement.recruiter_payout || 0;
              if (placement.payment_status === 'paid') {
                paid += payout;
              } else if (placement.payment_status === 'confirmed') {
                confirmed += payout;
              } else {
                pending += payout;
              }
            });
          }
        });

        setPlacements(placementsWithDetails);
        setStats({
          pending,
          confirmed,
          paid,
          total: pending + confirmed + paid
        });
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-emerald text-white">Ausgezahlt</Badge>;
      case 'confirmed':
        return <Badge className="bg-blue-500 text-white">Bestätigt</Badge>;
      case 'processing':
        return <Badge className="bg-amber-500 text-white">In Bearbeitung</Badge>;
      default:
        return <Badge variant="secondary">Ausstehend</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Earnings & Payouts</h1>
          <p className="text-muted-foreground">Übersicht deiner Vermittlungsgebühren</p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ausstehend</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.pending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bestätigt</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.confirmed)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald/10 flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-emerald" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ausgezahlt</p>
                  <p className="text-2xl font-bold text-emerald">{formatCurrency(stats.paid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gesamt</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Placements & Fees</CardTitle>
          </CardHeader>
          <CardContent>
            {placements.length === 0 ? (
              <div className="text-center py-16">
                <DollarSign className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">Noch keine Placements</h3>
                <p className="text-muted-foreground">
                  Deine erfolgreichen Vermittlungen erscheinen hier
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kandidat</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Gehalt</TableHead>
                    <TableHead>Fee %</TableHead>
                    <TableHead>Dein Anteil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Startdatum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {placements.map((placement) => (
                    <TableRow key={placement.id}>
                      <TableCell className="font-medium">
                        {placement.submissions?.candidates?.full_name || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{placement.submissions?.jobs?.title || '-'}</p>
                          <p className="text-sm text-muted-foreground">
                            {placement.submissions?.jobs?.company_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(placement.agreed_salary || 0)}</TableCell>
                      <TableCell>
                        {placement.submissions?.jobs?.recruiter_fee_percentage || 15}%
                      </TableCell>
                      <TableCell className="font-semibold text-emerald">
                        {formatCurrency(placement.recruiter_payout || 0)}
                      </TableCell>
                      <TableCell>{getStatusBadge(placement.payment_status)}</TableCell>
                      <TableCell>
                        {placement.start_date 
                          ? new Date(placement.start_date).toLocaleDateString('de-DE')
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Auszahlungsinformationen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Auszahlungszyklus</p>
                  <p className="text-muted-foreground">
                    Auszahlungen erfolgen monatlich zum 15. des Monats für alle bestätigten Placements.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Bestätigung</p>
                  <p className="text-muted-foreground">
                    Placements werden nach erfolgreicher Probezeit (i.d.R. 3-6 Monate) bestätigt.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
