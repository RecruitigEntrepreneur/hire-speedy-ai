import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Clock, Banknote, Search } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface PayoutRequest {
  id: string;
  placement_id: string;
  recruiter_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  recruiter_profile?: {
    full_name: string;
    email: string;
  };
  placement?: {
    start_date: string;
    submission?: {
      candidate?: {
        full_name: string;
      };
      job?: {
        title: string;
        company_name: string;
      };
    };
  };
}

export default function AdminPayoutApproval() {
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; requestId: string | null }>({
    open: false,
    requestId: null,
  });
  const [rejectReason, setRejectReason] = useState("");

  const fetchRequests = async () => {
    try {
      const { data: requestsData, error } = await supabase
        .from("payout_requests")
        .select(`
          *,
          placement:placements (
            start_date,
            submission:submissions (
              candidate:candidates (
                full_name
              ),
              job:jobs (
                title,
                company_name
              )
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch recruiter profiles
      const recruiterIds = [...new Set((requestsData || []).map((r) => r.recruiter_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", recruiterIds);

      const requestsWithProfiles = (requestsData || []).map((r) => ({
        ...r,
        recruiter_profile: profiles?.find((p) => p.user_id === r.recruiter_id),
      }));

      setRequests(requestsWithProfiles);
    } catch (error) {
      console.error("Error fetching payout requests:", error);
      toast.error("Fehler beim Laden der Auszahlungsanfragen");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { data, error } = await supabase.functions.invoke("process-payout", {
        body: {
          payout_request_id: requestId,
          action: "approve",
        },
      });

      if (error) throw error;

      toast.success("Auszahlung genehmigt und verarbeitet");
      fetchRequests();
    } catch (error: any) {
      console.error("Error approving payout:", error);
      toast.error(error.message || "Fehler bei der Genehmigung");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog.requestId) return;

    setProcessing(rejectDialog.requestId);
    try {
      const { error } = await supabase.functions.invoke("process-payout", {
        body: {
          payout_request_id: rejectDialog.requestId,
          action: "reject",
          reason: rejectReason,
        },
      });

      if (error) throw error;

      toast.success("Auszahlung abgelehnt");
      setRejectDialog({ open: false, requestId: null });
      setRejectReason("");
      fetchRequests();
    } catch (error: any) {
      console.error("Error rejecting payout:", error);
      toast.error(error.message || "Fehler bei der Ablehnung");
    } finally {
      setProcessing(null);
    }
  };

  const formatCurrency = (value: number, currency = "EUR") => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Ausstehend
          </Badge>
        );
      case "approved":
      case "processing":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Wird verarbeitet
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Abgeschlossen
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Fehlgeschlagen
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" />
            Abgelehnt
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRequests = requests.filter((r) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      r.recruiter_profile?.full_name?.toLowerCase().includes(searchLower) ||
      r.recruiter_profile?.email?.toLowerCase().includes(searchLower) ||
      r.placement?.submission?.candidate?.full_name?.toLowerCase().includes(searchLower) ||
      r.placement?.submission?.job?.title?.toLowerCase().includes(searchLower)
    );
  });

  const pendingRequests = filteredRequests.filter((r) => r.status === "pending");
  const processedRequests = filteredRequests.filter((r) => r.status !== "pending");

  const totalPending = pendingRequests.reduce((sum, r) => sum + r.amount, 0);
  const totalProcessed = processedRequests
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + r.amount, 0);

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
            <h1 className="text-2xl font-bold">Auszahlungsgenehmigung</h1>
            <p className="text-muted-foreground">
              Prüfe und genehmige Recruiter-Auszahlungen
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ausstehende Anfragen</CardTitle>
                <Clock className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingRequests.length}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totalPending)} gesamt
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Verarbeitet</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{processedRequests.length}</div>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(totalProcessed)} ausgezahlt
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gesamt Anfragen</CardTitle>
                <Banknote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{requests.length}</div>
                <p className="text-xs text-muted-foreground">Alle Zeiten</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Recruiter, Kandidat oder Position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Pending Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Ausstehende Anfragen</CardTitle>
              <CardDescription>
                Anfragen, die auf Genehmigung warten
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine ausstehenden Anfragen
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recruiter</TableHead>
                      <TableHead>Kandidat / Position</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Angefragt am</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {request.recruiter_profile?.full_name || "—"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {request.recruiter_profile?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{request.placement?.submission?.candidate?.full_name || "—"}</p>
                            <p className="text-sm text-muted-foreground">
                              {request.placement?.submission?.job?.title} @{" "}
                              {request.placement?.submission?.job?.company_name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(request.amount, request.currency)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(request.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={processing === request.id}
                            >
                              {processing === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Genehmigen
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setRejectDialog({ open: true, requestId: request.id })
                              }
                              disabled={processing === request.id}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Ablehnen
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Processed Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Verarbeitete Anfragen</CardTitle>
              <CardDescription>
                Bereits bearbeitete Auszahlungsanfragen
              </CardDescription>
            </CardHeader>
            <CardContent>
              {processedRequests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Noch keine verarbeiteten Anfragen
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recruiter</TableHead>
                      <TableHead>Kandidat / Position</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Verarbeitet am</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedRequests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {request.recruiter_profile?.full_name || "—"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {request.recruiter_profile?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{request.placement?.submission?.candidate?.full_name || "—"}</p>
                            <p className="text-sm text-muted-foreground">
                              {request.placement?.submission?.job?.title}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(request.amount, request.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
                        <TableCell>
                          {format(new Date(request.created_at), "dd.MM.yyyy", { locale: de })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Reject Dialog */}
        <AlertDialog
          open={rejectDialog.open}
          onOpenChange={(open) => setRejectDialog({ open, requestId: null })}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Auszahlung ablehnen</AlertDialogTitle>
              <AlertDialogDescription>
                Bitte gib einen Grund für die Ablehnung an. Der Recruiter wird benachrichtigt.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              placeholder="Grund für Ablehnung (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={handleReject}>Ablehnen</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </DashboardLayout>
  );
}
