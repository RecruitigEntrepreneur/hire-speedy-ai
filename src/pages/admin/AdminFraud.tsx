import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, Search, ShieldAlert, AlertTriangle, CheckCircle, XCircle, 
  Eye, Ban, RefreshCw, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useFraudSignals, FraudSignal } from '@/hooks/useFraudSignals';

export default function AdminFraud() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSignal, setSelectedSignal] = useState<FraudSignal | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState('');
  const [processing, setProcessing] = useState(false);

  const { 
    signals, 
    loading, 
    fetchSignals, 
    updateSignal, 
    runFraudCheck,
    getSeverityColor, 
    getSeverityBgColor, 
    getSignalTypeLabel,
    getStatusLabel,
    pendingCount,
    criticalCount
  } = useFraudSignals({
    status: statusFilter || undefined,
    severity: severityFilter || undefined,
  });

  const handleReview = async (newStatus: string) => {
    if (!selectedSignal) return;
    setProcessing(true);

    const success = await updateSignal(selectedSignal.id, {
      status: newStatus,
      action_taken: reviewAction,
      notes: reviewNotes,
    });

    if (success) {
      toast.success(`Signal als "${getStatusLabel(newStatus)}" markiert`);
      setReviewOpen(false);
      setSelectedSignal(null);
      setReviewNotes('');
      setReviewAction('');
    } else {
      toast.error('Fehler beim Aktualisieren');
    }
    setProcessing(false);
  };

  const handleBatchScan = async () => {
    setProcessing(true);
    const result = await runFraudCheck({ trigger: 'batch_scan' });
    if (result) {
      toast.success(`Batch-Scan abgeschlossen: ${result.signals_created || 0} neue Signale`);
    } else {
      toast.error('Fehler beim Batch-Scan');
    }
    setProcessing(false);
  };

  const filteredSignals = signals.filter(s => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        s.signal_type.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        JSON.stringify(s.details).toLowerCase().includes(query)
      );
    }
    return true;
  });

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
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <ShieldAlert className="h-8 w-8 text-destructive" />
                Fraud-Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Verdächtige Aktivitäten überwachen und prüfen
              </p>
            </div>
            <Button onClick={handleBatchScan} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Batch-Scan starten
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className={pendingCount > 0 ? 'border-amber-500/50' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ausstehend</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCount}</div>
              </CardContent>
            </Card>
            <Card className={criticalCount > 0 ? 'border-destructive/50' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Kritisch</CardTitle>
                <ShieldAlert className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{criticalCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Bestätigt</CardTitle>
                <CheckCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {signals.filter(s => s.status === 'confirmed').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Abgelehnt</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {signals.filter(s => s.status === 'dismissed').length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suche..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="investigating">In Prüfung</SelectItem>
                <SelectItem value="confirmed">Bestätigt</SelectItem>
                <SelectItem value="dismissed">Abgelehnt</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Schweregrad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="critical">Kritisch</SelectItem>
                <SelectItem value="high">Hoch</SelectItem>
                <SelectItem value="medium">Mittel</SelectItem>
                <SelectItem value="low">Niedrig</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setStatusFilter(''); setSeverityFilter(''); setSearchQuery(''); }}>
              Filter zurücksetzen
            </Button>
          </div>

          {/* Signals Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Typ</TableHead>
                    <TableHead>Schweregrad</TableHead>
                    <TableHead>Konfidenz</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erstellt</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSignals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine Fraud-Signale gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSignals.map((signal) => (
                      <TableRow key={signal.id} className={signal.severity === 'critical' ? 'bg-destructive/5' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{getSignalTypeLabel(signal.signal_type)}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {signal.id.slice(0, 8)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getSeverityBgColor(signal.severity)} ${getSeverityColor(signal.severity)} border-0`}>
                            {signal.severity.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${signal.confidence_score >= 80 ? 'bg-destructive' : signal.confidence_score >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                style={{ width: `${signal.confidence_score}%` }}
                              />
                            </div>
                            <span className="text-sm">{signal.confidence_score}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            signal.status === 'pending' ? 'outline' :
                            signal.status === 'investigating' ? 'secondary' :
                            signal.status === 'confirmed' ? 'destructive' : 'default'
                          }>
                            {getStatusLabel(signal.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {format(new Date(signal.created_at), 'dd.MM.yy HH:mm', { locale: de })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSignal(signal);
                              setReviewNotes(signal.notes || '');
                              setReviewAction(signal.action_taken || '');
                              setReviewOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Prüfen
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

        {/* Review Dialog */}
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                Fraud-Signal prüfen
              </DialogTitle>
            </DialogHeader>
            {selectedSignal && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Typ</p>
                    <p className="font-medium">{getSignalTypeLabel(selectedSignal.signal_type)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Schweregrad</p>
                    <Badge className={`${getSeverityBgColor(selectedSignal.severity)} ${getSeverityColor(selectedSignal.severity)} border-0`}>
                      {selectedSignal.severity.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Konfidenz</p>
                    <p className="font-medium">{selectedSignal.confidence_score}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Auto-Aktion</p>
                    <p className="font-medium">{selectedSignal.auto_action_taken || 'Keine'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Details</p>
                  <div className="bg-muted p-3 rounded-lg text-sm font-mono overflow-auto max-h-40">
                    {JSON.stringify(selectedSignal.details, null, 2)}
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Beweise</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {selectedSignal.evidence.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Ergriffene Maßnahme</p>
                  <Input
                    value={reviewAction}
                    onChange={(e) => setReviewAction(e.target.value)}
                    placeholder="z.B. Nutzer gesperrt, Warnung gesendet..."
                  />
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Notizen</p>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Begründung für die Entscheidung..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setReviewOpen(false)}>
                Abbrechen
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleReview('investigating')}
                disabled={processing}
              >
                In Prüfung
              </Button>
              <Button
                variant="outline"
                onClick={() => handleReview('dismissed')}
                disabled={processing}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Ablehnen
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleReview('confirmed')}
                disabled={processing}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                Bestätigen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}
