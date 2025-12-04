import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  FileText,
  Download,
  Euro,
  Clock,
  CheckCircle,
  AlertCircle,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  pdf_url: string | null;
  created_at: string;
  placement: {
    id: string;
    submission: {
      candidate: {
        full_name: string;
      };
      job: {
        title: string;
      };
    };
  };
}

interface PlacementWithFee {
  id: string;
  total_fee: number | null;
  payment_status: string | null;
  start_date: string | null;
  created_at: string;
  submission: {
    candidate: {
      full_name: string;
    };
    job: {
      title: string;
      company_name: string;
    };
  };
}

export default function ClientBilling() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [placements, setPlacements] = useState<PlacementWithFee[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);

  useEffect(() => {
    if (user) {
      fetchBillingData();
    }
  }, [user]);

  const fetchBillingData = async () => {
    try {
      // Fetch invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`
          *,
          placement:placements(
            id,
            submission:submissions(
              candidate:candidates(full_name),
              job:jobs(title)
            )
          )
        `)
        .eq('client_id', user?.id)
        .order('created_at', { ascending: false });

      if (invoicesError && invoicesError.code !== 'PGRST116') {
        console.error('Error fetching invoices:', invoicesError);
      }
      
      setInvoices((invoicesData as unknown as Invoice[]) || []);

      // Calculate totals from invoices
      const pending = (invoicesData || [])
        .filter(i => i.status === 'pending')
        .reduce((sum, i) => sum + (i.total_amount || 0), 0);
      const paid = (invoicesData || [])
        .filter(i => i.status === 'paid')
        .reduce((sum, i) => sum + (i.total_amount || 0), 0);
      
      setTotalPending(pending);
      setTotalPaid(paid);

      // Fetch placements for fee overview
      const { data: placementsData, error: placementsError } = await supabase
        .from('placements')
        .select(`
          *,
          submission:submissions(
            candidate:candidates(full_name),
            job:jobs(title, company_name, client_id)
          )
        `)
        .order('created_at', { ascending: false });

      if (placementsError) {
        console.error('Error fetching placements:', placementsError);
      }
      
      // Filter placements for this client
      const clientPlacements = (placementsData || []).filter(
        (p: any) => p.submission?.job?.client_id === user?.id
      );
      
      setPlacements(clientPlacements as unknown as PlacementWithFee[]);
    } catch (error) {
      console.error('Error fetching billing data:', error);
      toast({ title: 'Fehler beim Laden', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Bezahlt</Badge>;
      case 'overdue':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Überfällig</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Ausstehend</Badge>;
    }
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Abrechnung</h1>
            <p className="text-muted-foreground">Übersicht über Rechnungen und Fees</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Ausstehend</p>
                    <p className="text-2xl font-bold">€{totalPending.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bezahlt (Gesamt)</p>
                    <p className="text-2xl font-bold">€{totalPaid.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Placements</p>
                    <p className="text-2xl font-bold">{placements.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Placements / Fees Table */}
          <Card>
            <CardHeader>
              <CardTitle>Placements & Fees</CardTitle>
              <CardDescription>
                Übersicht über erfolgreiche Einstellungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              {placements.length === 0 ? (
                <div className="text-center py-12">
                  <Euro className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-4">Noch keine Placements</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kandidat</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Startdatum</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {placements.map((placement) => (
                      <TableRow key={placement.id}>
                        <TableCell className="font-medium">
                          {placement.submission?.candidate?.full_name || '-'}
                        </TableCell>
                        <TableCell>
                          {placement.submission?.job?.title || '-'}
                        </TableCell>
                        <TableCell>
                          {placement.start_date 
                            ? format(new Date(placement.start_date), 'PP', { locale: de })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {placement.total_fee 
                            ? `€${placement.total_fee.toLocaleString()}`
                            : '-'}
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

          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <CardTitle>Rechnungen</CardTitle>
              <CardDescription>
                Alle Rechnungen im Überblick
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-4">Noch keine Rechnungen</p>
                  <p className="text-sm text-muted-foreground">
                    Rechnungen werden nach erfolgreichen Placements erstellt.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rechnungsnr.</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Beschreibung</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Fällig</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invoice.created_at), 'PP', { locale: de })}
                        </TableCell>
                        <TableCell>
                          {invoice.placement?.submission?.candidate?.full_name} - {invoice.placement?.submission?.job?.title}
                        </TableCell>
                        <TableCell className="font-medium">
                          €{invoice.total_amount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(invoice.status)}
                        </TableCell>
                        <TableCell>
                          {invoice.due_date 
                            ? format(new Date(invoice.due_date), 'PP', { locale: de })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {invoice.pdf_url && (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
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
    </div>
  );
}