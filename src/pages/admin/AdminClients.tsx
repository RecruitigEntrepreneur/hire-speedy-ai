import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, Search, Building2, Mail, Briefcase, Eye, Ban, 
  CheckCircle, MoreHorizontal, Pause, Play, StickyNote,
  ShieldCheck, ShieldX, Clock, FileCheck
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
import { useAuth } from '@/lib/auth';

interface ClientVerification {
  id: string;
  client_id: string;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  contract_signed: boolean;
  contract_signed_at: string | null;
  digital_signature: string | null;
  kyc_status: string;
  kyc_verified_at: string | null;
  company_registration_number: string | null;
  vat_id: string | null;
}

interface Client {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  internal_notes: string | null;
  jobCount: number;
  activeJobCount: number;
  status: string;
  suspended_at: string | null;
  suspension_reason: string | null;
  verification?: ClientVerification;
}

export default function AdminClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id, status, suspended_at, suspension_reason')
      .eq('role', 'client');

    if (!roleData) {
      setLoading(false);
      return;
    }

    const clientUserIds = roleData.map(r => r.user_id);
    const statusMap = roleData.reduce((acc, r) => {
      acc[r.user_id] = {
        status: r.status || 'active',
        suspended_at: r.suspended_at,
        suspension_reason: r.suspension_reason
      };
      return acc;
    }, {} as Record<string, any>);

    // Fetch verification data
    const { data: verificationData } = await supabase
      .from('client_verifications')
      .select('*')
      .in('client_id', clientUserIds);

    const verificationMap = verificationData?.reduce((acc, v) => {
      acc[v.client_id] = v;
      return acc;
    }, {} as Record<string, ClientVerification>) || {};

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .in('user_id', clientUserIds);

    const { data: jobData } = await supabase
      .from('jobs')
      .select('client_id, status')
      .in('client_id', clientUserIds);

    const jobCounts = jobData?.reduce((acc, job) => {
      if (!acc[job.client_id]) {
        acc[job.client_id] = { total: 0, active: 0 };
      }
      acc[job.client_id].total++;
      if (job.status === 'published') {
        acc[job.client_id].active++;
      }
      return acc;
    }, {} as Record<string, { total: number; active: number }>) || {};

    const clientsWithData = profileData?.map(profile => ({
      ...profile,
      jobCount: jobCounts[profile.user_id]?.total || 0,
      activeJobCount: jobCounts[profile.user_id]?.active || 0,
      status: statusMap[profile.user_id]?.status || 'active',
      suspended_at: statusMap[profile.user_id]?.suspended_at,
      suspension_reason: statusMap[profile.user_id]?.suspension_reason,
      verification: verificationMap[profile.user_id],
    })) || [];

    setClients(clientsWithData);
    setLoading(false);
  };

  const handleApproveKyc = async (client: Client) => {
    if (!user) return;
    setProcessing(client.user_id);
    
    const { error } = await supabase
      .from('client_verifications')
      .update({
        kyc_status: 'verified',
        kyc_verified_at: new Date().toISOString(),
        kyc_verified_by: user.id,
      })
      .eq('client_id', client.user_id);

    if (error) {
      toast.error('Fehler beim Genehmigen');
    } else {
      toast.success('KYC genehmigt');
      fetchClients();
    }
    setProcessing(null);
  };

  const handleRejectKyc = async () => {
    if (!selectedClient || !rejectionReason.trim()) {
      toast.error('Bitte Ablehnungsgrund angeben');
      return;
    }
    setProcessing(selectedClient.user_id);
    
    const { error } = await supabase
      .from('client_verifications')
      .update({
        kyc_status: 'rejected',
        kyc_rejection_reason: rejectionReason,
      })
      .eq('client_id', selectedClient.user_id);

    if (error) {
      toast.error('Fehler beim Ablehnen');
    } else {
      toast.success('KYC abgelehnt');
      setShowRejectionDialog(false);
      setRejectionReason('');
      fetchClients();
    }
    setProcessing(null);
  };

  const getKycStatusBadge = (status?: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500"><ShieldCheck className="h-3 w-3 mr-1" />Verifiziert</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><ShieldX className="h-3 w-3 mr-1" />Abgelehnt</Badge>;
      case 'in_review':
        return <Badge variant="secondary" className="bg-amber-500/20 text-amber-600"><Clock className="h-3 w-3 mr-1" />In Prüfung</Badge>;
      default:
        return <Badge variant="outline">Ausstehend</Badge>;
    }
  };

  const pendingKycClients = clients.filter(c => c.verification?.kyc_status === 'in_review');

  const handleSuspend = async (client: Client, suspend: boolean, reason?: string) => {
    setProcessing(client.user_id);
    
    const { error } = await supabase
      .from('user_roles')
      .update({
        status: suspend ? 'suspended' : 'active',
        suspended_at: suspend ? new Date().toISOString() : null,
        suspension_reason: suspend ? reason : null,
      })
      .eq('user_id', client.user_id)
      .eq('role', 'client');

    if (error) {
      toast.error('Fehler beim Aktualisieren');
    } else {
      toast.success(suspend ? 'Client gesperrt' : 'Client aktiviert');
      fetchClients();
    }
    setProcessing(null);
  };

  const handlePauseAllJobs = async (client: Client) => {
    setProcessing(client.user_id);
    
    const { error } = await supabase
      .from('jobs')
      .update({ paused_at: new Date().toISOString() })
      .eq('client_id', client.user_id)
      .eq('status', 'published')
      .is('paused_at', null);

    if (error) {
      toast.error('Fehler beim Pausieren');
    } else {
      toast.success('Alle Jobs pausiert');
      fetchClients();
    }
    setProcessing(null);
  };

  const handleReactivateJobs = async (client: Client) => {
    setProcessing(client.user_id);
    
    const { error } = await supabase
      .from('jobs')
      .update({ paused_at: null })
      .eq('client_id', client.user_id)
      .not('paused_at', 'is', null);

    if (error) {
      toast.error('Fehler beim Reaktivieren');
    } else {
      toast.success('Alle Jobs reaktiviert');
      fetchClients();
    }
    setProcessing(null);
  };

  const handleSaveNotes = async () => {
    if (!selectedClient) return;
    
    const { error } = await supabase
      .from('profiles')
      .update({ internal_notes: notes })
      .eq('user_id', selectedClient.user_id);

    if (error) {
      toast.error('Fehler beim Speichern');
    } else {
      toast.success('Notizen gespeichert');
      fetchClients();
    }
  };

  const filteredClients = clients.filter(c =>
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Aktiv</Badge>;
      case 'suspended':
        return <Badge variant="destructive">Gesperrt</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Inaktiv</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
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
            <h1 className="text-3xl font-bold">Kundenverwaltung</h1>
            <p className="text-muted-foreground mt-1">
              Alle registrierten Unternehmen verwalten
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clients.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktiv</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {clients.filter(c => c.status === 'active').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesperrt</CardTitle>
                <Ban className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {clients.filter(c => c.status === 'suspended').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Aktive Jobs</CardTitle>
                <Briefcase className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {clients.reduce((sum, c) => sum + c.activeJobCount, 0)}
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

          {/* Clients Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma / Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Jobs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registriert</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Keine Clients gefunden
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{client.company_name || '-'}</p>
                            <p className="text-sm text-muted-foreground">{client.full_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {client.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Badge variant="secondary">{client.activeJobCount} aktiv</Badge>
                            <Badge variant="outline">{client.jobCount} gesamt</Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(client.status)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(client.created_at), 'PP', { locale: de })}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={processing === client.user_id}>
                                {processing === client.user_id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedClient(client);
                                setNotes(client.internal_notes || '');
                                setDetailOpen(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                Details ansehen
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setSelectedClient(client);
                                setNotes(client.internal_notes || '');
                                setDetailOpen(true);
                              }}>
                                <StickyNote className="mr-2 h-4 w-4" />
                                Notizen bearbeiten
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {client.activeJobCount > 0 && (
                                <DropdownMenuItem onClick={() => handlePauseAllJobs(client)}>
                                  <Pause className="mr-2 h-4 w-4" />
                                  Alle Jobs pausieren
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleReactivateJobs(client)}>
                                <Play className="mr-2 h-4 w-4" />
                                Jobs reaktivieren
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {client.status === 'active' ? (
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => handleSuspend(client, true, 'Admin-Sperre')}
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Konto sperren
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => handleSuspend(client, false)}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Konto aktivieren
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
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Client Details</DialogTitle>
            </DialogHeader>
            {selectedClient && (
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="info">Allgemein</TabsTrigger>
                  <TabsTrigger value="verification">Verifizierung</TabsTrigger>
                  <TabsTrigger value="notes">Notizen</TabsTrigger>
                </TabsList>
                
                <TabsContent value="info" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Firma</p>
                      <p className="font-medium">{selectedClient.company_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{selectedClient.full_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">E-Mail</p>
                      <p className="font-medium">{selectedClient.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      {getStatusBadge(selectedClient.status)}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Jobs</p>
                      <p className="font-medium">{selectedClient.activeJobCount} aktiv / {selectedClient.jobCount} gesamt</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Registriert</p>
                      <p className="font-medium">{format(new Date(selectedClient.created_at), 'PPP', { locale: de })}</p>
                    </div>
                  </div>

                  {selectedClient.suspended_at && (
                    <div className="p-3 bg-destructive/10 rounded-lg">
                      <p className="text-sm font-medium text-destructive">Gesperrt am {format(new Date(selectedClient.suspended_at), 'PPP', { locale: de })}</p>
                      {selectedClient.suspension_reason && (
                        <p className="text-sm text-muted-foreground">Grund: {selectedClient.suspension_reason}</p>
                      )}
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="verification" className="space-y-4 mt-4">
                  {selectedClient.verification ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">AGB akzeptiert</p>
                          <div className="flex items-center gap-2 mt-1">
                            {selectedClient.verification.terms_accepted ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">
                              {selectedClient.verification.terms_accepted ? 'Ja' : 'Nein'}
                            </span>
                          </div>
                          {selectedClient.verification.terms_accepted_at && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(selectedClient.verification.terms_accepted_at), 'PPp', { locale: de })}
                            </p>
                          )}
                        </div>
                        
                        <div className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Vertrag unterschrieben</p>
                          <div className="flex items-center gap-2 mt-1">
                            {selectedClient.verification.contract_signed ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">
                              {selectedClient.verification.contract_signed ? 'Ja' : 'Nein'}
                            </span>
                          </div>
                          {selectedClient.verification.digital_signature && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Signatur: {selectedClient.verification.digital_signature}
                            </p>
                          )}
                        </div>
                        
                        <div className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">Handelsregister-Nr.</p>
                          <p className="font-medium mt-1">
                            {selectedClient.verification.company_registration_number || '-'}
                          </p>
                        </div>
                        
                        <div className="p-3 border rounded-lg">
                          <p className="text-sm text-muted-foreground">USt-ID</p>
                          <p className="font-medium mt-1">
                            {selectedClient.verification.vat_id || '-'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm text-muted-foreground">KYC-Status</p>
                            <div className="mt-1">{getKycStatusBadge(selectedClient.verification.kyc_status)}</div>
                          </div>
                          {selectedClient.verification.kyc_verified_at && (
                            <p className="text-xs text-muted-foreground">
                              Verifiziert: {format(new Date(selectedClient.verification.kyc_verified_at), 'PPp', { locale: de })}
                            </p>
                          )}
                        </div>
                        
                        {selectedClient.verification.kyc_status === 'in_review' && (
                          <div className="flex gap-2 mt-4">
                            <Button 
                              onClick={() => handleApproveKyc(selectedClient)}
                              disabled={processing === selectedClient.user_id}
                              className="flex-1"
                            >
                              {processing === selectedClient.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <ShieldCheck className="h-4 w-4 mr-2" />
                              )}
                              KYC genehmigen
                            </Button>
                            <Button 
                              variant="destructive"
                              onClick={() => setShowRejectionDialog(true)}
                              disabled={processing === selectedClient.user_id}
                              className="flex-1"
                            >
                              <ShieldX className="h-4 w-4 mr-2" />
                              Ablehnen
                            </Button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Keine Verifizierungsdaten vorhanden</p>
                      <p className="text-sm">Der Client hat den Onboarding-Prozess noch nicht gestartet.</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="notes" className="mt-4">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notizen zu diesem Client..."
                    rows={6}
                  />
                  <Button className="mt-2" onClick={handleSaveNotes}>
                    Notizen speichern
                  </Button>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Rejection Dialog */}
        <Dialog open={showRejectionDialog} onOpenChange={setShowRejectionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>KYC ablehnen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Bitte geben Sie den Grund für die Ablehnung an. Der Client wird per E-Mail benachrichtigt.
              </p>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ablehnungsgrund..."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectionDialog(false)}>
                Abbrechen
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleRejectKyc}
                disabled={!rejectionReason.trim() || processing !== null}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ablehnen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    );
}