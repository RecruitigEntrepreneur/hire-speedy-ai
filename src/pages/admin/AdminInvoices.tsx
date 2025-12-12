import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Search, 
  FileText, 
  Euro, 
  CheckCircle, 
  Clock,
  AlertTriangle,
  Download,
  Eye,
  MoreHorizontal,
  RefreshCw
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, isPast, addDays } from 'date-fns';
import { de } from 'date-fns/locale';

interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  placement_id: string | null;
  amount: number;
  tax_amount: number | null;
  total_amount: number;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  pdf_url: string | null;
  client_name?: string;
  client_email?: string;
  placement_candidate?: string;
  placement_job?: string;
}

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    const { data: invoiceData, error } = await supabase
      .from('invoices')
      .select(`
        *,
        placement:placements(
          submission:submissions(
            candidate:candidates(full_name),
            job:jobs(title, company_name)
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      setLoading(false);
      return;
    }

    // Get client profiles
    const clientIds = [...new Set((invoiceData || []).map(i => i.client_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', clientIds);

    const profileMap = profilesData?.reduce((acc, p) => {
      acc[p.user_id] = p;
      return acc;
    }, {} as Record<string, any>) || {};

    const enrichedInvoices = (invoiceData || []).map((invoice: any) => ({
      ...invoice,
      client_name: profileMap[invoice.client_id]?.full_name || 'Unbekannt',
      client_email: profileMap[invoice.client_id]?.email || '-',
      placement_candidate: invoice.placement?.submission?.candidate?.full_name || '-',
      placement_job: invoice.placement?.submission?.job?.title || '-',
    }));

    setInvoices(enrichedInvoices);
    setLoading(false);
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    setProcessing(invoice.id);
    
    const { error } = await supabase
      .from('invoices')
      .update({ 
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', invoice.id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success('Rechnung als bezahlt markiert');
      fetchInvoices();
    }
    setProcessing(null);
  };

  const handleMarkAsOverdue = async (invoice: Invoice) => {
    setProcessing(invoice.id);
    
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .eq('id', invoice.id);

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success('Rechnung als überfällig markiert');
      fetchInvoices();
    }
    setProcessing(null);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getStatusBadge = (status: string, dueDate: string | null) => {
    const isOverdue = dueDate && isPast(new Date(dueDate)) && status === 'pending';
    
    if (status === 'paid') {
      return <Badge className="bg-green-500">Bezahlt</Badge>;
    }
    if (status === 'overdue' || isOverdue) {
      return <Badge className="bg-red-500">Überfällig</Badge>;
    }
    if (status === 'cancelled') {
      return <Badge variant="secondary">Storniert</Badge>;
    }
    return <Badge variant="outline">Ausstehend</Badge>;
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client_email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const pendingInvoices = invoices.filter(i => i.status === 'pending');
  const paidInvoices = invoices.filter(i => i.status === 'paid');
  const overdueInvoices = invoices.filter(i => 
    i.status === 'overdue' || (i.status === 'pending' && i.due_date && isPast(new Date(i.due_date)))
  );
  
  const totalPending = pendingInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const totalPaid = paidInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);
  const totalOverdue = overdueInvoices.reduce((sum, i) => sum + (i.total_amount || 0), 0);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8" />
              Rechnungsverwaltung
            </h1>
            <p className="text-muted-foreground mt-1">
              Alle Rechnungen einsehen und verwalten
            </p>
          </div>
          <Button variant="outline" onClick={fetchInvoices}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Aktualisieren
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoices.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ausstehend</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingInvoices.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalPending)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Überfällig</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueInvoices.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalOverdue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bezahlt</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paidInvoices.length}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalPaid)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Rechnungsnummer, Kunde..."
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
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="paid">Bezahlt</SelectItem>
              <SelectItem value="overdue">Überfällig</SelectItem>
              <SelectItem value="cancelled">Storniert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invoices Table */}
        <Card>
          <CardContent className="p-0">
            {filteredInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Keine Rechnungen gefunden</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rechnungsnr.</TableHead>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Placement</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Fällig am</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.client_name}</p>
                          <p className="text-sm text-muted-foreground">{invoice.client_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {invoice.placement_candidate !== '-' ? (
                          <div>
                            <p className="text-sm">{invoice.placement_candidate}</p>
                            <p className="text-xs text-muted-foreground">{invoice.placement_job}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.total_amount)}
                      </TableCell>
                      <TableCell>
                        {invoice.due_date 
                          ? format(new Date(invoice.due_date), 'PPP', { locale: de })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(invoice.status, invoice.due_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={processing === invoice.id}>
                              {processing === invoice.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedInvoice(invoice);
                              setDetailOpen(true);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              Details
                            </DropdownMenuItem>
                            {invoice.pdf_url && (
                              <DropdownMenuItem onClick={() => window.open(invoice.pdf_url!, '_blank')}>
                                <Download className="mr-2 h-4 w-4" />
                                PDF herunterladen
                              </DropdownMenuItem>
                            )}
                            {invoice.status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleMarkAsPaid(invoice)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Als bezahlt markieren
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleMarkAsOverdue(invoice)}>
                                  <AlertTriangle className="mr-2 h-4 w-4" />
                                  Als überfällig markieren
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Rechnungsdetails</DialogTitle>
            </DialogHeader>
            {selectedInvoice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Rechnungsnummer</p>
                    <p className="font-medium">{selectedInvoice.invoice_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    {getStatusBadge(selectedInvoice.status, selectedInvoice.due_date)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Kunde</p>
                    <p className="font-medium">{selectedInvoice.client_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">E-Mail</p>
                    <p className="font-medium">{selectedInvoice.client_email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Nettobetrag</p>
                    <p className="font-medium">{formatCurrency(selectedInvoice.amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">MwSt.</p>
                    <p className="font-medium">{formatCurrency(selectedInvoice.tax_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gesamtbetrag</p>
                    <p className="font-bold text-lg">{formatCurrency(selectedInvoice.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fällig am</p>
                    <p className="font-medium">
                      {selectedInvoice.due_date 
                        ? format(new Date(selectedInvoice.due_date), 'PPP', { locale: de })
                        : '-'
                      }
                    </p>
                  </div>
                  {selectedInvoice.paid_at && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Bezahlt am</p>
                      <p className="font-medium text-green-600">
                        {format(new Date(selectedInvoice.paid_at), 'PPP', { locale: de })}
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Erstellt am</p>
                    <p className="font-medium">
                      {format(new Date(selectedInvoice.created_at), 'PPP', { locale: de })}
                    </p>
                  </div>
                </div>
                
                {selectedInvoice.status === 'pending' && (
                  <div className="flex gap-2 pt-4">
                    <Button 
                      className="flex-1"
                      onClick={() => {
                        handleMarkAsPaid(selectedInvoice);
                        setDetailOpen(false);
                      }}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Als bezahlt markieren
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}