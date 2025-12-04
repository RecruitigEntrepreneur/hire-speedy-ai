import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, UserCheck, Euro, Calendar, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Placement {
  id: string;
  agreed_salary: number | null;
  start_date: string | null;
  total_fee: number | null;
  payment_status: string | null;
  created_at: string;
  submission: {
    candidate: {
      full_name: string;
      email: string;
    };
    job: {
      title: string;
      company_name: string;
    };
  };
}

export default function ClientPlacements() {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    totalFees: 0,
  });

  useEffect(() => {
    if (user) {
      fetchPlacements();
    }
  }, [user]);

  const fetchPlacements = async () => {
    const { data, error } = await supabase
      .from('placements')
      .select(`
        *,
        submission:submissions(
          candidate:candidates(full_name, email),
          job:jobs(title, company_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const placementsData = data as unknown as Placement[];
      setPlacements(placementsData);
      
      // Calculate stats
      const now = new Date();
      const thisMonth = placementsData.filter(p => {
        const created = new Date(p.created_at);
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      });
      
      setStats({
        total: placementsData.length,
        thisMonth: thisMonth.length,
        totalFees: placementsData.reduce((sum, p) => sum + (p.total_fee || 0), 0),
      });
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Ausstehend', variant: 'outline' },
      confirmed: { label: 'Bestätigt', variant: 'default' },
      paid: { label: 'Bezahlt', variant: 'secondary' },
    };
    const statusConfig = config[status || 'pending'] || config.pending;
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

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
            <h1 className="text-3xl font-bold">Placements</h1>
            <p className="text-muted-foreground mt-1">
              Übersicht Ihrer erfolgreichen Einstellungen
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt Placements</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">
                  Erfolgreiche Einstellungen
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Diesen Monat</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.thisMonth}</div>
                <p className="text-xs text-muted-foreground">
                  Neue Einstellungen
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamtgebühren</CardTitle>
                <Euro className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalFees)}</div>
                <p className="text-xs text-muted-foreground">
                  Vermittlungsgebühren
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Placements Table */}
          <Card>
            <CardHeader>
              <CardTitle>Alle Placements</CardTitle>
            </CardHeader>
            <CardContent>
              {placements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Noch keine Placements vorhanden</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Placements werden automatisch erstellt, wenn Sie einen Kandidaten einstellen
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kandidat</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Startdatum</TableHead>
                      <TableHead>Gehalt</TableHead>
                      <TableHead>Gebühr</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {placements.map((placement) => (
                      <TableRow key={placement.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{placement.submission.candidate.full_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {placement.submission.candidate.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{placement.submission.job.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {placement.submission.job.company_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {placement.start_date 
                            ? format(new Date(placement.start_date), 'PP', { locale: de })
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {placement.agreed_salary 
                            ? formatCurrency(placement.agreed_salary)
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {placement.total_fee 
                            ? formatCurrency(placement.total_fee)
                            : '-'
                          }
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(placement.payment_status)}
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
    </>
  );
}
