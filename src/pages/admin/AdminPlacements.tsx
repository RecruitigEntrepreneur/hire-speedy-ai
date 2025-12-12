import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, UserCheck, Euro, TrendingUp, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Placement {
  id: string;
  agreed_salary: number | null;
  start_date: string | null;
  total_fee: number | null;
  recruiter_payout: number | null;
  platform_fee: number | null;
  payment_status: string | null;
  created_at: string;
  submission: {
    id: string;
    candidate: {
      full_name: string;
      email: string;
    };
    job: {
      title: string;
      company_name: string;
      recruiter_fee_percentage: number | null;
    };
    recruiter_id: string;
  };
}

export default function AdminPlacements() {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPlacement, setEditingPlacement] = useState<Placement | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [formData, setFormData] = useState({
    agreed_salary: '',
    start_date: '',
    total_fee: '',
    recruiter_payout: '',
    platform_fee: '',
    payment_status: 'pending',
  });

  useEffect(() => {
    fetchPlacements();
  }, []);

  const fetchPlacements = async () => {
    const { data, error } = await supabase
      .from('placements')
      .select(`
        *,
        submission:submissions(
          id,
          recruiter_id,
          candidate:candidates(full_name, email),
          job:jobs(title, company_name, recruiter_fee_percentage)
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPlacements(data as unknown as Placement[]);
    }
    setLoading(false);
  };

  const handleEdit = (placement: Placement) => {
    setEditingPlacement(placement);
    setFormData({
      agreed_salary: placement.agreed_salary?.toString() || '',
      start_date: placement.start_date || '',
      total_fee: placement.total_fee?.toString() || '',
      recruiter_payout: placement.recruiter_payout?.toString() || '',
      platform_fee: placement.platform_fee?.toString() || '',
      payment_status: placement.payment_status || 'pending',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingPlacement) return;
    setProcessing(true);

    const { error } = await supabase
      .from('placements')
      .update({
        agreed_salary: formData.agreed_salary ? parseInt(formData.agreed_salary) : null,
        start_date: formData.start_date || null,
        total_fee: formData.total_fee ? parseFloat(formData.total_fee) : null,
        recruiter_payout: formData.recruiter_payout ? parseFloat(formData.recruiter_payout) : null,
        platform_fee: formData.platform_fee ? parseFloat(formData.platform_fee) : null,
        payment_status: formData.payment_status,
      })
      .eq('id', editingPlacement.id);

    if (error) {
      toast.error('Fehler beim Speichern');
    } else {
      toast.success('Placement aktualisiert');
      setDialogOpen(false);
      fetchPlacements();
    }
    setProcessing(false);
  };

  const calculateFees = () => {
    if (!formData.agreed_salary) return;
    const salary = parseInt(formData.agreed_salary);
    const feePercentage = editingPlacement?.submission.job.recruiter_fee_percentage || 15;
    const totalFee = salary * (feePercentage / 100);
    const platformFee = totalFee * 0.2; // 20% platform fee
    const recruiterPayout = totalFee - platformFee;
    
    setFormData({
      ...formData,
      total_fee: totalFee.toFixed(2),
      platform_fee: platformFee.toFixed(2),
      recruiter_payout: recruiterPayout.toFixed(2),
    });
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

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const filteredPlacements = placements.filter(p =>
    p.submission.candidate.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.submission.job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.submission.job.company_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: placements.length,
    pending: placements.filter(p => p.payment_status === 'pending').length,
    confirmed: placements.filter(p => p.payment_status === 'confirmed').length,
    paid: placements.filter(p => p.payment_status === 'paid').length,
    totalRevenue: placements.reduce((sum, p) => sum + (p.platform_fee || 0), 0),
  };

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
            <h1 className="text-3xl font-bold">Placements</h1>
            <p className="text-muted-foreground mt-1">
              Verwalten Sie alle erfolgreichen Vermittlungen
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ausstehend</CardTitle>
                <UserCheck className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bestätigt</CardTitle>
                <UserCheck className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.confirmed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bezahlt</CardTitle>
                <UserCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.paid}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Kandidat, Position oder Firma..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kandidat</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Gehalt</TableHead>
                    <TableHead>Gesamtgebühr</TableHead>
                    <TableHead>Recruiter</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlacements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Keine Placements gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPlacements.map((placement) => (
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
                        <TableCell>{formatCurrency(placement.agreed_salary)}</TableCell>
                        <TableCell>{formatCurrency(placement.total_fee)}</TableCell>
                        <TableCell>{formatCurrency(placement.recruiter_payout)}</TableCell>
                        <TableCell>{formatCurrency(placement.platform_fee)}</TableCell>
                        <TableCell>{getStatusBadge(placement.payment_status)}</TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(placement)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Placement bearbeiten</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Vereinbartes Gehalt (€)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={formData.agreed_salary}
                    onChange={(e) => setFormData({ ...formData, agreed_salary: e.target.value })}
                    placeholder="70000"
                  />
                  <Button variant="outline" onClick={calculateFees}>
                    Berechnen
                  </Button>
                </div>
              </div>
              <div>
                <Label>Startdatum</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Gesamtgebühr (€)</Label>
                  <Input
                    type="number"
                    value={formData.total_fee}
                    onChange={(e) => setFormData({ ...formData, total_fee: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Recruiter (€)</Label>
                  <Input
                    type="number"
                    value={formData.recruiter_payout}
                    onChange={(e) => setFormData({ ...formData, recruiter_payout: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Platform (€)</Label>
                  <Input
                    type="number"
                    value={formData.platform_fee}
                    onChange={(e) => setFormData({ ...formData, platform_fee: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={formData.payment_status}
                  onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Ausstehend</SelectItem>
                    <SelectItem value="confirmed">Bestätigt</SelectItem>
                    <SelectItem value="paid">Bezahlt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Speichern
              </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </DashboardLayout>
  );
}
